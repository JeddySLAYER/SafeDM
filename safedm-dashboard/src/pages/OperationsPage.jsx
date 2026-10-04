import { Alert, EmptyState, Freshness, PageHeader, SkeletonTable, Spinner } from "../components/ui";
import { useOperationsOverview } from "../hooks/useOperationsOverview";
import { approvePatch, requestAggregation, rollbackPatch, saveTenantPolicy } from "../services/adminApi";
import { useState } from "react";

function Status({ value }) {
  const ok = value === "ok" || value === "ready" || value === "canary" || value === "configured";
  return <span className={`health-badge ${ok ? "ok" : "warn"}`}>{value}</span>;
}

export default function OperationsPage() {
  const { data, error, loading, refreshing, updatedAt, refresh } = useOperationsOverview();
  const [actionError, setActionError] = useState("");
  const [actionBusy, setActionBusy] = useState(false);
  const [policy, setPolicy] = useState({ tenant_key: "", region: "global", safe_score: 35, suspicious_score: 65, critical_score: 85, escalation_confidence: 0.65 });

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

  return (
    <div>
      <PageHeader
        title="Opérations"
        subtitle="Patches, audit, agrégation, seuils et rétention."
        actions={<><Freshness updatedAt={updatedAt} refreshing={refreshing} /><button className="btn" type="button" onClick={refresh} disabled={refreshing}>{refreshing ? <span className="btn-spinner" /> : null}Actualiser</button></>}
      />
      <Alert>{error}</Alert>
      <Alert>{actionError}</Alert>
      {loading && !data ? <><Spinner label="Chargement des opérations…" /><SkeletonTable rows={6} columns={2} /></> : null}
      {data ? (
        <>
          <div className="grid-2">
            <section className="panel">
              <h2>Patches & canary</h2>
              <dl className="details-list">
                <div><dt>Version</dt><dd>{data.patch.version || "Aucune"}</dd></div>
                <div><dt>Statut</dt><dd><Status value={data.patch.status} /></dd></div>
                <div><dt>Canary</dt><dd>{data.patch.rollout_percentage}%</dd></div>
                <div><dt>Rappel / FP</dt><dd>{data.patch.recall ?? "N/D"} / {data.patch.false_positive_rate ?? "N/D"}</dd></div>
              </dl>
              <div className="actions operation-actions">
                {data.patch.version ? <><button className="btn small primary" disabled={actionBusy} onClick={() => runAction(() => approvePatch(data.patch.version))}>Approuver</button><button className="btn small danger" disabled={actionBusy} onClick={() => runAction(() => rollbackPatch(data.patch.version))}>Rollback</button></> : null}
              </div>
            </section>
            <section className="panel">
              <h2>Cycle d’agrégation</h2>
              <dl className="details-list">
                <div><dt>Dernier manifest</dt><dd>{data.aggregation.last_run || "Jamais"}</dd></div>
                <div><dt>Source</dt><dd>{data.aggregation.source}</dd></div>
                <div><dt>Déclenchement</dt><dd>Cloud Scheduler → Cloud Run Job</dd></div>
              </dl>
              <p className="muted compact-note">{data.aggregation.note}</p>
              <button className="btn small" disabled={actionBusy} onClick={() => runAction(requestAggregation)}>Demander une agrégation</button>
            </section>
          </div>
          <div className="grid-2">
            <section className="panel">
              <h2>Configuration région / entreprise</h2>
              <dl className="details-list">
                {Object.entries(data.policy.thresholds).map(([key, value]) => (
                  <div key={key}><dt>{key}</dt><dd>{value}</dd></div>
                ))}
              </dl>
              <p className="muted compact-note">{data.policy.note}</p>
              <form className="policy-form" onSubmit={(event) => { event.preventDefault(); runAction(() => saveTenantPolicy(policy)); }}>
                <input required placeholder="Identifiant entreprise" value={policy.tenant_key} onChange={(event) => setPolicy({ ...policy, tenant_key: event.target.value })} />
                <input required placeholder="Région" value={policy.region} onChange={(event) => setPolicy({ ...policy, region: event.target.value })} />
                <input required type="number" min="0" max="100" aria-label="Score sûr" value={policy.safe_score} onChange={(event) => setPolicy({ ...policy, safe_score: Number(event.target.value) })} />
                <input required type="number" min="0" max="100" aria-label="Score suspect" value={policy.suspicious_score} onChange={(event) => setPolicy({ ...policy, suspicious_score: Number(event.target.value) })} />
                <input required type="number" min="0" max="100" aria-label="Score critique" value={policy.critical_score} onChange={(event) => setPolicy({ ...policy, critical_score: Number(event.target.value) })} />
                <input required type="number" min="0" max="1" step="0.01" aria-label="Confiance d'escalade" value={policy.escalation_confidence} onChange={(event) => setPolicy({ ...policy, escalation_confidence: Number(event.target.value) })} />
                <button className="btn small primary" disabled={actionBusy}>Enregistrer la politique</button>
              </form>
            </section>
            <section className="panel">
              <h2>Historique des déploiements</h2>
              {data.deployments?.length ? <div className="table-wrap" style={{ border: "none" }}><table><thead><tr><th>Version</th><th>Statut</th><th>Canary</th><th>Approbation</th></tr></thead><tbody>{data.deployments.map((item) => <tr key={item.version}><td>{item.version}</td><td>{item.status}</td><td>{item.rollout_percentage}%</td><td>{item.approved_at || "—"}</td></tr>)}</tbody></table></div> : <EmptyState title="Aucun workflow de patch" /> }
            </section>
            <section className="panel">
              <h2>Rétention & conformité</h2>
              <dl className="details-list">
                <div><dt>Inactivité</dt><dd>{data.retention.inactive_months} mois</dd></div>
                <div><dt>Signatures candidates</dt><dd>{data.retention.candidate_count ?? 0}</dd></div>
                <div><dt>Statut</dt><dd><Status value={data.retention.status} /></dd></div>
                <div><dt>Dernier audit</dt><dd>{data.retention.last_audit || "N/D"}</dd></div>
              </dl>
              <p className="muted compact-note">{data.retention.note}</p>
            </section>
          </div>
          <section className="panel">
            <h2>Journal d’audit récent</h2>
            {data.audit.length === 0 ? <EmptyState title="Aucun accès journalisé" /> : (
              <div className="table-wrap" style={{ border: "none" }}>
                <table><thead><tr><th>Quand</th><th>Admin</th><th>Action</th><th>Ressource</th><th>Pourquoi</th></tr></thead>
                  <tbody>{data.audit.map((entry) => <tr key={entry.id}><td>{entry.created_at}</td><td>{entry.username}</td><td>{entry.action}</td><td>{entry.resource}</td><td>{entry.purpose}</td></tr>)}</tbody>
                </table>
              </div>
            )}
          </section>
        </>
      ) : null}
    </div>
  );
}
