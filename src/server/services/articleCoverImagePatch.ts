import fs from "node:fs/promises";
import path from "node:path";
import { config } from "./config";

export async function applyArticleCoverImagePatch(): Promise<string[]> {
  const changed: string[] = [];
  changed.push(
    ...(await patchFile("backend/models/Article.js", [
      {
        find: "      body: DataTypes.TEXT,\n",
        replace: "      body: DataTypes.TEXT,\n      coverImage: DataTypes.STRING,\n",
      },
    ])),
  );
  changed.push(
    ...(await patchFile("backend/migrations/20220129140808-create-article.js", [
      {
        find: "      body: {\n        type: Sequelize.TEXT,\n      },\n",
        replace: "      body: {\n        type: Sequelize.TEXT,\n      },\n      coverImage: {\n        type: Sequelize.STRING,\n        allowNull: true,\n      },\n",
      },
    ])),
  );
  changed.push(
    ...(await patchFile("backend/controllers/articles.js", [
      {
        find: "    const { title, description, body, tagList } = req.body.article;\n",
        replace: "    const { title, description, body, coverImage, tagList } = req.body.article;\n",
      },
      {
        find: "      body: body,\n    });\n",
        replace: "      body: body,\n      coverImage: coverImage || null,\n    });\n",
      },
      {
        find: "    const { title, description, body } = req.body.article;\n",
        replace: "    const { title, description, body, coverImage } = req.body.article;\n",
      },
      {
        find: "    if (body) article.body = body;\n    await article.save();\n",
        replace:
          "    if (body) article.body = body;\n    if (Object.prototype.hasOwnProperty.call(req.body.article, \"coverImage\")) {\n      article.coverImage = coverImage || null;\n    }\n    await article.save();\n",
      },
    ])),
  );
  changed.push(
    ...(await patchFile("frontend/src/services/setArticle.js", [
      {
        find: "async function setArticle({ body, description, headers, slug, tagList, title }) {\n",
        replace: "async function setArticle({ body, coverImage, description, headers, slug, tagList, title }) {\n",
      },
      {
        find: "      data: { article: { title, description, body, tagList } },\n",
        replace: "      data: { article: { title, description, body, coverImage, tagList } },\n",
      },
    ])),
  );
  changed.push(
    ...(await patchFile("frontend/src/components/ArticleEditorForm/ArticleEditorForm.jsx", [
      {
        find: 'const emptyForm = { title: "", description: "", body: "", tagList: "" };\n',
        replace: 'const emptyForm = { title: "", description: "", body: "", coverImage: "", tagList: "" };\n',
      },
      {
        find: "  const [{ title, description, body, tagList }, setForm] = useState(\n",
        replace: "  const [{ title, description, body, coverImage, tagList }, setForm] = useState(\n",
      },
      {
        find: "      .then(({ author: { username }, body, description, tagList, title }) => {\n",
        replace: "      .then(({ author: { username }, body, coverImage, description, tagList, title }) => {\n",
      },
      {
        find: "        setForm({ body, description, tagList, title });\n",
        replace: "        setForm({ body, coverImage: coverImage || \"\", description, tagList, title });\n",
      },
      {
        find: "    setArticle({ headers, slug, body, description, tagList, title })\n",
        replace: "    setArticle({ headers, slug, body, coverImage, description, tagList, title })\n",
      },
      {
        find: "        <fieldset className=\"form-group\">\n          <textarea\n",
        replace:
          "        <FormFieldset\n          normal\n          placeholder=\"Cover image URL\"\n          name=\"coverImage\"\n          value={coverImage}\n          handler={inputHandler}\n        ></FormFieldset>\n\n        <fieldset className=\"form-group\">\n          <textarea\n",
      },
    ])),
  );
  changed.push(
    ...(await patchFile("frontend/src/components/ArticlesPreview/ArticlesPreview.jsx", [
      {
        find: "            <h1>{article.title}</h1>\n            <p>{article.description}</p>\n",
        replace:
          "            {article.coverImage && (\n              <img\n                className=\"article-cover-image article-cover-image-preview\"\n                src={article.coverImage}\n                alt=\"\"\n              />\n            )}\n            <h1>{article.title}</h1>\n            <p>{article.description}</p>\n",
      },
    ])),
  );
  changed.push(
    ...(await patchFile("frontend/src/routes/Article/Article.jsx", [
      {
        find: "  const { title, body, tagList, createdAt, author } = article || {};\n",
        replace: "  const { title, body, coverImage, tagList, createdAt, author } = article || {};\n",
      },
      {
        find: "            {body && <Markdown options={{ forceBlock: true }}>{body}</Markdown>}\n",
        replace:
          "            {coverImage && (\n              <img\n                className=\"article-cover-image article-cover-image-detail\"\n                src={coverImage}\n                alt=\"\"\n              />\n            )}\n            {body && <Markdown options={{ forceBlock: true }}>{body}</Markdown>}\n",
      },
    ])),
  );
  changed.push(
    ...(await patchFile("frontend/src/styles.css", [
      {
        find: "\nfooter {\n",
        replace:
          "\n.article-cover-image {\n  display: block;\n  width: 100%;\n  object-fit: cover;\n  background: #f3f3f3;\n}\n\n.article-cover-image-preview {\n  max-height: 220px;\n  margin-bottom: 1rem;\n}\n\n.article-cover-image-detail {\n  max-height: 420px;\n  margin-bottom: 1.5rem;\n}\n\nfooter {\n",
      },
    ])),
  );
  return [...new Set(changed)];
}

async function patchFile(relativePath: string, replacements: Array<{ find: string; replace: string }>): Promise<string[]> {
  const file = path.join(config.targetPath, relativePath);
  let source = await fs.readFile(file, "utf8");
  const original = source;
  for (const replacement of replacements) {
    if (!source.includes(replacement.replace) && source.includes(replacement.find)) {
      source = source.replace(replacement.find, replacement.replace);
    }
  }
  if (source !== original) {
    await fs.writeFile(file, source);
    return [relativePath];
  }
  return [];
}
