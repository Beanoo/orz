import React, { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import { CheckCircle2, GitBranch, Play, RefreshCw, ShieldAlert, Sparkles, XCircle } from "lucide-react";
import type { DeliverySession, ProjectState, RepositorySnapshot, SkillManifest, StageName } from "../shared/domain";
import { approveDelivery, createDelivery, getProject, getRepository, getSkills, replayDelivery } from "./api";
import "./styles.css";

const sampleRequirement = "文章支持封面图，新建/编辑文章时可以填 URL，列表和详情页展示。";

function App() {
  const [project, setProject] = useState<ProjectState>();
  const [repository, setRepository] = useState<RepositorySnapshot>();
  const [skills, setSkills] = useState<SkillManifest[]>([]);
  const [deliveries, setDeliveries] = useState<DeliverySession[]>([]);
  const [selected, setSelected] = useState<DeliverySession>();
  const [requirement, setRequirement] = useState(sampleRequirement);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  async function refresh() {
    const [projectResult, repositoryResult, skillsResult] = await Promise.all([getProject(), getRepository(), getSkills()]);
    setProject(projectResult.project);
    setDeliveries(projectResult.deliveries);
    setSelected((current) => projectResult.deliveries.find((delivery) => delivery.id === current?.id) ?? projectResult.deliveries[0]);
    setRepository(repositoryResult.repository);
    setSkills(skillsResult.skills);
  }

  useEffect(() => {
    refresh().catch((err: Error) => setError(err.message));
  }, []);

  async function runCreate() {
    await run(async () => {
      const result = await createDelivery(requirement);
      setSelected(result.delivery);
      await refresh();
      setSelected(result.delivery);
    });
  }

  async function runApprove() {
    if (!selected) return;
    await run(async () => {
      const result = await approveDelivery(selected.id);
      setSelected(result.delivery);
      await refresh();
      setSelected(result.delivery);
    });
  }

  async function runReplay(stage: StageName) {
    if (!selected) return;
    await run(async () => {
      const result = await replayDelivery(selected.id, stage);
      setSelected(result.delivery);
      await refresh();
      setSelected(result.delivery);
    });
  }

  async function run(action: () => Promise<void>) {
    setBusy(true);
    setError(undefined);
    try {
      await action();
    } catch (err) {
      setError(err instanceof Error ? err.message : "操作失败");
    } finally {
      setBusy(false);
    }
  }

  const selectedSkillIds = useMemo(() => new Set(selected?.skillDag.map((node) => node.skillId) ?? []), [selected]);

  return (
    <main className="shell">
      <header className="topbar">
        <div>
          <h1>ORZ Super Individual</h1>
          <p>面向 Conduiteg 的 L2/L3 全栈交付控制台</p>
        </div>
        <button className="iconButton" onClick={() => refresh()} disabled={busy} title="刷新">
          <RefreshCw size={18} />
        </button>
      </header>

      {error ? <div className="banner danger">{error}</div> : null}

      <section className="layout">
        <aside className="panel sidebar">
          <div className="sectionHeader">
            <h2>交付会话</h2>
            <span>{deliveries.length}</span>
          </div>
          <div className="deliveryList">
            {deliveries.map((delivery) => (
              <button
                key={delivery.id}
                className={delivery.id === selected?.id ? "deliveryItem active" : "deliveryItem"}
                onClick={() => setSelected(delivery)}
              >
                <strong>{delivery.title}</strong>
                <span>{delivery.status}</span>
              </button>
            ))}
          </div>
        </aside>

        <section className="workspace">
          <div className="panel inputPanel">
            <div className="field">
              <label htmlFor="requirement">PM 需求</label>
              <textarea id="requirement" value={requirement} onChange={(event) => setRequirement(event.target.value)} />
            </div>
            <div className="actions">
              <button className="primary" onClick={runCreate} disabled={busy}>
                <Sparkles size={16} />
                创建交付
              </button>
              <button onClick={runApprove} disabled={busy || !selected}>
                <Play size={16} />
                Approve
              </button>
            </div>
          </div>

          <ProjectStrip project={project} repository={repository} />
          {selected ? (
            <>
              <StageTimeline delivery={selected} onReplay={runReplay} disabled={busy} />
              <DeliveryDetail delivery={selected} />
              <SkillPanel skills={skills} selectedSkillIds={selectedSkillIds} />
            </>
          ) : (
            <div className="empty">创建或选择一个交付会话。</div>
          )}
        </section>
      </section>
    </main>
  );
}

function ProjectStrip({ project, repository }: { project?: ProjectState; repository?: RepositorySnapshot }) {
  return (
    <section className="strip">
      <div>
        <span>目标仓</span>
        <strong>{project?.targetRepository ?? "-"}</strong>
      </div>
      <div>
        <span>本地路径</span>
        <strong>{project?.targetPath ?? "-"}</strong>
      </div>
      <div>
        <span>分支</span>
        <strong>{repository?.branch ?? "-"}</strong>
      </div>
      <div>
        <span>工作区</span>
        <strong>{repository?.isClean ? "clean" : "dirty"}</strong>
      </div>
    </section>
  );
}

function StageTimeline({
  delivery,
  disabled,
  onReplay,
}: {
  delivery: DeliverySession;
  disabled: boolean;
  onReplay: (stage: StageName) => void;
}) {
  const stages: StageName[] = ["clarify", "plan", "locate", "generate", "apply", "verify", "commit", "memory"];
  return (
    <section className="panel">
      <div className="sectionHeader">
        <h2>阶段状态</h2>
        <span>{delivery.status}</span>
      </div>
      <div className="timeline">
        {stages.map((stage) => {
          const event = [...delivery.events].reverse().find((item) => item.stage === stage);
          return (
            <div key={stage} className={`stage ${event?.status ?? "pending"}`}>
              <div className="stageTop">
                <strong>{stage}</strong>
                {event?.status === "passed" ? <CheckCircle2 size={16} /> : event?.status === "failed" ? <XCircle size={16} /> : null}
              </div>
              <p>{event?.message ?? "pending"}</p>
              {["plan", "locate", "generate", "verify"].includes(stage) ? (
                <button className="small" onClick={() => onReplay(stage)} disabled={disabled}>
                  Replay
                </button>
              ) : null}
            </div>
          );
        })}
      </div>
    </section>
  );
}

function DeliveryDetail({ delivery }: { delivery: DeliverySession }) {
  return (
    <section className="grid">
      <div className="panel">
        <div className="sectionHeader">
          <h2>Requirement DSL</h2>
          <span>{delivery.dsl.status}</span>
        </div>
        <pre>{JSON.stringify(delivery.dsl, null, 2)}</pre>
      </div>

      <div className="panel">
        <div className="sectionHeader">
          <h2>澄清问题</h2>
          <span>{delivery.clarificationQuestions.length}</span>
        </div>
        {delivery.clarificationQuestions.map((question) => (
          <div className="row" key={question.id}>
            <strong>{question.question}</strong>
            <span>{question.defaultAnswer ?? question.reason}</span>
          </div>
        ))}
      </div>

      <div className="panel">
        <div className="sectionHeader">
          <h2>模块定位</h2>
          <span>{delivery.moduleTargets.length}</span>
        </div>
        {delivery.moduleTargets.map((target) => (
          <div className="row" key={target.file}>
            <strong>{target.file}</strong>
            <span>{target.exists ? "exists" : "missing"} · {target.reason}</span>
          </div>
        ))}
      </div>

      <div className="panel">
        <div className="sectionHeader">
          <h2>一致性合约</h2>
          <span>{delivery.consistencyContracts[0]?.status ?? "none"}</span>
        </div>
        {delivery.consistencyContracts.flatMap((contract) =>
          contract.propagationTargets.map((target) => (
            <div className="row" key={`${contract.id}-${target.file}-${target.kind}`}>
              <strong>{target.kind}: {target.file}</strong>
              <span>{target.present ? "present" : "missing"} · {target.expectation}</span>
            </div>
          )),
        )}
      </div>

      <div className="panel">
        <div className="sectionHeader">
          <h2>Git 证据</h2>
          {delivery.git.safeToOperate ? <GitBranch size={16} /> : <ShieldAlert size={16} />}
        </div>
        <div className="row"><strong>remote</strong><span>{delivery.git.remote}</span></div>
        <div className="row"><strong>branch</strong><span>{delivery.git.branch ?? "-"}</span></div>
        <div className="row"><strong>commit</strong><span>{delivery.git.commitHash ?? "-"}</span></div>
        <div className="row"><strong>changed</strong><span>{delivery.git.changedFiles.join(", ") || "-"}</span></div>
        {delivery.git.refusalReason ? <div className="banner danger">{delivery.git.refusalReason}</div> : null}
      </div>

      <div className="panel">
        <div className="sectionHeader">
          <h2>验证 / 指标</h2>
          <span>{delivery.verificationResults.length} checks</span>
        </div>
        {delivery.verificationResults.map((result) => (
          <div className="row" key={result.command}>
            <strong>{result.command}</strong>
            <span>{result.status} · {result.durationMs ?? 0}ms</span>
          </div>
        ))}
        {delivery.aiMetrics.map((metric) => (
          <div className="row" key={`${metric.purpose}-${metric.createdAt}`}>
            <strong>{metric.purpose}</strong>
            <span>{metric.model} · {metric.status} · {metric.inputTokens}/{metric.outputTokens} tokens</span>
          </div>
        ))}
      </div>
    </section>
  );
}

function SkillPanel({ skills, selectedSkillIds }: { skills: SkillManifest[]; selectedSkillIds: Set<string> }) {
  return (
    <section className="panel">
      <div className="sectionHeader">
        <h2>Atomic Skills</h2>
        <span>{selectedSkillIds.size} selected</span>
      </div>
      <div className="skillGrid">
        {skills.map((skill) => (
          <div key={skill.id} className={selectedSkillIds.has(skill.id) ? "skill active" : "skill"}>
            <strong>{skill.name}</strong>
            <span>{skill.capability}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

createRoot(document.getElementById("root")!).render(<App />);
