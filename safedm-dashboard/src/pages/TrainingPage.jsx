import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
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
  CheckboxField,
  DetailSheet,
  EmptyState,
  Field,
  PageHeader,
  Spinner,
} from "../components/ui";
import {
  createMlDataset,
  getMlDataset,
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
  const [preview, setPreview] = useState(null);
  const [tab, setTab] = useState("data");
  const [processOpen, setProcessOpen] = useState(false);
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
      setDatasetId((current) => current || (d.items?.[0] ? String(d.items[0].id) : ""));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

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
      setTab("data");
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
      setTab("data");
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
      setTab("runs");
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

  async function openDataset(id) {
    setBusy(true);
    setError("");
    setDatasetId(String(id));
    try {
      setPreview(await getMlDataset(id));
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

  const draftRows = parsePreview(content);
  const summary = selectedRun?.metrics_summary;

  return (
    <div>
      <PageHeader
        title="Entraînement"
        subtitle="Préparez un jeu de messages, entraînez le modèle, puis activez-le depuis Opérations."
        actions={
          <>
            <button type="button" className="btn ghost" onClick={() => setProcessOpen(true)}>
              Comment ça marche
            </button>
            <button type="button" className="btn ghost" onClick={refresh} disabled={busy || loading}>
              <RefreshCw size={16} aria-hidden />
              Actualiser
            </button>
          </>
        }
      />

      {error ? <Alert tone="error">{error}</Alert> : null}

      <div className="panel">
        <div className="tabs" role="tablist">
          <Tab id="data" current={tab} onSelect={setTab} icon={CloudUpload} title="Jeux" hint="Voir les exemples" />
          <Tab id="add" current={tab} onSelect={setTab} icon={FlaskConical} title="Ajouter" hint="Importer un fichier" />
          <Tab id="train" current={tab} onSelect={setTab} icon={BrainCircuit} title="Entraîner" hint="Calculer le modèle" />
          <Tab id="runs" current={tab} onSelect={setTab} icon={Play} title="Résultats" hint="Métriques et canary" />
        </div>

        {loading ? <Spinner label="Chargement…" /> : null}

        {!loading && tab === "data" ? (
          <DatasetList datasets={datasets} datasetId={datasetId} onOpen={openDataset} />
        ) : null}

        {!loading && tab === "add" ? (
          <form className="form-grid" onSubmit={onUpload}>
            <p className="panel-note">
              Envoyer enregistre le jeu. Le bouton « Jeu intégré » importe les exemples livrés avec SafeDM.
            </p>
            <Field label="Nom">
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="sms-tg-v1" />
            </Field>
            <Field label="Fichier JSON ou CSV" hint="Le fichier remplit le contenu. Rien n’est envoyé tant que vous n’avez pas cliqué sur Envoyer.">
              <input
                type="file"
                accept=".json,.csv,application/json,text/csv"
                onChange={(e) => onFile(e.target.files?.[0])}
              />
            </Field>
            <Field label="Contenu" hint="Chaque exemple a un message et une étiquette expected.">
              <textarea
                rows={8}
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder='[{"message":"…","expected":"phishing"}]'
              />
            </Field>
            <SamplePreview rows={draftRows} empty="Collez ou importez un fichier pour voir les premiers messages." />
            <div className="form-actions">
              <button type="submit" className="btn primary" disabled={busy || !content.trim()}>
                Envoyer le dataset
              </button>
              <button type="button" className="btn ghost" onClick={onSeed} disabled={busy}>
                <FlaskConical size={16} aria-hidden /> Jeu intégré
              </button>
            </div>
          </form>
        ) : null}

        {!loading && tab === "train" ? (
          <div className="form-grid">
            <p className="panel-note">
              Ce bouton entraîne le modèle sur le jeu choisi. Il ne change pas les téléphones.
              La case ci-dessous copie le résultat vers le canary seulement s’il est publiable.
              Ensuite, <Link to="/operations">Opérations</Link> décide qui le reçoit.
            </p>
            <Field label="Dataset utilisé">
              <select value={datasetId} onChange={(e) => setDatasetId(e.target.value)}>
                <option value="">Choisir un dataset</option>
                {datasets.map((d) => (
                  <option key={d.id} value={d.id}>
                    #{d.id} {d.name}
                  </option>
                ))}
              </select>
            </Field>
            <CheckboxField
              label="Si le run est publiable, le pousser vers le canary à la fin"
              checked={promoteCanary}
              onChange={(e) => setPromoteCanary(e.target.checked)}
            />
            <div className="form-actions">
              <button type="button" className="btn primary" onClick={onTrain} disabled={busy || !datasetId}>
                <Play size={16} aria-hidden /> Lancer l’entraînement
              </button>
            </div>
          </div>
        ) : null}

        {!loading && tab === "runs" ? (
          <RunList runs={runs} selectedId={selectedRun?.id} onOpen={openRun} />
        ) : null}
      </div>

      <DetailSheet
        open={processOpen}
        title="Du jeu de données au téléphone"
        eyebrow="Processus"
        onClose={() => setProcessOpen(false)}
      >
        <ol className="process-list">
          <li>
            <span className="process-num">1</span>
            <div>
              <strong>Préparer le jeu</strong>
              <p>Des messages déjà classés. L’envoi les enregistre, il n’entraîne pas le modèle.</p>
            </div>
          </li>
          <li>
            <span className="process-num">2</span>
            <div>
              <strong>Lancer l’entraînement</strong>
              <p>Produit des métriques. Un run publiable a passé les seuils.</p>
            </div>
          </li>
          <li>
            <span className="process-num">3</span>
            <div>
              <strong>Pousser vers le canary</strong>
              <p>Copie le modèle dans le manifeste du serveur. Les téléphones ne basculent pas encore.</p>
            </div>
          </li>
          <li>
            <span className="process-num">4</span>
            <div>
              <strong>Activer dans Opérations</strong>
              <p>
                <Link to="/operations">Opérations</Link> choisit le pourcentage d’appareils. En dessous de 100 %, seul ce pourcentage vérifie le nouveau modèle. À 100 %, tout le monde le reçoit. Rollback l’arrête.
              </p>
            </div>
          </li>
        </ol>
      </DetailSheet>

      <DetailSheet
        open={Boolean(preview)}
        title={preview ? preview.name : "Dataset"}
        eyebrow="Aperçu du jeu"
        onClose={() => setPreview(null)}
      >
        {preview ? (
          <>
            <p className="muted">
              {preview.sample_count} exemples · {preview.benign_count} bénins · {preview.malicious_count} malveillants
            </p>
            <SamplePreview
              rows={preview.preview || []}
              empty="Aucun exemple à afficher."
            />
            <div className="form-actions">
              <button
                type="button"
                className="btn primary"
                onClick={() => {
                  setDatasetId(String(preview.id));
                  setPreview(null);
                  setTab("train");
                }}
              >
                Entraîner avec ce jeu
              </button>
            </div>
          </>
        ) : null}
      </DetailSheet>

      <DetailSheet
        open={Boolean(selectedRun)}
        title={selectedRun ? `Run #${selectedRun.id}` : "Run"}
        eyebrow="Résultat d’entraînement"
        onClose={() => setSelectedRun(null)}
      >
        {selectedRun ? (
          <>
            <p>
              Statut : <strong>{selectedRun.status}</strong>
              {selectedRun.publishable ? " · publiable" : " · non publiable"}
            </p>
            <p className="panel-note">
              Pousser vers le canary met ce modèle dans le manifeste du serveur.
              Pour l’envoyer à une partie des téléphones, ouvrez <Link to="/operations">Opérations</Link> et approuvez un pourcentage.
            </p>
            {selectedRun.error_message ? <Alert tone="error">{selectedRun.error_message}</Alert> : null}
            {summary ? <pre className="log-box">{JSON.stringify(summary, null, 2)}</pre> : null}
            {selectedRun.log_text ? (
              <>
                <h3 className="stack-top">Journal</h3>
                <pre className="log-box">{selectedRun.log_text}</pre>
              </>
            ) : null}
            {selectedRun.status === "succeeded" ? (
              <div className="form-actions">
                <button type="button" className="btn primary" disabled={busy} onClick={() => onPromote(selectedRun.id)}>
                  <Rocket size={16} aria-hidden /> Pousser vers le canary
                </button>
              </div>
            ) : null}
          </>
        ) : null}
      </DetailSheet>
    </div>
  );
}

function Tab({ id, current, onSelect, icon: Icon, title, hint }) {
  const active = current === id;
  return (
    <button
      type="button"
      className={active ? "tab active" : "tab"}
      role="tab"
      aria-selected={active}
      onClick={() => onSelect(id)}
    >
      <Icon size={17} aria-hidden />
      <span>
        <strong>{title}</strong>
        <small>{hint}</small>
      </span>
    </button>
  );
}

function DatasetList({ datasets, datasetId, onOpen }) {
  if (!datasets.length) {
    return (
      <EmptyState
        title="Aucun dataset"
        description="Ouvrez Ajouter pour importer un fichier, ou chargez le jeu intégré."
      />
    );
  }
  return (
    <ul className="catalog-list">
      {datasets.map((d) => (
        <li key={d.id}>
          <button
            type="button"
            className={String(d.id) === String(datasetId) ? "catalog-row is-selected" : "catalog-row"}
            onClick={() => onOpen(d.id)}
          >
            <span>
              #{d.id} {d.name}
              <small>
                {d.sample_count} exemples · {d.benign_count} bénins · {d.malicious_count} malveillants
              </small>
            </span>
            <span className="pill soft">Aperçu</span>
          </button>
        </li>
      ))}
    </ul>
  );
}

function RunList({ runs, selectedId, onOpen }) {
  if (!runs.length) {
    return <EmptyState title="Aucun run" description="Lancez un entraînement pour voir les métriques ici." />;
  }
  return (
    <ul className="catalog-list">
      {runs.map((r) => (
        <li key={r.id}>
          <button
            type="button"
            className={selectedId === r.id ? "catalog-row is-selected" : "catalog-row"}
            onClick={() => onOpen(r.id)}
          >
            <span>
              Run #{r.id} · {r.status}
              {r.publishable ? " · publiable" : ""}
              {r.metrics_summary ? (
                <small>
                  Faux positifs {r.metrics_summary.false_positive_rate} · rappel {r.metrics_summary.recall}
                </small>
              ) : null}
            </span>
            <span className="pill soft">Détail</span>
          </button>
        </li>
      ))}
    </ul>
  );
}

function SamplePreview({ rows, empty }) {
  if (!rows.length) return <p className="muted">{empty}</p>;
  return (
    <div className="sample-list">
      {rows.map((row, index) => (
        <article className="sample-row" key={`${index}-${row.expected}`}>
          <span className={`pill ${isBenign(row.expected) ? "soft" : "draft"}`}>{row.expected || "sans étiquette"}</span>
          <p>{row.message}</p>
        </article>
      ))}
    </div>
  );
}

function isBenign(label) {
  return ["benign", "safe", "ham", "ok", "legit"].includes(String(label || "").toLowerCase());
}

function parsePreview(raw) {
  const text = String(raw || "").trim();
  if (!text) return [];
  try {
    const data = JSON.parse(text);
    const rows = Array.isArray(data) ? data : [];
    return rows.slice(0, 8).map((row) => ({
      message: row.message || row.text || "",
      expected: row.expected || row.label || "",
    }));
  } catch {
    const lines = text.split(/\r?\n/).filter((line) => line.trim());
    const start = lines[0]?.toLowerCase().includes("message") ? 1 : 0;
    return lines.slice(start, start + 8).map((line) => {
      const [message, expected] = line.split(",");
      return { message: (message || "").trim(), expected: (expected || "").trim() };
    });
  }
}
