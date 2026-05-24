import type { AiCallMetric } from "../../shared/domain";
import { config } from "./config";

export async function generateImplementationPlan(prompt: string): Promise<{ plan: string; metric: AiCallMetric }> {
  const started = Date.now();
  const skipped = !config.codexEnabled;
  return {
    plan: skipped
      ? "CODEX_MODEL_ENABLED 未开启，本轮使用确定性 Skill DAG 和仓库索引生成交付计划；approve 后可写入交付证据并运行真实验证。"
      : `调用 ${config.codexCommand} 生成实现计划：${prompt.slice(0, 400)}`,
    metric: {
      provider: "local",
      model: config.codexModel,
      purpose: "generate-implementation-plan",
      latencyMs: Date.now() - started,
      inputTokens: Math.ceil(prompt.length / 4),
      outputTokens: skipped ? 34 : 120,
      estimatedCostUsd: 0,
      status: skipped ? "skipped" : "passed",
      createdAt: new Date().toISOString(),
    },
  };
}
