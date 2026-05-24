import type { AiCallMetric } from "../../shared/domain";
import { config } from "./config";

export interface ModelResult {
  text: string;
  metric: AiCallMetric;
}

export async function callModel(purpose: string, prompt: string): Promise<ModelResult> {
  const started = Date.now();
  if (config.modelProvider === "openai-compatible" && config.openaiCompatibleApiKey) {
    try {
      const text = await callOpenAiCompatible(prompt);
      return {
        text,
        metric: metric({
          provider: "openai-compatible",
          model: config.openaiCompatibleModel,
          purpose,
          started,
          prompt,
          text,
          status: "passed",
        }),
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown model error";
      return {
        text: `真实模型调用失败：${message}`,
        metric: metric({
          provider: "openai-compatible",
          model: config.openaiCompatibleModel,
          purpose,
          started,
          prompt,
          text: message,
          status: "failed",
        }),
      };
    }
  }

  const skippedReason =
    "MODEL_PROVIDER 未配置为 openai-compatible，或缺少 OPENAI_API_KEY / OPENAI_COMPATIBLE_API_KEY；本轮未调用真实模型。";
  return {
    text: skippedReason,
    metric: metric({
      provider: config.modelProvider,
      model: config.modelProvider === "openai-compatible" ? config.openaiCompatibleModel : config.codexModel,
      purpose,
      started,
      prompt,
      text: skippedReason,
      status: "skipped",
    }),
  };
}

export async function generateImplementationPlan(prompt: string): Promise<{ plan: string; metric: AiCallMetric }> {
  const result = await callModel("generate-implementation-plan", prompt);
  return { plan: result.text, metric: result.metric };
}

async function callOpenAiCompatible(prompt: string): Promise<string> {
  const response = await fetch(`${config.openaiCompatibleBaseUrl.replace(/\/$/, "")}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.openaiCompatibleApiKey}`,
    },
    body: JSON.stringify({
      model: config.openaiCompatibleModel,
      temperature: 0.2,
      messages: [
        {
          role: "system",
          content:
            "You are a senior full-stack delivery agent. Return only the requested format. Do not wrap JSON in markdown fences unless explicitly requested.",
        },
        { role: "user", content: prompt },
      ],
    }),
  });
  if (!response.ok) {
    throw new Error(`${response.status} ${await response.text()}`);
  }
  const payload = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const content = payload.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error("model returned empty content");
  }
  return content;
}

function metric(input: {
  provider: string;
  model: string;
  purpose: string;
  started: number;
  prompt: string;
  text: string;
  status: "passed" | "failed" | "skipped";
}): AiCallMetric {
  return {
    provider: input.provider,
    model: input.model,
    purpose: input.purpose,
    latencyMs: Date.now() - input.started,
    inputTokens: Math.ceil(input.prompt.length / 4),
    outputTokens: Math.ceil(input.text.length / 4),
    estimatedCostUsd: 0,
    status: input.status,
    createdAt: new Date().toISOString(),
  };
}
