import cors from "cors";
import express from "express";
import path from "node:path";
import { z } from "zod";
import type { ProjectState, StageName } from "../shared/domain";
import { atomicSkills } from "./orchestrator/skills";
import { approveDelivery, createDelivery, replayDelivery } from "./orchestrator/orchestrator";
import { loadDelivery, listDeliveries, saveProjectState } from "./persistence/store";
import { config } from "./services/config";
import { buildRepositorySnapshot } from "./services/repositoryIndex";

const app = express();
app.use(cors());
app.use(express.json({ limit: "1mb" }));

app.get("/api/project", async (_req, res) => {
  const state: ProjectState = {
    name: "ORZ L2/L3 Super Individual",
    systemRepository: config.systemRepository,
    targetRepository: config.targetRepository,
    targetPath: config.targetPath,
    designPrinciples: [
      "长期状态外置到 feature list、progress log、event store 和 Git commit",
      "initializer 负责结构化任务，coding agent 每轮推进一个可验证能力",
      "每阶段都有可恢复证据、验收标准、验证命令和 Git 状态",
      "新需求默认拆成通用 Atomic Skill DAG，而不是一需求一 Skill",
      "真实操作 Conduiteg 仓库，拒绝不安全工作区",
    ],
    qualityGates: [
      "目标 remote 必须匹配 Conduiteg",
      "目标仓有未提交变更时拒绝 apply/commit",
      "跨栈一致性合约缺失传播目标时保持失败可见",
      "验证命令失败时阻断 commit",
      "交付证据和记忆必须持久化",
    ],
    progressLog: [
      "shared domain schema initialized",
      "atomic skill registry and recipe planner initialized",
      "JSON event store initialized",
      "repository index and git delivery service initialized",
    ],
    updatedAt: new Date().toISOString(),
  };
  await saveProjectState(state);
  res.json({ project: state, deliveries: await listDeliveries() });
});

app.get("/api/repository", async (_req, res, next) => {
  try {
    res.json({ repository: await buildRepositorySnapshot(config.targetPath) });
  } catch (error) {
    next(error);
  }
});

app.post("/api/deliveries", async (req, res, next) => {
  try {
    const body = z.object({ requirement: z.string().min(1) }).parse(req.body);
    res.status(201).json({ delivery: await createDelivery(body.requirement) });
  } catch (error) {
    next(error);
  }
});

app.get("/api/deliveries/:id", async (req, res) => {
  const delivery = await loadDelivery(req.params.id);
  if (!delivery) {
    res.status(404).json({ error: "Delivery not found" });
    return;
  }
  res.json({ delivery });
});

app.post("/api/deliveries/:id/approve", async (req, res, next) => {
  try {
    const delivery = await loadDelivery(req.params.id);
    if (!delivery) {
      res.status(404).json({ error: "Delivery not found" });
      return;
    }
    res.json({ delivery: await approveDelivery(delivery) });
  } catch (error) {
    next(error);
  }
});

app.post("/api/deliveries/:id/replay", async (req, res, next) => {
  try {
    const body = z.object({ fromStage: z.string() }).parse(req.body);
    const delivery = await loadDelivery(req.params.id);
    if (!delivery) {
      res.status(404).json({ error: "Delivery not found" });
      return;
    }
    res.json({ delivery: await replayDelivery(delivery, body.fromStage as StageName) });
  } catch (error) {
    next(error);
  }
});

app.get("/api/skills", (_req, res) => {
  res.json({ skills: atomicSkills });
});

app.get("/api/metrics", async (_req, res) => {
  const deliveries = await listDeliveries();
  res.json({
    metrics: deliveries.flatMap((delivery) =>
      delivery.aiMetrics.map((metric) => ({
        deliveryId: delivery.id,
        deliveryTitle: delivery.title,
        ...metric,
      })),
    ),
  });
});

if (process.env.NODE_ENV === "production") {
  const dist = path.resolve("dist/client");
  app.use(express.static(dist));
  app.get("*", (_req, res) => res.sendFile(path.join(dist, "index.html")));
}

app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  const message = error instanceof Error ? error.message : "Unknown error";
  res.status(400).json({ error: message });
});

app.listen(config.port, () => {
  console.log(`ORZ API listening on http://127.0.0.1:${config.port}`);
});
