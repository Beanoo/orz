import fs from "node:fs/promises";
import path from "node:path";
import type { DeliverySession, VerificationResult } from "../../shared/domain";
import { config } from "./config";
import { runCommand } from "./shell";

export async function inspectGitSafety(): Promise<{
  remote: string;
  branch: string;
  safeToOperate: boolean;
  changedFiles: string[];
  refusalReason?: string;
}> {
  const [remote, branch, status] = await Promise.all([
    runCommand("git", ["config", "--get", "remote.origin.url"], config.targetPath),
    runCommand("git", ["branch", "--show-current"], config.targetPath),
    runCommand("git", ["status", "--porcelain"], config.targetPath),
  ]);
  const changedFiles = status.output
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  const remoteValue = remote.output.trim();
  const safeToOperate = remoteValue === config.targetRepository && changedFiles.length === 0;
  return {
    remote: remoteValue,
    branch: branch.output.trim(),
    safeToOperate,
    changedFiles,
    refusalReason: safeToOperate
      ? undefined
      : `目标仓 remote 或工作区状态不安全：remote=${remoteValue || "<empty>"} changed=${changedFiles.length}`,
  };
}

export async function writeDeliveryEvidence(session: DeliverySession): Promise<string> {
  const dir = path.join(config.targetPath, "docs", "e2e-deliveries");
  await fs.mkdir(dir, { recursive: true });
  const file = path.join(dir, `${session.id}.md`);
  const body = [
    `# ${session.title}`,
    "",
    `- Delivery: ${session.id}`,
    `- Created: ${session.createdAt}`,
    `- Requirement: ${session.rawRequirement}`,
    `- DSL status: ${session.dsl.status}`,
    `- Recipe: ${session.recipeHits.map((recipe) => recipe.id).join(", ") || "none"}`,
    `- Skills: ${session.skillDag.map((node) => node.skillId).join(" -> ")}`,
    "",
    "## Consistency Contracts",
    "",
    ...session.consistencyContracts.flatMap((contract) => [
      `### ${contract.sourceField}`,
      "",
      ...contract.propagationTargets.map((target) => `- ${target.kind}: \`${target.file}\` - ${target.expectation}`),
      "",
    ]),
  ].join("\n");
  await fs.writeFile(file, `${body}\n`);
  return path.relative(config.targetPath, file);
}

export async function runTargetVerification(): Promise<VerificationResult[]> {
  const packageJson = await readPackageJson();
  const scripts = packageJson.scripts ?? {};
  const commands = ["lint", "test", "build"].filter((name) => scripts[name]).map((name) => `npm run ${name}`);
  const selected = commands.length > 0 ? commands : ["git status --short"];
  const results: VerificationResult[] = [];
  for (const command of selected) {
    const [bin, ...args] = command.split(" ");
    const result = await runCommand(bin, args, config.targetPath, 180000);
    results.push({
      command,
      cwd: config.targetPath,
      status: result.exitCode === 0 ? "passed" : "failed",
      exitCode: result.exitCode,
      durationMs: result.durationMs,
      output: result.output,
    });
    if (result.exitCode !== 0) {
      break;
    }
  }
  return results;
}

export async function commitDelivery(session: DeliverySession): Promise<{ commitHash?: string; branch: string }> {
  const branchName = `e2e/${session.id}-${slug(session.title)}`;
  await runCommand("git", ["checkout", "-B", branchName], config.targetPath);
  await runCommand("git", ["add", ...session.git.changedFiles], config.targetPath);
  const diff = await runCommand("git", ["diff", "--cached", "--quiet"], config.targetPath);
  if (diff.exitCode === 0) {
    return { branch: branchName };
  }
  await runCommand("git", ["commit", "-m", `docs(e2e): ${session.title}`], config.targetPath);
  const hash = await runCommand("git", ["rev-parse", "HEAD"], config.targetPath);
  return { branch: branchName, commitHash: hash.output.trim() };
}

async function readPackageJson(): Promise<{ scripts?: Record<string, string> }> {
  try {
    return JSON.parse(await fs.readFile(path.join(config.targetPath, "package.json"), "utf8")) as {
      scripts?: Record<string, string>;
    };
  } catch {
    return {};
  }
}

function slug(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 42);
}
