export type StageName =
  | "clarify"
  | "plan"
  | "locate"
  | "generate"
  | "apply"
  | "verify"
  | "commit"
  | "memory";

export type StageStatus = "pending" | "running" | "blocked" | "passed" | "failed";

export interface ClarificationQuestion {
  id: string;
  priority: "must" | "should" | "could";
  question: string;
  reason: string;
  defaultAnswer?: string;
}

export interface RequirementIntent {
  id: string;
  kind:
    | "add-field"
    | "persist-data"
    | "expose-api"
    | "edit-form"
    | "render-view"
    | "test-contract"
    | "verify-delivery";
  entity?: string;
  field?: string;
  acceptance: string[];
}

export interface RequirementDsl {
  id: string;
  title: string;
  rawInput: string;
  status: "draft" | "needs-clarification" | "ready" | "contradictory";
  role: string;
  targetRepository: string;
  intents: RequirementIntent[];
  assumptions: string[];
  contradictions: string[];
  acceptanceCriteria: string[];
}

export interface SkillManifest {
  id: string;
  name: string;
  level: "atomic" | "recipe" | "plugin";
  capability: string;
  inputContract: string[];
  outputContract: string[];
  preconditions: string[];
  postconditions: string[];
  ownedStacks: Array<"shared" | "backend" | "frontend" | "test" | "git" | "memory">;
  clarificationQuestions: string[];
  contextRequirements: string[];
  generationPromptTemplate: string;
  verificationCommands: string[];
  failureModes: string[];
}

export interface SkillDagNode {
  id: string;
  skillId: string;
  dependsOn: string[];
  intentIds: string[];
}

export interface RecipeHit {
  id: string;
  confidence: number;
  reason: string;
  skillIds: string[];
}

export interface ModuleTarget {
  stack: "backend" | "frontend" | "shared" | "test" | "docs";
  file: string;
  reason: string;
  required: boolean;
  exists: boolean;
}

export interface ConsistencyPropagationTarget {
  kind: "model" | "migration" | "controller" | "service" | "form" | "rendering" | "test";
  file: string;
  expectation: string;
  present: boolean;
}

export interface ConsistencyContract {
  id: string;
  sourceField: string;
  sourceFile: string;
  propagationTargets: ConsistencyPropagationTarget[];
  missingTargets: string[];
  status: "pending" | "passed" | "failed";
}

export interface VerificationResult {
  command: string;
  cwd: string;
  status: "pending" | "passed" | "failed" | "skipped";
  exitCode?: number;
  durationMs?: number;
  output?: string;
}

export interface AiCallMetric {
  provider: string;
  model: string;
  purpose: string;
  latencyMs: number;
  inputTokens: number;
  outputTokens: number;
  estimatedCostUsd: number;
  status: "passed" | "failed" | "skipped";
  createdAt: string;
}

export interface DeliveryStageEvent {
  id: string;
  deliveryId: string;
  stage: StageName;
  status: StageStatus;
  message: string;
  createdAt: string;
  evidence?: unknown;
}

export interface GitEvidence {
  targetPath: string;
  remote: string;
  branch?: string;
  commitHash?: string;
  changedFiles: string[];
  safeToOperate: boolean;
  refusalReason?: string;
}

export interface MemoryRecord {
  id: string;
  fingerprint: string;
  title: string;
  recipeId?: string;
  skillIds: string[];
  decisions: string[];
  changedFiles: string[];
  verification: VerificationResult[];
  commitHash?: string;
  createdAt: string;
}

export interface DeliverySession {
  id: string;
  title: string;
  rawRequirement: string;
  createdAt: string;
  updatedAt: string;
  currentStage: StageName;
  status: "needs-clarification" | "awaiting-approval" | "running" | "blocked" | "delivered" | "failed";
  dsl: RequirementDsl;
  clarificationQuestions: ClarificationQuestion[];
  skillDag: SkillDagNode[];
  recipeHits: RecipeHit[];
  moduleTargets: ModuleTarget[];
  consistencyContracts: ConsistencyContract[];
  verificationResults: VerificationResult[];
  aiMetrics: AiCallMetric[];
  git: GitEvidence;
  memoryMatches: MemoryRecord[];
  events: DeliveryStageEvent[];
}

export interface RepositorySnapshot {
  path: string;
  remote: string;
  branch: string;
  isClean: boolean;
  packageScripts: Record<string, string>;
  importantFiles: string[];
  indexedAt: string;
}

export interface ProjectState {
  name: string;
  systemRepository: string;
  targetRepository: string;
  targetPath: string;
  designPrinciples: string[];
  qualityGates: string[];
  progressLog: string[];
  updatedAt: string;
}

export const STAGES: StageName[] = [
  "clarify",
  "plan",
  "locate",
  "generate",
  "apply",
  "verify",
  "commit",
  "memory",
];
