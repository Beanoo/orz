# Demo Script

1. Start the platform:

   ```bash
   npm run dev
   ```

2. Open `http://127.0.0.1:5173`.
3. Use the sample PM requirement:

   ```text
   文章支持封面图，新建/编辑文章时可以填 URL，列表和详情页展示。
   ```

4. Click `创建交付`.
5. Review:
   - Requirement DSL
   - clarification questions and defaults
   - `recipe.article-field-extension`
   - Atomic Skill DAG
   - module targets
   - `Article.coverImage` consistency contract
6. Click `Approve`.
7. Confirm Conduiteg receives:
   - backend model, migration, and controller changes
   - frontend service, form, list, detail, and CSS changes
   - `docs/e2e-deliveries/<delivery>.md`
   - verification result
   - branch and commit hash

The current verified Conduiteg demo commit is:

```text
4a4fe21 docs(e2e): Article.coverImage 跨栈交付
```
