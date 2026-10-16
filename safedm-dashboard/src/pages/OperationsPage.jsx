import { useMemo, useState } from "react";
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
  BusyButton,
  EmptyState,
  Freshness,
  PageHeader,
  SkeletonTable,
  Spinner,
} from "../components/ui";
import { useToast } from "../context/ToastContext";
import { useOperationsOverview } from "../hooks/useOperationsOverview";
import {
  approvePatch,
  requestAggregation,
  rollbackPatch,
  saveTenantPolicy,
} from "../services/adminApi";

function Status({ value }) {
  const normalized = String(value || "").toLowerCase();
  const ok = ["ok", "ready", "canary", "configured", "approved", "production", "succeeded"].includes(normalized);
  return <span className={`health-badge ${ok ? "ok" : "warn"}`}>{value || "N/D"}</span>;
}

export default function OperationsPage() {
  const { toast } = useToast();
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

  async function runAction(action, successMessage) {
    setActionBusy(true);
    setActionError("");
    try {
      await action();
      await refresh();
      if (successMessage) toast(successMessage);
    } catch (err) {
      setActionError(err.message);
      toast(err.message, "error");
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
            <BusyButton className="btn" busy={refreshing} busyLabel="Actualisation…" onClick={refresh}>
              Actualiser
            </BusyButton>
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
            <PolicyForm
              policy={policy}
              setPolicy={setPolicy}
              busy={actionBusy}
              savedPolicies={data.policies || []}
              onSubmit={() => runAction(() => saveTenantPolicy(policy), "Politique enregistrée")}
            />
          ) : null}
          {tab === "aggregation" ? (
            <AggregationPanel
              aggregation={data.aggregation}
              runs={data.aggregation_runs || []}
              busy={actionBusy}
              onAction={() => runAction(requestAggregation, "Agrégation terminée")}
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

function PolicyForm({ policy, setPolicy, busy, onSubmit, savedPolicies = [] }) {
  const field = (key, label, props = {}) => (
    <label className="ops-field">
      {label}
      <input
        {...props}
        value={policy[key]}
        onChange={(event) =>
          setPolicy({
            ...policy,
            [key]: props.type === "number" ? Number(event.target.value) : event.target.value,
          })
        }
      />
    </label>
  );
  return (
    <div className="policy-panel">
      <form
        className="form-grid"
        onSubmit={(event) => {
          event.preventDefault();
          onSubmit();
        }}
      >
        <p className="panel-note">
          Une politique fixe les seuils d’analyse cloud pour une entreprise (et sa région). Dès que le client envoie
          ce <code>tenant_key</code> à <code>/analysis</code>, ces seuils remplacent les seuils globaux — utile pour
          être plus strict (ou plus souple) pour certains clients.
        </p>
        {field("tenant_key", "Entreprise", { required: true, placeholder: "ex. acme" })}
        {field("region", "Région", { required: true, placeholder: "ex. eu-west" })}
        <p className="muted">
          En dessous de « sûr », le message est plutôt rassurant. À partir de « suspect », il demande une vérification.
          À partir de « critique », il est traité comme dangereux. La confiance (0 à 1) empêche de prendre un résultat
          ambigu pour un résultat sûr.
        </p>
        {field("safe_score", "Sûr", { required: true, type: "number", min: 0, max: 100 })}
        {field("suspicious_score", "Suspect", { required: true, type: "number", min: 0, max: 100 })}
        {field("critical_score", "Critique", { required: true, type: "number", min: 0, max: 100 })}
        {field("escalation_confidence", "Confiance minimale (0–1)", {
          required: true,
          type: "number",
          min: 0,
          max: 1,
          step: 0.01,
        })}
        <div className="form-actions">
          <BusyButton type="submit" busy={busy} busyLabel="Enregistrement…">
            <Check size={16} aria-hidden /> Enregistrer la politique
          </BusyButton>
        </div>
      </form>
      {savedPolicies.length ? (
        <div className="saved-policies">
          <h3>Politiques enregistrées</h3>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Entreprise</th>
                  <th>Région</th>
                  <th>Sûr</th>
                  <th>Suspect</th>
                  <th>Critique</th>
                  <th>Confiance</th>
                </tr>
              </thead>
              <tbody>
                {savedPolicies.map((item) => (
                  <tr
                    key={item.id}
                    className="clickable-row"
                    onClick={() =>
                      setPolicy({
                        tenant_key: item.tenant_key,
                        region: item.region,
                        safe_score: item.safe_score,
                        suspicious_score: item.suspicious_score,
                        critical_score: item.critical_score,
                        escalation_confidence: item.escalation_confidence,
                      })
                    }
                  >
                    <td>{item.tenant_key}</td>
                    <td>{item.region}</td>
                    <td>{item.safe_score}</td>
                    <td>{item.suspicious_score}</td>
                    <td>{item.critical_score}</td>
                    <td>{item.escalation_confidence}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="muted">Cliquez une ligne pour la modifier.</p>
        </div>
      ) : null}
    </div>
  );
}

function formatRate(value) {
  if (value == null || Number.isNaN(Number(value))) return "N/D";
  return `${(Number(value) * 100).toFixed(1)}%`;
}

function PatchDetails({ patch, busy, onAction }) {
  const defaultPct =
    patch.rollout_percentage > 0
      ? patch.rollout_percentage
      : patch.suggested_canary_percent || 5;
  const [percentage, setPercentage] = useState(defaultPct);
  return (
    <>
      <dl className="details-list">
        <div><dt>Version</dt><dd>{patch.version || "Aucune"}</dd></div>
        <div><dt>Statut</dt><dd><Status value={patch.status} /></dd></div>
        <div><dt>Part actuelle</dt><dd>{patch.rollout_percentage ?? 0}%</dd></div>
        <div>
          <dt>Rappel / faux positifs</dt>
          <dd>
            {formatRate(patch.recall)} / {formatRate(patch.false_positive_rate)}
          </dd>
        </div>
      </dl>
      <p className="panel-note">
        Après « Pousser vers le canary », le modèle est en attente (0 %). Approuver à 5 % le propose à environ un téléphone sur vingt ; 100 % à tous. Rollback le retire. Le téléphone demande confirmation avant d’appliquer le patch.
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
            <BusyButton
              busy={busy}
              busyLabel="Approbation…"
              onClick={() => onAction(() => approvePatch(patch.version, percentage), `Approuvé à ${percentage || 0} %`)}
            >
              <Check size={16} aria-hidden /> Approuver à {percentage || 0}%
            </BusyButton>
            <BusyButton
              className="btn danger"
              busy={busy}
              busyLabel="Rollback…"
              onClick={() => onAction(() => rollbackPatch(patch.version), "Rollback effectué")}
            >
              <ArrowDownToLine size={16} aria-hidden /> Rollback
            </BusyButton>
          </div>
        </div>
      ) : (
        <EmptyState title="Aucun patch disponible" description="Poussez d’abord un run depuis Entraînement." />
      )}
    </>
  );
}

function AggregationPanel({ aggregation, runs, busy, onAction }) {
  const manifest = aggregation.manifest || {};
  const source = manifest.source || {};
  const severity = source.severity_counts || {};
  const policy = manifest.policy || {};
  const metrics = manifest.metrics || {};
  const latestRun = runs[0];
  const status = latestRun?.status || aggregation.last_status || (manifest.version ? "SUCCEEDED" : "NEVER_RUN");
  const period = manifest.period || {};
  return (
    <div className="aggregation-panel">
      <div className="aggregation-heading">
        <div>
          <p className="eyebrow">Agrégation hebdomadaire</p>
          <h2>{aggregation.last_run ? new Date(aggregation.last_run).toLocaleString("fr-FR") : "Aucune exécution"}</h2>
        </div>
        <Status value={status} />
      </div>
      <p className="panel-note">{aggregation.note}</p>
      <div className="metrics-grid">
        <article className="metric-card"><span className="muted">Signalements actifs sur 7 jours</span><strong>{source.active_reports ?? "—"}</strong><small>Remontées reçues pendant la période.</small></article>
        <article className="metric-card"><span className="muted">Menaces actives correspondantes</span><strong>{source.affected_signatures ?? "—"}</strong><small>Signatures distinctes encore actives.</small></article>
        <article className="metric-card"><span className="muted">Rappel / faux positifs</span><strong>{formatRate(metrics.recall)} / {formatRate(metrics.false_positive_rate)}</strong><small>Non calculés : les signalements ne sont pas des labels de vérité terrain.</small></article>
      </div>
      {manifest.version ? <p className="muted">Période : {formatDate(period.start)} → {formatDate(period.end)} · Manifeste : <code>{aggregation.manifest_path}</code></p> : <p className="muted">Le manifeste sera écrit ici : <code>{aggregation.manifest_path}</code></p>}
      <div className="aggregation-explainer">
        <h3>Ce que fait cette action</h3>
        <ol>
          <li>Compte les signalements <strong>actifs</strong> créés dans les 7 jours précédant l’exécution.</li>
          <li>Compte les menaces actives associées et les répartit par sévérité : {Object.keys(severity).length ? Object.entries(severity).map(([key, value]) => `${key} ${value}`).join(" · ") : "aucune donnée"}.</li>
          <li>Écrit les seuils actuellement configurés et ces statistiques dans un manifeste de suivi.</li>
        </ol>
        <p><strong>Effet :</strong> aucun réentraînement, aucun contenu de message ni empreinte exportés, aucun changement du canary et aucun changement des seuils utilisés en direct par <code>/analysis</code>. Le manifeste d’agrégation est stocké séparément du manifeste de modèle.</p>
        {Object.keys(policy).length ? <p>Seuils recopiés : sûr {policy.safe_score} · suspect {policy.suspicious_score} · critique {policy.critical_score} · confiance {policy.escalation_confidence}.</p> : null}
      </div>
      <BusyButton className="btn primary" busy={busy} busyLabel="Agrégation…" onClick={onAction}>
        <CloudCog size={16} aria-hidden /> Exécuter maintenant
      </BusyButton>
      {runs.length ? <div className="aggregation-runs"><h3>Exécutions récentes</h3>{runs.slice(0, 5).map((run) => <div className="aggregation-run" key={run.id}><Status value={run.status} /><span>{run.message}</span><time>{formatDate(run.finished_at || run.created_at)}</time></div>)}</div> : null}
    </div>
  );
}

function formatDate(value) {
  return value ? new Date(value).toLocaleString("fr-FR") : "—";
}

const HISTORY_PAGE_SIZE = 8;

function HistoryDetails({ data }) {
  const deployments = data.deployments || [];
  const audit = data.audit || [];
  const [deployPage, setDeployPage] = useState(1);
  const [auditPage, setAuditPage] = useState(1);

  const deploySlice = useMemo(() => {
    const start = (deployPage - 1) * HISTORY_PAGE_SIZE;
    return deployments.slice(start, start + HISTORY_PAGE_SIZE);
  }, [deployments, deployPage]);

  const auditSlice = useMemo(() => {
    const start = (auditPage - 1) * HISTORY_PAGE_SIZE;
    return audit.slice(start, start + HISTORY_PAGE_SIZE);
  }, [audit, auditPage]);

  return (
    <div className="history-stack">
      <h3>Déploiements</h3>
      {deployments.length ? (
        <>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Version</th>
                  <th>Statut</th>
                  <th>Canary</th>
                  <th>Approbation</th>
                </tr>
              </thead>
              <tbody>
                {deploySlice.map((item) => (
                  <tr key={item.version}>
                    <td>{item.version}</td>
                    <td>{item.status}</td>
                    <td>{item.rollout_percentage}%</td>
                    <td>{item.approved_at || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pager page={deployPage} pageSize={HISTORY_PAGE_SIZE} total={deployments.length} onPage={setDeployPage} />
        </>
      ) : (
        <EmptyState title="Aucun déploiement" />
      )}
      <h3>Journal d’audit</h3>
      {audit.length ? (
        <>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Quand</th>
                  <th>Admin</th>
                  <th>Action</th>
                  <th>Ressource</th>
                </tr>
              </thead>
              <tbody>
                {auditSlice.map((entry) => (
                  <tr key={entry.id}>
                    <td>{entry.created_at}</td>
                    <td>{entry.username}</td>
                    <td>{entry.action}</td>
                    <td>{entry.resource}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pager page={auditPage} pageSize={HISTORY_PAGE_SIZE} total={audit.length} onPage={setAuditPage} />
        </>
      ) : (
        <EmptyState title="Aucun accès journalisé" />
      )}
    </div>
  );
}

function Pager({ page, pageSize, total, onPage }) {
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  if (total <= pageSize) {
    return (
      <div className="pager">
        <span>
          {total} entrée{total > 1 ? "s" : ""}
        </span>
      </div>
    );
  }
  return (
    <div className="pager">
      <button type="button" className="btn ghost" disabled={page <= 1} onClick={() => onPage(page - 1)}>
        Précédent
      </button>
      <span>
        Page {page} / {pageCount} · {total} total
      </span>
      <button
        type="button"
        className="btn ghost"
        disabled={page >= pageCount}
        onClick={() => onPage(page + 1)}
      >
        Suivant
      </button>
    </div>
  );
}

