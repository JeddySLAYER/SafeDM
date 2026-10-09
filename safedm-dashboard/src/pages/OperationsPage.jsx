import { useState } from "react";
import {
  ArrowDownToLine,
  Check,
  CloudCog,
  FileClock,
  Gauge,
  RotateCcw,
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
  const [tab, setTab] = useState("model");
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
        subtitle="Activez un modèle, réglez les seuils, puis consultez l’historique. Une seule chose à la fois."
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
        <div className="panel">
          <div className="tabs" role="tablist">
            <Tab id="model" current={tab} onSelect={setTab} icon={RotateCcw} title="Modèle" hint={data.patch.version || "Aucun patch"} />
            <Tab id="policy" current={tab} onSelect={setTab} icon={Gauge} title="Seuils" hint="Politique de décision" />
            <Tab id="aggregation" current={tab} onSelect={setTab} icon={CloudCog} title="Agrégation" hint={data.aggregation.last_run || "Jamais lancée"} />
            <Tab id="history" current={tab} onSelect={setTab} icon={FileClock} title="Historique" hint={`${data.audit.length} actions`} />
          </div>
          {tab === "model" ? <PatchDetails patch={data.patch} busy={actionBusy} onAction={runAction} /> : null}
          {tab === "policy" ? (
            <PolicyForm policy={policy} setPolicy={setPolicy} busy={actionBusy} onSubmit={() => runAction(() => saveTenantPolicy(policy))} />
          ) : null}
          {tab === "aggregation" ? (
            <ActionConfirmation
              title="Dernière exécution"
              value={data.aggregation.last_run || "Jamais"}
              note={data.aggregation.note}
              actionLabel="Demander une agrégation"
              busy={actionBusy}
              onAction={() => runAction(requestAggregation)}
            />
          ) : null}
          {tab === "history" ? <HistoryDetails data={data} /> : null}
        </div>
      ) : !loading ? (
        <EmptyState title="Opérations indisponibles" description={error || "Le serveur n’a pas renvoyé l’état du modèle."} />
      ) : null}
    </div>
  );
}

function Tab({ id, current, onSelect, icon: Icon, title, hint }) {
  const active = current === id;
  return (
    <button type="button" className={active ? "tab active" : "tab"} role="tab" aria-selected={active} onClick={() => onSelect(id)}>
      <Icon size={17} aria-hidden />
      <span>
        <strong>{title}</strong>
        <small>{hint}</small>
      </span>
    </button>
  );
}

function PolicyForm({ policy, setPolicy, busy, onSubmit }) {
  const field = (key, label, props = {}) => <label className="ops-field">{label}<input {...props} value={policy[key]} onChange={(event) => setPolicy({ ...policy, [key]: props.type === "number" ? Number(event.target.value) : event.target.value })} /></label>;
  return <form className="form-grid" onSubmit={(event) => { event.preventDefault(); onSubmit(); }}>
    <p className="panel-note">Une politique est un jeu de seuils pour une entreprise et une région. Elle s’applique quand l’analyse reçoit ce contexte.</p>
    {field("tenant_key", "Entreprise", { required: true, placeholder: "ex. acme" })}
    {field("region", "Région", { required: true, placeholder: "ex. eu-west" })}
    <p className="muted">En dessous de « sûr », le message est plutôt rassurant. À partir de « suspect », il demande une vérification. À partir de « critique », il est traité comme dangereux. La confiance (0 à 1) empêche de prendre un résultat ambigu pour un résultat sûr.</p>
    {field("safe_score", "Sûr", { required: true, type: "number", min: 0, max: 100 })}
    {field("suspicious_score", "Suspect", { required: true, type: "number", min: 0, max: 100 })}
    {field("critical_score", "Critique", { required: true, type: "number", min: 0, max: 100 })}
    {field("escalation_confidence", "Confiance minimale (0–1)", { required: true, type: "number", min: 0, max: 1, step: 0.01 })}
    <div className="form-actions">
      <button className="btn primary" disabled={busy}>{busy ? <span className="btn-spinner" /> : <Check size={16} aria-hidden />} Enregistrer la politique</button>
    </div>
  </form>;
}

function PatchDetails({ patch, busy, onAction }) {
  const [percentage, setPercentage] = useState(
    patch.rollout_percentage > 0 ? patch.rollout_percentage : 5,
  );
  return (
    <>
      <dl className="details-list">
        <div><dt>Version</dt><dd>{patch.version || "Aucune"}</dd></div>
        <div><dt>Statut</dt><dd><Status value={patch.status} /></dd></div>
        <div><dt>Part actuelle</dt><dd>{patch.rollout_percentage ?? 0}%</dd></div>
        <div><dt>Rappel / faux positifs</dt><dd>{patch.recall ?? "N/D"} / {patch.false_positive_rate ?? "N/D"}</dd></div>
      </dl>
      <p className="panel-note">
        Approuver avec 5 % propose la mise à jour à environ un téléphone sur vingt. 100 % la propose à tous. Rollback retire le modèle. Le téléphone demande confirmation, puis affiche « mise à jour en cours ».
      </p>
      {patch.version ? (
        <div className="form-grid">
          <label className="ops-field">
            Pourcentage d’appareils
            <input
              type="number"
              min={1}
              max={100}
              value={percentage}
              onChange={(event) => setPercentage(Number(event.target.value))}
            />
          </label>
          <div className="sheet-actions">
            <button className="btn primary" disabled={busy} onClick={() => onAction(() => approvePatch(patch.version, percentage))}>
              <Check size={16} aria-hidden /> Approuver à {percentage || 0}%
            </button>
            <button className="btn danger" disabled={busy} onClick={() => onAction(() => rollbackPatch(patch.version))}>
              <ArrowDownToLine size={16} aria-hidden /> Rollback
            </button>
          </div>
        </div>
      ) : (
        <EmptyState title="Aucun patch disponible" description="Poussez d’abord un run depuis Entraînement." />
      )}
    </>
  );
}

function ActionConfirmation({ title, value, note, actionLabel, busy, onAction }) {
  return <div className="action-confirmation"><p className="eyebrow">{title}</p><strong>{value}</strong><p className="muted">{note}</p><button className="btn primary" disabled={busy} onClick={onAction}>{busy ? <span className="btn-spinner" /> : <CloudCog size={16} aria-hidden />} {actionLabel}</button></div>;
}

function HistoryDetails({ data }) {
  return <div className="history-stack"><h3>Déploiements</h3>{data.deployments?.length ? <div className="table-wrap"><table><thead><tr><th>Version</th><th>Statut</th><th>Canary</th><th>Approbation</th></tr></thead><tbody>{data.deployments.map((item) => <tr key={item.version}><td>{item.version}</td><td>{item.status}</td><td>{item.rollout_percentage}%</td><td>{item.approved_at || "—"}</td></tr>)}</tbody></table></div> : <EmptyState title="Aucun déploiement" />}<h3>Journal d’audit</h3>{data.audit.length ? <div className="table-wrap"><table><thead><tr><th>Quand</th><th>Admin</th><th>Action</th><th>Ressource</th></tr></thead><tbody>{data.audit.map((entry) => <tr key={entry.id}><td>{entry.created_at}</td><td>{entry.username}</td><td>{entry.action}</td><td>{entry.resource}</td></tr>)}</tbody></table></div> : <EmptyState title="Aucun accès journalisé" />}</div>;
}

