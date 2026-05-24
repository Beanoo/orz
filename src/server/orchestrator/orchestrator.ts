import type { DeliverySession, DeliveryStageEvent, MemoryRecord, StageName, StageStatus } from "../../shared/domain";
import { applyArticleCoverImagePatch } from "../services/articleCoverImagePatch";
import { config } from "../services/config";
import { commitDelivery, inspectGitSafety, runTargetVerification, writeDeliveryEvidence } from "../services/gitDelivery";
import { generateAndApplyModelPatch } from "../services/modelPatch";
import { generateImplementationPlan } from "../services/modelAdapter";
import { buildRepositorySnapshot } from "../services/repositoryIndex";
import { appendEvent, listMemory, saveDelivery, saveMemory } from "../persistence/store";
import { buildConsistencyContracts, locateModules } from "./moduleLocator";
import { parseRequirementWithModel } from "./requirementParser";
import { planSkills } from "./skills";

export async function createDelivery(rawRequirement: string): Promise<DeliverySession> {
  const now = new Date().toISOString();
  const id = `d-${compactTimestamp(now)}`;
  const parsed = await parseRequirementWithModel(rawRequirement, config.targetRepository);
  const { dsl, questions } = parsed;
  const memoryMatches = await recallMemory(rawRequirement);
  const gitSafety = await inspectGitSafety();
  const session: DeliverySession = {
    id,
    title: dsl.title,
    rawRequirement,
    createdAt: now,
    updatedAt: now,
    currentStage: "clarify",
    status: dsl.status === "contradictory" || dsl.status === "needs-clarification" ? "needs-clarification" : "awaiting-approval",
    dsl,
    clarificationQuestions: questions,
    skillDag: [],
    recipeHits: [],
    moduleTargets: [],
    consistencyContracts: [],
    verificationResults: [],
    aiMetrics: [],
    git: {
      targetPath: config.targetPath,
      remote: gitSafety.remote,
      branch: gitSafety.branch,
      changedFiles: gitSafety.changedFiles,
      safeToOperate: gitSafety.safeToOperate,
      refusalReason: gitSafety.refusalReason,
    },
    memoryMatches,
    events: [],
  };
  if (parsed.metric) {
    session.aiMetrics.push(parsed.metric);
  }

  await runPlanningStages(session);
  await saveDelivery(session);
  return session;
}

export async function approveDelivery(session: DeliverySession): Promise<DeliverySession> {
  if (session.dsl.status === "contradictory") {
    return fail(session, "clarify", "需求存在矛盾，必须先修改 DSL 或需求。");
  }
  const safety = await inspectGitSafety();
  session.git = { ...session.git, ...safety, targetPath: config.targetPath };
  if (!safety.safeToOperate) {
    return fail(session, "apply", safety.refusalReason ?? "目标仓不安全。");
  }
  await record(session, "apply", "running", "写入 Conduiteg 代码变更和交付证据。");
  let codeFiles: string[];
  try {
    codeFiles = await applyCodeChanges(session);
  } catch (error) {
    const message = error instanceof Error ? error.message : "代码变更应用失败。";
    return fail(session, "apply", message);
  }
  const evidenceFile = await writeDeliveryEvidence(session);
  session.git.changedFiles = [...codeFiles, evidenceFile];
  await record(session, "apply", "passed", `已写入 ${codeFiles.length} 个代码文件和 ${evidenceFile}。`, {
    codeFiles,
    evidenceFile,
  });

  await record(session, "verify", "running", "运行目标仓验证命令。");
  session.verificationResults = await runTargetVerification();
  const verificationFailed = session.verificationResults.some((result) => result.status === "failed");
  await record(session, "verify", verificationFailed ? "failed" : "passed", verificationFailed ? "验证失败。" : "验证通过。", {
    verificationResults: session.verificationResults,
  });
  if (verificationFailed) {
    session.status = "failed";
    session.currentStage = "verify";
    await saveDelivery(touch(session));
    return session;
  }

  await record(session, "commit", "running", "提交目标仓交付证据。");
  const commit = await commitDelivery(session);
  session.git.branch = commit.branch;
  session.git.commitHash = commit.commitHash;
  await record(session, "commit", "passed", commit.commitHash ? `提交 ${commit.commitHash}` : "无 staged 变更，跳过提交。", commit);

  await persistMemory(session);
  await record(session, "memory", "passed", "交付记忆已沉淀。");
  session.status = "delivered";
  session.currentStage = "memory";
  await saveDelivery(touch(session));
  return session;
}

async function applyCodeChanges(session: DeliverySession): Promise<string[]> {
  const hasArticleCover = session.dsl.intents.some((intent) => intent.entity === "Article" && intent.field === "coverImage");
  if (!hasArticleCover) {
    return generateAndApplyModelPatch(session);
  }
  return applyArticleCoverImagePatch();
}

export async function replayDelivery(session: DeliverySession, fromStage: StageName): Promise<DeliverySession> {
  await record(session, fromStage, "running", `从 ${fromStage} 阶段重放下游流程。`);
  if (["clarify", "plan", "locate", "generate"].includes(fromStage)) {
    session.skillDag = [];
    session.recipeHits = [];
    session.moduleTargets = [];
    session.consistencyContracts = [];
    session.aiMetrics = [];
    await runPlanningStages(session);
  }
  await saveDelivery(touch(session));
  return session;
}

async function runPlanningStages(session: DeliverySession): Promise<void> {
  await record(session, "clarify", session.dsl.status === "contradictory" ? "blocked" : "passed", clarifyMessage(session));
  if (session.dsl.status === "contradictory") {
    session.status = "needs-clarification";
    session.currentStage = "clarify";
    return;
  }

  await record(session, "plan", "running", "生成 Requirement DSL、Recipe 命中和 Atomic Skill DAG。");
  const planned = planSkills(session.dsl);
  session.skillDag = planned.dag;
  session.recipeHits = planned.recipes;
  await record(session, "plan", "passed", "规划完成。", { skillDag: session.skillDag, recipeHits: session.recipeHits });

  await record(session, "locate", "running", "读取目标仓事实并定位模块。");
  const snapshot = await buildRepositorySnapshot(config.targetPath);
  session.moduleTargets = await locateModules(session.dsl, config.targetPath);
  session.consistencyContracts = buildConsistencyContracts(session.dsl, session.moduleTargets);
  await record(session, "locate", "passed", "模块定位和一致性合约完成。", {
    repository: snapshot,
    moduleTargets: session.moduleTargets,
    contracts: session.consistencyContracts,
  });

  await record(session, "generate", "running", "生成实现计划。");
  const prompt = JSON.stringify(
    {
      dsl: session.dsl,
      skillDag: session.skillDag,
      moduleTargets: session.moduleTargets,
      contracts: session.consistencyContracts,
    },
    null,
    2,
  );
  const generated = await generateImplementationPlan(prompt);
  session.aiMetrics.push(generated.metric);
  await record(session, "generate", "passed", generated.plan, { metric: generated.metric });
  session.currentStage = "generate";
}

async function persistMemory(session: DeliverySession): Promise<void> {
  const recordValue: MemoryRecord = {
    id: `m-${session.id}`,
    fingerprint: fingerprint(session.rawRequirement),
    title: session.title,
    recipeId: session.recipeHits[0]?.id,
    skillIds: session.skillDag.map((node) => node.skillId),
    decisions: session.dsl.assumptions,
    changedFiles: session.git.changedFiles,
    verification: session.verificationResults,
    commitHash: session.git.commitHash,
    createdAt: new Date().toISOString(),
  };
  await saveMemory(recordValue);
}

async function recallMemory(rawRequirement: string): Promise<MemoryRecord[]> {
  const desired = new Set(fingerprint(rawRequirement).split("-"));
  return (await listMemory())
    .map((record) => ({
      record,
      score: record.fingerprint.split("-").filter((token) => desired.has(token)).length,
    }))
    .filter((match) => match.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .map((match) => match.record);
}

async function fail(session: DeliverySession, stage: StageName, message: string): Promise<DeliverySession> {
  await record(session, stage, "failed", message);
  session.status = "blocked";
  session.currentStage = stage;
  await saveDelivery(touch(session));
  return session;
}

async function record(
  session: DeliverySession,
  stage: StageName,
  status: StageStatus,
  message: string,
  evidence?: unknown,
): Promise<void> {
  const event: DeliveryStageEvent = {
    id: `evt-${session.events.length + 1}-${Date.now()}`,
    deliveryId: session.id,
    stage,
    status,
    message,
    evidence,
    createdAt: new Date().toISOString(),
  };
  session.events.push(event);
  session.currentStage = stage;
  await appendEvent(event);
}

function clarifyMessage(session: DeliverySession): string {
  if (session.dsl.status === "contradictory") {
    return session.dsl.contradictions.join(" ");
  }
  if (session.clarificationQuestions.length > 0) {
    return "存在可用默认值的澄清问题，进入人工门禁前展示给操作员确认。";
  }
  return "需求清晰，可进入规划。";
}

function touch<T extends { updatedAt: string }>(value: T): T {
  value.updatedAt = new Date().toISOString();
  return value;
}

function compactTimestamp(value: string): string {
  return value.replace(/\D/g, "").slice(0, 14);
}

function fingerprint(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
}
