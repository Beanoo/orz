import fs from "node:fs/promises";
import path from "node:path";
import type { RepositorySnapshot } from "../../shared/domain";
import { runCommand } from "./shell";

const importantPatterns = [
  "backend/models/Article.js",
  "backend/migrations/20220129140808-create-article.js",
  "backend/controllers/articles.js",
  "frontend/src/services/setArticle.js",
  "frontend/src/routes/ArticleEditor.jsx",
  "frontend/src/components/ArticleEditorForm/ArticleEditorForm.jsx",
  "frontend/src/components/ArticlesPreview/ArticlesPreview.jsx",
  "frontend/src/routes/Article/Article.jsx",
  "frontend/src/App.jsx",
  "package.json",
];

export async function buildRepositorySnapshot(targetPath: string): Promise<RepositorySnapshot> {
  const [remote, branchResult, statusResult, packageScripts, importantFiles] = await Promise.all([
    runCommand("git", ["config", "--get", "remote.origin.url"], targetPath),
    runCommand("git", ["branch", "--show-current"], targetPath),
    runCommand("git", ["status", "--porcelain"], targetPath),
    readPackageScripts(targetPath),
    resolveImportantFiles(targetPath),
  ]);

  return {
    path: targetPath,
    remote: remote.output.trim(),
    branch: branchResult.output.trim(),
    isClean: statusResult.output.trim().length === 0,
    packageScripts,
    importantFiles,
    indexedAt: new Date().toISOString(),
  };
}

async function readPackageScripts(targetPath: string): Promise<Record<string, string>> {
  try {
    const pkg = JSON.parse(await fs.readFile(path.join(targetPath, "package.json"), "utf8")) as {
      scripts?: Record<string, string>;
    };
    return pkg.scripts ?? {};
  } catch {
    return {};
  }
}

async function resolveImportantFiles(targetPath: string): Promise<string[]> {
  const found: string[] = [];
  for (const relative of importantPatterns) {
    try {
      await fs.access(path.join(targetPath, relative));
      found.push(relative);
    } catch {
      // Missing expected files are represented in ModuleTarget.exists instead.
    }
  }
  return found;
}
