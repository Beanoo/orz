import type { DeliverySession, ProjectState, RepositorySnapshot, SkillManifest } from "../shared/domain";

const jsonHeaders = { "Content-Type": "application/json" };

export async function getProject(): Promise<{ project: ProjectState; deliveries: DeliverySession[] }> {
  return request("/api/project");
}

export async function getRepository(): Promise<{ repository: RepositorySnapshot }> {
  return request("/api/repository");
}

export async function getSkills(): Promise<{ skills: SkillManifest[] }> {
  return request("/api/skills");
}

export async function createDelivery(requirement: string): Promise<{ delivery: DeliverySession }> {
  return request("/api/deliveries", {
    method: "POST",
    headers: jsonHeaders,
    body: JSON.stringify({ requirement }),
  });
}

export async function approveDelivery(id: string): Promise<{ delivery: DeliverySession }> {
  return request(`/api/deliveries/${id}/approve`, { method: "POST" });
}

export async function replayDelivery(id: string, fromStage: string): Promise<{ delivery: DeliverySession }> {
  return request(`/api/deliveries/${id}/replay`, {
    method: "POST",
    headers: jsonHeaders,
    body: JSON.stringify({ fromStage }),
  });
}

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init);
  const payload = (await response.json()) as T & { error?: string };
  if (!response.ok) {
    throw new Error(payload.error ?? `Request failed: ${response.status}`);
  }
  return payload;
}
