import path from "node:path";

export const config = {
  port: Number(process.env.PORT ?? 8787),
  systemRepository: process.env.SYSTEM_REPOSITORY ?? "git@github.com:Beanoo/orz.git",
  targetRepository: process.env.TARGET_REPOSITORY ?? "git@github.com:Beanoo/Conduiteg.git",
  targetPath: process.env.TARGET_PATH ?? "/Users/doumengyao/work/Conduiteg",
  dataDir: process.env.DATA_DIR ?? path.resolve("data"),
  modelProvider: process.env.MODEL_PROVIDER ?? "disabled",
  openaiCompatibleBaseUrl: process.env.OPENAI_COMPATIBLE_BASE_URL ?? "https://api.openai.com/v1",
  openaiCompatibleApiKey: process.env.OPENAI_API_KEY ?? process.env.OPENAI_COMPATIBLE_API_KEY,
  openaiCompatibleModel: process.env.OPENAI_COMPATIBLE_MODEL ?? process.env.OPENAI_MODEL ?? "gpt-4.1",
  codexCommand: process.env.CODEX_COMMAND ?? "codex",
  codexModel: process.env.CODEX_MODEL ?? "local-codex",
  codexEnabled: process.env.CODEX_MODEL_ENABLED === "1",
  codexTimeoutMs: Number(process.env.CODEX_MODEL_TIMEOUT_MS ?? 120000),
};
