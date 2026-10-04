import { Alert, EmptyState, Freshness, PageHeader, SkeletonTable, Spinner } from "../components/ui";
import { useOperationsOverview } from "../hooks/useOperationsOverview";

function Status({ value }) {
  const ok = value === "ok" || value === "ready" || value === "canary" || value === "configured";
  return <span className={`health-badge ${ok ? "ok" : "warn"}`}>{value}</span>;
}

export default function OperationsPage() {
  const { data, error, loading, refreshing, updatedAt, refresh } = useOperationsOverview();

  return (
    <div>
      <PageHeader
        title="Opérations"
        subtitle="Patches, audit, agrégation, seuils et rétention."
        actions={<><Freshness updatedAt={updatedAt} refreshing={refreshing} /><button className="btn" type="button" onClick={refresh} disabled={refreshing}>{refreshing ? <span className="btn-spinner" /> : null}Actualiser</button></>}
      />
      <Alert>{error}</Alert>
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
            </section>
            <section className="panel">
              <h2>Cycle d’agrégation</h2>
              <dl className="details-list">
                <div><dt>Dernier manifest</dt><dd>{data.aggregation.last_run || "Jamais"}</dd></div>
                <div><dt>Source</dt><dd>{data.aggregation.source}</dd></div>
                <div><dt>Déclenchement</dt><dd>Cloud Scheduler → Cloud Run Job</dd></div>
              </dl>
              <p className="muted compact-note">{data.aggregation.note}</p>
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
            </section>
            <section className="panel">
              <h2>Rétention & conformité</h2>
              <dl className="details-list">
                <div><dt>Inactivité</dt><dd>{data.retention.inactive_months} mois</dd></div>
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
