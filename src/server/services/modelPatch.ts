import fs from "node:fs/promises";
import path from "node:path";
import type { DeliverySession } from "../../shared/domain";
import { config } from "./config";
import { callModel } from "./modelAdapter";
import { buildRepositorySnapshot } from "./repositoryIndex";
import { runCommand } from "./shell";

export async function generateAndApplyModelPatch(session: DeliverySession): Promise<string[]> {
  const context = await buildPatchContext();
  const prompt = [
    "你正在真实修改 Conduiteg 仓库。根据交付会话生成 unified diff patch。",
    "要求：",
    "- 只返回可被 git apply 接受的 unified diff，不要 markdown fence，不要解释。",
    "- patch 必须只修改目标仓内文件。",
    "- 不确定时返回 NO_PATCH，并说明必须澄清的原因。",
    "- 优先遵守已有代码风格和 package scripts。",
    "- 覆盖后端、前端、测试或文档中 DSL 声明的传播目标。",
    "",
    "Delivery session:",
    JSON.stringify(
      {
        id: session.id,
        dsl: session.dsl,
        skillDag: session.skillDag,
        moduleTargets: session.moduleTargets,
        consistencyContracts: session.consistencyContracts,
        memoryMatches: session.memoryMatches,
      },
      null,
      2,
    ),
    "",
    "Repository context:",
    context,
  ].join("\n");

  const result = await callModel("generate-unified-diff", prompt);
  session.aiMetrics.push(result.metric);
  if (result.metric.status !== "passed") {
    throw new Error("真实模型未配置或调用失败，无法为通用需求生成代码 patch。");
  }

  const patch = stripPatchFence(result.text);
  if (!patch.startsWith("diff --git") || patch.includes("NO_PATCH")) {
    throw new Error(`模型未返回可应用的 unified diff：${patch.slice(0, 400)}`);
  }

  const patchFile = path.join(config.dataDir, "generated-patches", `${session.id}.patch`);
  await fs.mkdir(path.dirname(patchFile), { recursive: true });
  await fs.writeFile(patchFile, patch);

  const check = await runCommand("git", ["apply", "--check", patchFile], config.targetPath);
  if (check.exitCode !== 0) {
    throw new Error(`模型 patch 未通过 git apply --check：${check.output}`);
  }
  const apply = await runCommand("git", ["apply", patchFile], config.targetPath);
  if (apply.exitCode !== 0) {
    throw new Error(`模型 patch 应用失败：${apply.output}`);
  }
  const status = await runCommand("git", ["status", "--porcelain"], config.targetPath);
  return status.output
    .split("\n")
    .map((line) => line.trim().slice(3))
    .filter(Boolean);
}

async function buildPatchContext(): Promise<string> {
  const snapshot = await buildRepositorySnapshot(config.targetPath);
  const tracked = await runCommand("git", ["ls-files"], config.targetPath);
  const files = tracked.output
    .split("\n")
    .filter(Boolean)
    .filter((file) => isUsefulContextFile(file))
    .slice(0, 260);
  return JSON.stringify(
    {
      snapshot,
      trackedFiles: files,
      note: "如果需要具体文件内容，请优先修改 trackedFiles 中与 DSL 最相关的文件；当前 harness 会在后续版本加入按需读文件工具。",
    },
    null,
    2,
  );
}

function isUsefulContextFile(file: string): boolean {
  if (file.includes("node_modules/") || file.includes("dist/") || file.includes("coverage/")) {
    return false;
  }
  return /\.(js|jsx|ts|tsx|json|css|md|sql)$/.test(file);
}

function stripPatchFence(value: string): string {
  return value
    .trim()
    .replace(/^```(?:diff|patch)?\s*/i, "")
    .replace(/\s*```$/i, "");
}
