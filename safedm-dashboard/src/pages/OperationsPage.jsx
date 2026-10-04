import { useState } from "react";
import {
  Activity,
  Archive,
  ArrowDownToLine,
  Check,
  ChevronRight,
  ClipboardList,
  CloudCog,
  FileClock,
  Gauge,
  History,
  RotateCcw,
  Settings2,
  SlidersHorizontal,
  X,
} from "lucide-react";
import {
  Alert,
  EmptyState,
  Freshness,
  PageHeader,
  SkeletonTable,
  Spinner,
} from "../components/ui";
import { useOperationsOverview } from "../hooks/useOperationsOverview";
import {
  approvePatch,
  requestAggregation,
  rollbackPatch,
  saveTenantPolicy,
} from "../services/adminApi";

function Status({ value }) {
  const ok = ["ok", "ready", "canary", "configured"].includes(value);
  return <span className={`health-badge ${ok ? "ok" : "warn"}`}>{value || "N/D"}</span>;
}

export default function OperationsPage() {
  const { data, error, loading, refreshing, updatedAt, refresh } = useOperationsOverview();
  const [sheet, setSheet] = useState(null);
  const [actionError, setActionError] = useState("");
  const [actionBusy, setActionBusy] = useState(false);
  const [policy, setPolicy] = useState({
    tenant_key: "",
    region: "global",
    safe_score: 35,
    suspicious_score: 65,
    critical_score: 85,
    escalation_confidence: 0.65,
  });

  async function runAction(action) {
    setActionBusy(true);
    setActionError("");
    try {
      await action();
      await refresh();
      setSheet(null);
    } catch (err) {
      setActionError(err.message);
    } finally {
      setActionBusy(false);
    }
  }

  if (loading && !data) {
    return (
      <div>
        <PageHeader title="Opérations" subtitle="Pilotez les changements sensibles de SafeDM." />
        <Spinner label="Chargement des opérations…" />
        <SkeletonTable rows={6} columns={2} />
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Opérations"
        subtitle="Pilotez les modèles, les seuils et la conformité depuis un seul espace."
        actions={
          <>
            <Freshness updatedAt={updatedAt} refreshing={refreshing} />
            <button className="btn" type="button" onClick={refresh} disabled={refreshing}>
              {refreshing ? <span className="btn-spinner" /> : null} Actualiser
            </button>
          </>
        }
      />
      <Alert>{error}</Alert>
      <Alert>{actionError}</Alert>
      {data ? (
        <>
          <section className="ops-hero">
            <div>
              <p className="eyebrow">Centre de contrôle</p>
              <h2>État du système</h2>
              <p className="muted">Les actions sensibles demandent une confirmation dans un panneau dédié.</p>
            </div>
            <Status value={data.patch.status} />
          </section>

          <div className="ops-summary-grid">
            <SummaryCard icon={Activity} label="Patch actif" value={data.patch.version || "Aucun"} note={`${data.patch.rollout_percentage ?? 0}% du trafic en canary`} />
            <SummaryCard icon={CloudCog} label="Agrégation" value={data.aggregation.last_run || "Jamais"} note={data.aggregation.source || "Source inconnue"} />
            <SummaryCard icon={Gauge} label="Seuils globaux" value={formatThresholds(data.policy.thresholds)} note="Valeurs de secours de l’API" />
            <SummaryCard icon={Archive} label="Rétention" value={`${data.retention.candidate_count ?? 0} candidats`} note={`${data.retention.inactive_months} mois d’inactivité`} />
          </div>

          <section className="panel ops-actions-panel">
            <div className="section-heading">
              <div>
                <p className="eyebrow">Actions rapides</p>
                <h2>Que voulez-vous gérer ?</h2>
              </div>
              <Settings2 size={21} aria-hidden />
            </div>
            <div className="ops-action-grid">
              <ActionRow icon={SlidersHorizontal} title="Politique de décision" description="Modifier les seuils par entreprise et région." onClick={() => setSheet("policy")} />
              <ActionRow icon={CloudCog} title="Cycle d’agrégation" description="Demander la préparation des métriques anonymisées." onClick={() => setSheet("aggregation")} />
              <ActionRow icon={RotateCcw} title="Déploiement du modèle" description="Approuver ou annuler le patch actuellement en canary." onClick={() => setSheet("patch")} />
              <ActionRow icon={FileClock} title="Historique et audit" description="Consulter les déploiements et les actions récentes." onClick={() => setSheet("history")} />
            </div>
          </section>

          <section className="grid-2 ops-lower-grid">
            <div className="panel">
              <div className="section-heading">
                <div><p className="eyebrow">Surveillance</p><h2>Conformité & rétention</h2></div>
                <Status value={data.retention.status} />
              </div>
              <dl className="details-list">
                <div><dt>Signatures candidates</dt><dd>{data.retention.candidate_count ?? 0}</dd></div>
                <div><dt>Dernier audit</dt><dd>{data.retention.last_audit || "N/D"}</dd></div>
              </dl>
              <p className="muted compact-note">{data.retention.note}</p>
            </div>
            <div className="panel">
              <div className="section-heading">
                <div><p className="eyebrow">Dernière activité</p><h2>Journal d’audit</h2></div>
                <ClipboardList size={21} aria-hidden />
              </div>
              {data.audit.length ? (
                <div className="audit-preview">
                  {data.audit.slice(0, 3).map((entry) => (
                    <div className="audit-preview-row" key={entry.id}>
                      <span>{entry.action}</span><small>{entry.username} · {entry.created_at}</small>
                    </div>
                  ))}
                  <button type="button" className="btn small ghost" onClick={() => setSheet("history")}>Voir tout l’historique</button>
                </div>
              ) : <EmptyState title="Aucun accès journalisé" />}
            </div>
          </section>
        </>
      ) : null}
      {sheet ? (
        <OperationsSheet
          type={sheet}
          data={data}
          policy={policy}
          setPolicy={setPolicy}
          busy={actionBusy}
          onClose={() => setSheet(null)}
          onAction={runAction}
        />
      ) : null}
    </div>
  );
}

function SummaryCard({ icon: Icon, label, value, note }) {
  return <div className="ops-summary-card"><Icon size={19} aria-hidden /><p className="eyebrow">{label}</p><strong>{value}</strong><span>{note}</span></div>;
}

function ActionRow({ icon: Icon, title, description, onClick }) {
  return <button type="button" className="ops-action-row" onClick={onClick}><Icon size={19} aria-hidden /><span><strong>{title}</strong><small>{description}</small></span><ChevronRight size={18} aria-hidden /></button>;
}

function OperationsSheet({ type, data, policy, setPolicy, busy, onClose, onAction }) {
  const content = {
    policy: {
      icon: SlidersHorizontal,
      title: "Politique de décision",
      subtitle: "Enregistrez une politique tenant/région ; elle sera appliquée quand ce contexte sera fourni à l’analyse.",
    },
    aggregation: {
      icon: CloudCog,
      title: "Cycle d’agrégation",
      subtitle: "Préparez des métriques anonymisées pour le prochain cycle de modèle.",
    },
    patch: {
      icon: RotateCcw,
      title: "Déploiement du modèle",
      subtitle: "Vérifiez le patch avant de l’approuver ou de revenir en arrière.",
    },
    history: {
      icon: History,
      title: "Historique et audit",
      subtitle: "Les dernières actions administratives et opérations de déploiement.",
    },
  }[type];
  const Icon = content.icon;
  return (
    <div className="sheet-backdrop" role="presentation" onMouseDown={onClose}>
      <aside className="help-sheet operations-sheet" role="dialog" aria-modal="true" onMouseDown={(event) => event.stopPropagation()}>
        <header className="help-sheet-header">
          <div className="ops-sheet-title"><Icon size={20} aria-hidden /><div><p className="eyebrow">Opérations</p><h2>{content.title}</h2><p className="muted">{content.subtitle}</p></div></div>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Fermer"><X size={18} aria-hidden /></button>
        </header>
        <div className="help-sheet-body">
          {type === "policy" ? <PolicyForm policy={policy} setPolicy={setPolicy} busy={busy} onSubmit={() => onAction(() => saveTenantPolicy(policy))} /> : null}
          {type === "aggregation" ? <ActionConfirmation title="Dernière exécution" value={data.aggregation.last_run || "Jamais"} note={data.aggregation.note} actionLabel="Demander une agrégation" busy={busy} onAction={() => onAction(requestAggregation)} /> : null}
          {type === "patch" ? <PatchDetails patch={data.patch} busy={busy} onAction={onAction} /> : null}
          {type === "history" ? <HistoryDetails data={data} /> : null}
        </div>
      </aside>
    </div>
  );
}

function PolicyForm({ policy, setPolicy, busy, onSubmit }) {
  const field = (key, label, props = {}) => <label className="ops-field">{label}<input {...props} value={policy[key]} onChange={(event) => setPolicy({ ...policy, [key]: props.type === "number" ? Number(event.target.value) : event.target.value })} /></label>;
  return <form className="ops-policy-form" onSubmit={(event) => { event.preventDefault(); onSubmit(); }}>
    <div className="ops-field-grid">
      {field("tenant_key", "Entreprise", { required: true, placeholder: "ex. acme" })}
      {field("region", "Région", { required: true, placeholder: "ex. eu-west" })}
    </div>
    <div className="threshold-box"><p className="eyebrow">Seuils de score</p><p className="muted">Un score est compris entre 0 et 100. La valeur critique doit être supérieure aux deux autres.</p><div className="ops-field-grid">{field("safe_score", "Sûr", { required: true, type: "number", min: 0, max: 100 })}{field("suspicious_score", "Suspect", { required: true, type: "number", min: 0, max: 100 })}{field("critical_score", "Critique", { required: true, type: "number", min: 0, max: 100 })}{field("escalation_confidence", "Confiance (0–1)", { required: true, type: "number", min: 0, max: 1, step: 0.01 })}</div></div>
    <button className="btn primary" disabled={busy}>{busy ? <span className="btn-spinner" /> : <Check size={16} aria-hidden />} Enregistrer la politique</button>
  </form>;
}

function PatchDetails({ patch, busy, onAction }) {
  return <><dl className="details-list"><div><dt>Version</dt><dd>{patch.version || "Aucune"}</dd></div><div><dt>Statut</dt><dd><Status value={patch.status} /></dd></div><div><dt>Trafic canary</dt><dd>{patch.rollout_percentage ?? 0}%</dd></div><div><dt>Rappel / faux positifs</dt><dd>{patch.recall ?? "N/D"} / {patch.false_positive_rate ?? "N/D"}</dd></div></dl>{patch.version ? <div className="sheet-actions"><button className="btn primary" disabled={busy} onClick={() => onAction(() => approvePatch(patch.version))}><Check size={16} aria-hidden /> Approuver</button><button className="btn danger" disabled={busy} onClick={() => onAction(() => rollbackPatch(patch.version))}><ArrowDownToLine size={16} aria-hidden /> Rollback</button></div> : <EmptyState title="Aucun patch disponible" />}</>;
}

function ActionConfirmation({ title, value, note, actionLabel, busy, onAction }) {
  return <div className="action-confirmation"><p className="eyebrow">{title}</p><strong>{value}</strong><p className="muted">{note}</p><button className="btn primary" disabled={busy} onClick={onAction}>{busy ? <span className="btn-spinner" /> : <CloudCog size={16} aria-hidden />} {actionLabel}</button></div>;
}

function HistoryDetails({ data }) {
  return <div className="history-stack"><h3>Déploiements</h3>{data.deployments?.length ? <div className="table-wrap"><table><thead><tr><th>Version</th><th>Statut</th><th>Canary</th><th>Approbation</th></tr></thead><tbody>{data.deployments.map((item) => <tr key={item.version}><td>{item.version}</td><td>{item.status}</td><td>{item.rollout_percentage}%</td><td>{item.approved_at || "—"}</td></tr>)}</tbody></table></div> : <EmptyState title="Aucun déploiement" />}<h3>Journal d’audit</h3>{data.audit.length ? <div className="table-wrap"><table><thead><tr><th>Quand</th><th>Admin</th><th>Action</th><th>Ressource</th></tr></thead><tbody>{data.audit.map((entry) => <tr key={entry.id}><td>{entry.created_at}</td><td>{entry.username}</td><td>{entry.action}</td><td>{entry.resource}</td></tr>)}</tbody></table></div> : <EmptyState title="Aucun accès journalisé" />}</div>;
}

function formatThresholds(thresholds) {
  if (!thresholds) return "Non configurés";
  const values = Object.values(thresholds);
  return values.length ? values.join(" / ") : "Non configurés";
}
