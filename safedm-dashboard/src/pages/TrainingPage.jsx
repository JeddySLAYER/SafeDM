import { useCallback, useEffect, useState } from "react";
import {
  BrainCircuit,
  CloudUpload,
  FlaskConical,
  Play,
  RefreshCw,
  Rocket,
} from "lucide-react";
import {
  Alert,
  EmptyState,
  PageHeader,
  Spinner,
} from "../components/ui";
import {
  createMlDataset,
  getMlRun,
  listMlDatasets,
  listMlRuns,
  promoteMlRun,
  seedBuiltinMlDataset,
  startMlTrain,
} from "../services/adminApi";

export default function TrainingPage() {
  const [datasets, setDatasets] = useState([]);
  const [runs, setRuns] = useState([]);
  const [selectedRun, setSelectedRun] = useState(null);
  const [datasetId, setDatasetId] = useState("");
  const [name, setName] = useState("");
  const [content, setContent] = useState("");
  const [promoteCanary, setPromoteCanary] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const refresh = useCallback(async () => {
    setError("");
    try {
      const [d, r] = await Promise.all([listMlDatasets(), listMlRuns()]);
      setDatasets(d.items || []);
      setRuns(r.items || []);
      if (!datasetId && d.items?.[0]) setDatasetId(String(d.items[0].id));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [datasetId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  async function onUpload(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const created = await createMlDataset({
        name: name || `upload-${Date.now()}`,
        content,
        source: "upload",
      });
      setName("");
      setContent("");
      setDatasetId(String(created.id));
      await refresh();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function onFile(file) {
    if (!file) return;
    const text = await file.text();
    setContent(text);
    if (!name) setName(file.name.replace(/\.[^.]+$/, ""));
  }

  async function onSeed() {
    setBusy(true);
    setError("");
    try {
      const created = await seedBuiltinMlDataset();
      setDatasetId(String(created.id));
      await refresh();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function onTrain() {
    if (!datasetId) return;
    setBusy(true);
    setError("");
    try {
      const run = await startMlTrain({
        dataset_id: Number(datasetId),
        promote_canary: promoteCanary,
      });
      setSelectedRun(run);
      await refresh();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function openRun(id) {
    setBusy(true);
    setError("");
    try {
      setSelectedRun(await getMlRun(id));
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function onPromote(id) {
    setBusy(true);
    setError("");
    try {
      await promoteMlRun(id);
      setSelectedRun(await getMlRun(id));
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <div>
        <PageHeader title="Entraînement" subtitle="Datasets, jobs train, métriques, canary." />
        <Spinner label="Chargement…" />
      </div>
    );
  }

  const summary = selectedRun?.metrics_summary;

  return (
    <div>
      <PageHeader
        title="Entraînement"
        subtitle="Ingestion → train → métriques → promote canary (sans Play Store)."
        actions={
          <button type="button" className="btn ghost" onClick={refresh} disabled={busy}>
            <RefreshCw size={16} aria-hidden />
            Actualiser
          </button>
        }
      />

      {error ? <Alert tone="danger">{error}</Alert> : null}

      <div className="ops-grid" style={{ display: "grid", gap: "1.25rem", gridTemplateColumns: "1fr 1fr" }}>
        <section className="card-panel">
          <h2 style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <CloudUpload size={18} /> Dataset
          </h2>
          <form onSubmit={onUpload} style={{ display: "grid", gap: 10 }}>
            <label>
              Nom
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="sms-tg-v1" />
            </label>
            <label>
              Fichier JSON / CSV
              <input
                type="file"
                accept=".json,.csv,application/json,text/csv"
                onChange={(e) => onFile(e.target.files?.[0])}
              />
            </label>
            <label>
              Contenu (message + expected)
              <textarea
                rows={8}
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder='[{"message":"…","expected":"phishing"}]'
                style={{ fontFamily: "ui-monospace, monospace", fontSize: 12 }}
              />
            </label>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button type="submit" className="btn primary" disabled={busy || !content.trim()}>
                Uploader
              </button>
              <button type="button" className="btn ghost" onClick={onSeed} disabled={busy}>
                <FlaskConical size={16} /> Seed built-in
              </button>
            </div>
          </form>

          <h3 style={{ marginTop: 20 }}>Datasets</h3>
          {!datasets.length ? (
            <EmptyState title="Aucun dataset" body="Uploadez un JSON/CSV ou seed built-in." />
          ) : (
            <ul className="ops-list">
              {datasets.map((d) => (
                <li key={d.id}>
                  <button
                    type="button"
                    className={String(d.id) === String(datasetId) ? "btn ghost active" : "btn ghost"}
                    onClick={() => setDatasetId(String(d.id))}
                  >
                    #{d.id} {d.name} — {d.sample_count} (B{d.benign_count}/M{d.malicious_count})
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="card-panel">
          <h2 style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <BrainCircuit size={18} /> Job train
          </h2>
          <label>
            Dataset ID
            <select value={datasetId} onChange={(e) => setDatasetId(e.target.value)}>
              <option value="">—</option>
              {datasets.map((d) => (
                <option key={d.id} value={d.id}>
                  #{d.id} {d.name}
                </option>
              ))}
            </select>
          </label>
          <label style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 10 }}>
            <input
              type="checkbox"
              checked={promoteCanary}
              onChange={(e) => setPromoteCanary(e.target.checked)}
            />
            Promouvoir vers canary si publishable
          </label>
          <button
            type="button"
            className="btn primary"
            style={{ marginTop: 12 }}
            onClick={onTrain}
            disabled={busy || !datasetId}
          >
            <Play size={16} /> Lancer l’entraînement
          </button>
          <p style={{ opacity: 0.7, fontSize: 13, marginTop: 8 }}>
            Gros jobs : GitHub Actions → workflow <code>train-model</code>. Canary = % appareils
            (page Opérations), pas Play Store.
          </p>

          <h3 style={{ marginTop: 20 }}>Runs récents</h3>
          {!runs.length ? (
            <EmptyState title="Aucun run" body="Lancez un entraînement." />
          ) : (
            <ul className="ops-list">
              {runs.map((r) => (
                <li key={r.id}>
                  <button type="button" className="btn ghost" onClick={() => openRun(r.id)}>
                    #{r.id} · {r.status}
                    {r.publishable ? " · publishable" : ""}
                    {r.metrics_summary
                      ? ` · FPR ${r.metrics_summary.false_positive_rate} / R ${r.metrics_summary.recall}`
                      : ""}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {selectedRun ? (
        <section className="card-panel" style={{ marginTop: "1.25rem" }}>
          <h2>Run #{selectedRun.id}</h2>
          <p>
            Status: <strong>{selectedRun.status}</strong>
            {selectedRun.publishable ? " · deployable canary" : " · research / non publishable"}
            {selectedRun.artifact_sha256 ? ` · sha ${selectedRun.artifact_sha256.slice(0, 12)}…` : ""}
          </p>
          {selectedRun.error_message ? <Alert tone="danger">{selectedRun.error_message}</Alert> : null}
          {summary ? (
            <pre style={{ fontSize: 12, overflow: "auto" }}>{JSON.stringify(summary, null, 2)}</pre>
          ) : null}
          {selectedRun.log_text ? (
            <>
              <h3>Logs</h3>
              <pre
                style={{
                  fontSize: 11,
                  maxHeight: 320,
                  overflow: "auto",
                  background: "rgba(0,0,0,0.04)",
                  padding: 12,
                }}
              >
                {selectedRun.log_text}
              </pre>
            </>
          ) : null}
          {selectedRun.status === "succeeded" ? (
            <button
              type="button"
              className="btn primary"
              style={{ marginTop: 12 }}
              disabled={busy}
              onClick={() => onPromote(selectedRun.id)}
            >
              <Rocket size={16} /> Pousser vers canary (manifest)
            </button>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}
