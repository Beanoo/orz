import fs from "node:fs/promises";
import path from "node:path";
import type { DeliverySession, DeliveryStageEvent, MemoryRecord, ProjectState } from "../../shared/domain";
import { config } from "../services/config";

async function ensureDir(dir: string): Promise<void> {
  await fs.mkdir(dir, { recursive: true });
}

async function writeJson(file: string, value: unknown): Promise<void> {
  await ensureDir(path.dirname(file));
  await fs.writeFile(file, `${JSON.stringify(value, null, 2)}\n`);
}

export async function saveDelivery(session: DeliverySession): Promise<void> {
  await writeJson(path.join(config.dataDir, "deliveries", `${session.id}.json`), session);
}

export async function loadDelivery(id: string): Promise<DeliverySession | undefined> {
  try {
    return JSON.parse(await fs.readFile(path.join(config.dataDir, "deliveries", `${id}.json`), "utf8")) as DeliverySession;
  } catch {
    return undefined;
  }
}

export async function listDeliveries(): Promise<DeliverySession[]> {
  try {
    const dir = path.join(config.dataDir, "deliveries");
    const files = (await fs.readdir(dir)).filter((file) => file.endsWith(".json"));
    const deliveries = await Promise.all(files.map((file) => fs.readFile(path.join(dir, file), "utf8")));
    return deliveries.map((raw) => JSON.parse(raw) as DeliverySession).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  } catch {
    return [];
  }
}

export async function appendEvent(event: DeliveryStageEvent): Promise<void> {
  await ensureDir(path.join(config.dataDir, "events"));
  await fs.appendFile(path.join(config.dataDir, "events", `${event.deliveryId}.jsonl`), `${JSON.stringify(event)}\n`);
}

export async function listMemory(): Promise<MemoryRecord[]> {
  try {
    const dir = path.join(config.dataDir, "memory");
    const files = (await fs.readdir(dir)).filter((file) => file.endsWith(".json"));
    const records = await Promise.all(files.map((file) => fs.readFile(path.join(dir, file), "utf8")));
    return records.map((raw) => JSON.parse(raw) as MemoryRecord).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  } catch {
    return [];
  }
}

export async function saveMemory(record: MemoryRecord): Promise<void> {
  await writeJson(path.join(config.dataDir, "memory", `${record.id}.json`), record);
}

export async function saveProjectState(state: ProjectState): Promise<void> {
  await writeJson(path.join(config.dataDir, "runtime.json"), state);
}
