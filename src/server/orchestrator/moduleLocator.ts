import fs from "node:fs/promises";
import path from "node:path";
import type { ConsistencyContract, ModuleTarget, RequirementDsl } from "../../shared/domain";

const articleTargets: Array<Omit<ModuleTarget, "exists">> = [
  {
    stack: "backend",
    file: "backend/models/Article.js",
    reason: "Article 字段源头模型",
    required: true,
  },
  {
    stack: "backend",
    file: "backend/migrations/20220129140808-create-article.js",
    reason: "Article 初始表结构和兼容迁移策略",
    required: true,
  },
  {
    stack: "backend",
    file: "backend/controllers/articles.js",
    reason: "Article create/update/read API 字段传播",
    required: true,
  },
  {
    stack: "frontend",
    file: "frontend/src/services/setArticle.js",
    reason: "前端提交载荷服务",
    required: true,
  },
  {
    stack: "frontend",
    file: "frontend/src/components/ArticleEditorForm/ArticleEditorForm.jsx",
    reason: "新建和编辑表单",
    required: true,
  },
  {
    stack: "frontend",
    file: "frontend/src/components/ArticlesPreview/ArticlesPreview.jsx",
    reason: "文章列表展示候选文件",
    required: true,
  },
  {
    stack: "frontend",
    file: "frontend/src/routes/Article/Article.jsx",
    reason: "文章详情展示候选文件",
    required: true,
  },
];

export async function locateModules(dsl: RequirementDsl, targetPath: string): Promise<ModuleTarget[]> {
  const hasArticleCover = dsl.intents.some((intent) => intent.entity === "Article" && intent.field === "coverImage");
  const targets = hasArticleCover ? articleTargets : [];
  return Promise.all(
    targets.map(async (target) => ({
      ...target,
      exists: await exists(path.join(targetPath, target.file)),
    })),
  );
}

export function buildConsistencyContracts(dsl: RequirementDsl, targets: ModuleTarget[]): ConsistencyContract[] {
  const hasArticleCover = dsl.intents.some((intent) => intent.entity === "Article" && intent.field === "coverImage");
  if (!hasArticleCover) {
    return [];
  }
  const targetByFile = new Map(targets.map((target) => [target.file, target.exists]));
  const propagationTargets: ConsistencyContract["propagationTargets"] = [
    {
      kind: "model",
      file: "backend/models/Article.js",
      expectation: "定义可选字符串字段 coverImage",
      present: targetByFile.get("backend/models/Article.js") ?? false,
    },
    {
      kind: "migration",
      file: "backend/migrations/20220129140808-create-article.js",
      expectation: "迁移或兼容路径包含 coverImage 字段",
      present: targetByFile.get("backend/migrations/20220129140808-create-article.js") ?? false,
    },
    {
      kind: "controller",
      file: "backend/controllers/articles.js",
      expectation: "create/update/read API 接收并返回 coverImage",
      present: targetByFile.get("backend/controllers/articles.js") ?? false,
    },
    {
      kind: "service",
      file: "frontend/src/services/setArticle.js",
      expectation: "提交载荷包含 coverImage",
      present: targetByFile.get("frontend/src/services/setArticle.js") ?? false,
    },
    {
      kind: "form",
      file: "frontend/src/components/ArticleEditorForm/ArticleEditorForm.jsx",
      expectation: "新建/编辑表单支持 coverImage 输入和回填",
      present: targetByFile.get("frontend/src/components/ArticleEditorForm/ArticleEditorForm.jsx") ?? false,
    },
    {
      kind: "rendering",
      file: "frontend/src/components/ArticlesPreview/ArticlesPreview.jsx",
      expectation: "列表在有 coverImage 时展示图片，空值隐藏",
      present: targetByFile.get("frontend/src/components/ArticlesPreview/ArticlesPreview.jsx") ?? false,
    },
    {
      kind: "rendering",
      file: "frontend/src/routes/Article/Article.jsx",
      expectation: "详情页在有 coverImage 时展示图片，空值隐藏",
      present: targetByFile.get("frontend/src/routes/Article/Article.jsx") ?? false,
    },
  ];
  const missingTargets = propagationTargets.filter((target) => !target.present).map((target) => target.file);
  return [
    {
      id: "contract-article-cover-image",
      sourceField: "Article.coverImage",
      sourceFile: "backend/models/Article.js",
      propagationTargets,
      missingTargets,
      status: missingTargets.length === 0 ? "pending" : "failed",
    },
  ];
}

async function exists(file: string): Promise<boolean> {
  try {
    await fs.access(file);
    return true;
  } catch {
    return false;
  }
}
