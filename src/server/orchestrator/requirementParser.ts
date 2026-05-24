import type { ClarificationQuestion, RequirementDsl, RequirementIntent } from "../../shared/domain";
import { callModel } from "../services/modelAdapter";

const articleWords = ["文章", "article", "Article"];
const coverWords = ["封面", "cover", "coverImage", "image"];

export function parseRequirement(rawInput: string, targetRepository: string): {
  dsl: RequirementDsl;
  questions: ClarificationQuestion[];
} {
  const normalized = rawInput.trim();
  const hasArticle = articleWords.some((word) => normalized.includes(word));
  const hasCover = coverWords.some((word) => normalized.includes(word));
  const asksPersistence = /保存|持久|新建|编辑|create|update/i.test(normalized);
  const asksApi = /API|接口|返回|提交|载荷|payload/i.test(normalized) || asksPersistence;
  const asksForm = /表单|新建|编辑|输入|form/i.test(normalized);
  const asksRendering = /列表|详情|展示|显示|render|view/i.test(normalized);
  const contradictory = /匿名.*禁止.*身份|禁止.*持久身份.*幂等|contradict/i.test(normalized);
  const field = hasCover ? "coverImage" : undefined;
  const entity = hasArticle ? "Article" : undefined;
  const intents: RequirementIntent[] = [];

  if (entity && field) {
    intents.push({
      id: "intent-add-field",
      kind: "add-field",
      entity,
      field,
      acceptance: [`${entity}.${field} 在持久化模型中存在且兼容旧数据`],
    });
  }
  if (asksPersistence && entity && field) {
    intents.push({
      id: "intent-persist-data",
      kind: "persist-data",
      entity,
      field,
      acceptance: ["新建和编辑路径都能保存字段值"],
    });
  }
  if (asksApi && entity && field) {
    intents.push({
      id: "intent-expose-api",
      kind: "expose-api",
      entity,
      field,
      acceptance: ["读写 API 都传递字段，响应序列化包含该字段"],
    });
  }
  if (asksForm && entity && field) {
    intents.push({
      id: "intent-edit-form",
      kind: "edit-form",
      entity,
      field,
      acceptance: ["新建和编辑表单可以输入 URL 并回填已有值"],
    });
  }
  if (asksRendering && entity && field) {
    intents.push({
      id: "intent-render-view",
      kind: "render-view",
      entity,
      field,
      acceptance: ["列表和详情页展示封面图，空值保持兼容"],
    });
  }
  if (entity && field) {
    intents.push({
      id: "intent-test-contract",
      kind: "test-contract",
      entity,
      field,
      acceptance: ["契约测试或验证证据覆盖字段跨栈传播"],
    });
  }

  const questions: ClarificationQuestion[] = [];
  if (!normalized) {
    questions.push({
      id: "q-empty-requirement",
      priority: "must",
      question: "请输入要交付的产品需求。",
      reason: "空需求无法生成 DSL、Skill DAG 或验收标准。",
    });
  }
  if (entity && field && !/隐藏|占位|默认|空|兼容/.test(normalized)) {
    questions.push({
      id: "q-empty-cover-image",
      priority: "should",
      question: "旧文章没有封面图时，列表和详情页是隐藏图片区域还是展示占位？",
      reason: "空值展示规则会影响前端渲染和契约测试。",
      defaultAnswer: "隐藏图片区域，并保持原有布局不报错。",
    });
  }
  if (entity && field && !/校验|URL|格式|图片格式/.test(normalized)) {
    questions.push({
      id: "q-url-validation",
      priority: "should",
      question: "封面图 URL 只按字符串保存，还是需要校验图片 URL 格式？",
      reason: "校验策略会影响表单、API 错误处理和测试。",
      defaultAnswer: "第一阶段只按可选字符串保存，不做强格式校验。",
    });
  }

  const title = entity && field ? `${entity}.${field} 跨栈交付` : "全栈需求交付";
  const status = contradictory ? "contradictory" : questions.some((q) => q.priority === "must") ? "needs-clarification" : "ready";

  const dsl: RequirementDsl = {
    id: `dsl-${Date.now()}`,
    title,
    rawInput,
    status,
    role: "PM",
    targetRepository,
    intents,
    assumptions: questions.flatMap((question) => (question.defaultAnswer ? [question.defaultAnswer] : [])),
    contradictions: contradictory ? ["需求同时要求不可识别用户身份，又要求跨请求幂等，缺少可执行身份键。"] : [],
    acceptanceCriteria: intents.flatMap((intent) => intent.acceptance),
  };

  return { dsl, questions };
}

export async function parseRequirementWithModel(rawInput: string, targetRepository: string): Promise<{
  dsl: RequirementDsl;
  questions: ClarificationQuestion[];
  metric?: Awaited<ReturnType<typeof callModel>>["metric"];
  source: "model" | "fallback";
}> {
  const fallback = parseRequirement(rawInput, targetRepository);
  const prompt = [
    "把下面 PM 需求抽取成机器可读交付 DSL。",
    "只返回 JSON，不要 markdown。",
    "JSON shape:",
    JSON.stringify(
      {
        title: "short title",
        status: "ready | needs-clarification | contradictory",
        role: "PM",
        intents: [
          {
            id: "intent-1",
            kind: "add-field | persist-data | expose-api | edit-form | render-view | test-contract | verify-delivery",
            entity: "optional domain entity",
            field: "optional field",
            acceptance: ["concrete acceptance criterion"],
          },
        ],
        assumptions: ["safe default assumptions"],
        contradictions: ["blocking contradictions"],
        acceptanceCriteria: ["end-to-end acceptance criteria"],
        clarificationQuestions: [
          {
            id: "q-1",
            priority: "must | should | could",
            question: "question",
            reason: "why it matters",
            defaultAnswer: "optional safe default",
          },
        ],
      },
      null,
      2,
    ),
    "",
    `targetRepository: ${targetRepository}`,
    `rawRequirement: ${rawInput}`,
  ].join("\n");

  const model = await callModel("parse-requirement-dsl", prompt);
  if (model.metric.status !== "passed") {
    return { ...fallback, metric: model.metric, source: "fallback" };
  }

  try {
    const parsed = JSON.parse(stripJsonFence(model.text)) as {
      title?: string;
      status?: RequirementDsl["status"];
      role?: string;
      intents?: RequirementIntent[];
      assumptions?: string[];
      contradictions?: string[];
      acceptanceCriteria?: string[];
      clarificationQuestions?: ClarificationQuestion[];
    };
    const questions = normalizeQuestions(parsed.clarificationQuestions ?? []);
    const dsl: RequirementDsl = {
      id: `dsl-${Date.now()}`,
      title: parsed.title || fallback.dsl.title,
      rawInput,
      status: parsed.status ?? fallback.dsl.status,
      role: parsed.role || "PM",
      targetRepository,
      intents: normalizeIntents(parsed.intents ?? fallback.dsl.intents),
      assumptions: parsed.assumptions ?? fallback.dsl.assumptions,
      contradictions: parsed.contradictions ?? fallback.dsl.contradictions,
      acceptanceCriteria: parsed.acceptanceCriteria ?? fallback.dsl.acceptanceCriteria,
    };
    return { dsl, questions, metric: model.metric, source: "model" };
  } catch {
    return { ...fallback, metric: model.metric, source: "fallback" };
  }
}

function normalizeIntents(intents: RequirementIntent[]): RequirementIntent[] {
  return intents.map((intent, index) => ({
    id: intent.id || `intent-${index + 1}`,
    kind: intent.kind,
    entity: intent.entity,
    field: intent.field,
    acceptance: Array.isArray(intent.acceptance) ? intent.acceptance : [],
  }));
}

function normalizeQuestions(questions: ClarificationQuestion[]): ClarificationQuestion[] {
  return questions.map((question, index) => ({
    id: question.id || `q-${index + 1}`,
    priority: question.priority ?? "should",
    question: question.question,
    reason: question.reason,
    defaultAnswer: question.defaultAnswer,
  }));
}

function stripJsonFence(value: string): string {
  return value
    .trim()
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/i, "");
}
