# ORZ L2/L3 Super Individual

ORZ is a local full-stack delivery harness for `git@github.com:Beanoo/Conduiteg.git`.
It turns a PM requirement into a recoverable delivery session with Requirement DSL,
Atomic Skill DAG, repository facts, cross-stack consistency contracts, verification
evidence, Git delivery, and memory.

The implementation follows Anthropic's long-running agent harness principles:

- Keep durable state outside model context: JSON sessions, JSONL events, memory records, and Git commits.
- Split initializer work from coding work: the orchestrator structures a session, then each stage advances a verifiable capability.
- Persist evidence at every stage so work can resume after context loss.
- Prefer reusable Atomic Skills and recipes over one-off requirement-specific agents.
- Operate on the real Conduiteg repository and refuse unsafe target workspaces.

## Run

```bash
npm install
npm run dev
```

- Frontend: `http://127.0.0.1:5173`
- API: `http://127.0.0.1:8787`

Useful checks:

```bash
npm run check
npm run build
```

## Configuration

```bash
SYSTEM_REPOSITORY=git@github.com:Beanoo/orz.git
TARGET_REPOSITORY=git@github.com:Beanoo/Conduiteg.git
TARGET_PATH=/Users/doumengyao/work/Conduiteg
CODEX_COMMAND=codex
CODEX_MODEL=local-codex
CODEX_MODEL_ENABLED=0
CODEX_MODEL_TIMEOUT_MS=120000
```

## Delivery Flow

1. `clarify`: detect ambiguity, missing acceptance criteria, and contradictions.
2. `plan`: build Requirement DSL, recipe hit, and Atomic Skill DAG.
3. `locate`: index Conduiteg and locate backend/frontend/test targets.
4. `generate`: produce an implementation plan through the model adapter or deterministic fallback.
5. `apply`: write the Article.coverImage L2 patch and delivery evidence to Conduiteg.
6. `verify`: run target repository verification commands.
7. `commit`: commit all changed delivery files on an `e2e/...` branch.
8. `memory`: persist reusable decisions and verification evidence.

The first implemented L2 delivery is:

> 文章支持封面图，新建/编辑文章时可以填 URL，列表和详情页展示。

It propagates `Article.coverImage` through Sequelize model/migration, Express
controller, frontend service, editor form, article previews, article detail view,
and delivery evidence.
