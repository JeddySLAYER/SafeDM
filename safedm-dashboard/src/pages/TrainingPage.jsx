import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  Activity,
  BrainCircuit,
  CloudUpload,
  FlaskConical,
  MessageSquareText,
  Play,
  RefreshCw,
  Rocket,
  Trash2,
} from "lucide-react";
import {
  Alert,
  BusyButton,
  CheckboxField,
  ConfirmDialog,
  DetailSheet,
  EmptyState,
  Field,
  PageHeader,
  Spinner,
} from "../components/ui";
import { useToast } from "../context/ToastContext";
import { DATASET_COLUMN_ALIASES, normalizeDatasetRows, parseDatasetFile, suggestColumn } from "../utils/datasetImport";
import {
  createMlDataset,
  deleteMlDataset,
  deleteMlRun,
  evaluateMlTflite,
  getMlDataset,
  getMlRun,
  listMlDatasets,
  listMlRuns,
  promoteMlRun,
  seedBuiltinMlDataset,
  startMlTrain,
  tryMlMessage,
} from "../services/adminApi";

export default function TrainingPage() {
  const { toast } = useToast();
  const [datasets, setDatasets] = useState([]);
  const [runs, setRuns] = useState([]);
  const [selectedRun, setSelectedRun] = useState(null);
  const [datasetId, setDatasetId] = useState("");
  const [preview, setPreview] = useState(null);
  const [tab, setTab] = useState("data");
  const [processOpen, setProcessOpen] = useState(false);
  const [name, setName] = useState("");
  const [content, setContent] = useState("");
  const [importRows, setImportRows] = useState(null);
  const [importColumns, setImportColumns] = useState([]);
  const [messageColumn, setMessageColumn] = useState("");
  const [labelColumn, setLabelColumn] = useState("");
  const [importError, setImportError] = useState("");
  const [importPage, setImportPage] = useState(0);
  const [promoteCanary, setPromoteCanary] = useState(false);
  const [tryText, setTryText] = useState(
    "URGENT: votre compte bancaire est suspendu. Cliquez https://bit.ly/verify-now",
  );
  const [tryResult, setTryResult] = useState(null);
  const [tfliteResult, setTfliteResult] = useState(null);
  const [mobileFeatures, setMobileFeatures] = useState(null);
  const [mobileResults, setMobileResults] = useState(null);
  const [mobileMessages, setMobileMessages] = useState(null);
  const [mobileFeatureFile, setMobileFeatureFile] = useState("");
  const [mobileReportText, setMobileReportText] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [busyAction, setBusyAction] = useState("");
  const [error, setError] = useState("");
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteBusy, setDeleteBusy] = useState(false);

  const refresh = useCallback(async () => {
    setError("");
    setBusyAction("refresh");
    try {
      const [d, r] = await Promise.all([listMlDatasets(), listMlRuns()]);
      setDatasets(d.items || []);
      setRuns(r.items || []);
      setDatasetId((current) => current || (d.items?.[0] ? String(d.items[0].id) : ""));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
      setBusyAction("");
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  async function runAction(actionKey, action, successMessage) {
    setBusy(true);
    setBusyAction(actionKey);
    setError("");
    try {
      const result = await action();
      if (successMessage) toast(successMessage);
      return result;
    } catch (err) {
      setError(err.message);
      toast(err.message, "error");
      throw err;
    } finally {
      setBusy(false);
      setBusyAction("");
    }
  }

  async function onUpload(e) {
    e.preventDefault();
    try {
      const created = await runAction("upload", () =>
        createMlDataset({
          name: name || `upload-${Date.now()}`,
          content: importRows ? JSON.stringify(validImportRows.map(({ message, expected }) => ({ message, expected }))) : content,
          source: "upload",
        }),
      "Dataset enregistré");
      setName("");
      setContent("");
      setImportRows(null);
      setDatasetId(String(created.id));
      setTab("data");
      await refresh();
    } catch {
      /* toast already shown */
    }
  }

  async function onFile(file) {
    if (!file) return;
    try {
      const parsed = parseDatasetFile(file.name, await file.text());
      setImportRows(parsed.rows);
      setImportPage(0);
      setImportColumns(parsed.columns);
      setMessageColumn(suggestColumn(parsed.columns, DATASET_COLUMN_ALIASES.message));
      setLabelColumn(suggestColumn(parsed.columns, DATASET_COLUMN_ALIASES.label));
      setImportError("");
      if (!name) setName(file.name.replace(/\.[^.]+$/, ""));
    } catch (err) { setImportError(err.message || "Fichier illisible"); setImportRows(null); }
  }

  const normalizedRows = importRows ? normalizeDatasetRows(importRows, messageColumn, labelColumn) : [];
  const validImportRows = normalizedRows.filter((row) => row.valid);
  const importPageSize = 50;
  const importPageRows = normalizedRows.slice(importPage * importPageSize, (importPage + 1) * importPageSize);

  async function onSeed() {
    try {
      const created = await runAction("seed", () => seedBuiltinMlDataset(), "Jeu intégré importé");
      setDatasetId(String(created.id));
      setTab("data");
      await refresh();
    } catch {
      /* toast already shown */
    }
  }

  async function onTrain() {
    if (!datasetId) return;
    try {
      const run = await runAction(
        "train",
        () =>
          startMlTrain({
            dataset_id: Number(datasetId),
            promote_canary: promoteCanary,
          }),
        promoteCanary
          ? "Entraînement terminé (canary si publiable)"
          : "Entraînement terminé",
      );
      setSelectedRun(run);
      setTab("runs");
      await refresh();
    } catch {
      /* toast already shown */
    }
  }

  async function openRun(id) {
    try {
      setSelectedRun(await runAction("open-run", () => getMlRun(id)));
    } catch {
      /* toast already shown */
    }
  }

  async function openDataset(id) {
    setDatasetId(String(id));
    try {
      setPreview(await runAction("open-dataset", () => getMlDataset(id)));
    } catch {
      /* toast already shown */
    }
  }

  async function confirmDelete() {
    if (!deleteTarget || deleteBusy) return;
    setDeleteBusy(true);
    try {
      if (deleteTarget.type === "dataset") {
        await deleteMlDataset(deleteTarget.id);
        if (String(datasetId) === String(deleteTarget.id)) {
          setPreview(null);
          setDatasetId("");
        }
        if (selectedRun?.dataset_id === deleteTarget.id) setSelectedRun(null);
      } else {
        await deleteMlRun(deleteTarget.id);
        if (selectedRun?.id === deleteTarget.id) setSelectedRun(null);
      }
      toast(deleteTarget.type === "dataset" ? "Dataset et fichiers associés supprimés" : "Run et fichiers associés supprimés");
      await refresh();
    } catch (err) {
      setError(err.message);
      toast(err.message, "error");
    } finally {
      setDeleteBusy(false);
      setDeleteTarget(null);
    }
  }

  async function onPromote(id) {
    try {
      await runAction("promote", () => promoteMlRun(id), "Modèle poussé en canary (0 %)");
      setSelectedRun(await getMlRun(id));
      toast("Ouvrez Opérations pour Approuver un pourcentage", "success");
    } catch {
      /* toast already shown */
    }
  }

  async function onTry() {
    try {
      const result = await runAction(
        "try",
        () =>
          tryMlMessage({
            message: tryText,
            run_id: selectedRun?.id || null,
          }),
        "Évaluation terminée",
      );
      setTryResult(result);
    } catch {
      setTryResult(null);
    }
  }

  async function onEvaluateTflite() {
    if (!datasetId) return;
    const result = await runAction(
      "tflite-evaluate",
      () => evaluateMlTflite(datasetId, selectedRun?.id || null, mobileFeatures, mobileResults, mobileMessages),
      "Évaluation du fichier TFLite terminée",
    );
    setTfliteResult(result);
  }

  function importMobileReport(data, label = "rapport Android") {
    const vectors = Array.isArray(data)
      ? data
      : data.mobile_features || data.features || data.rows?.map((row) => row.features || row.mobile_features);
    if (!Array.isArray(vectors) || vectors.some((vector) => !Array.isArray(vector))) {
      throw new Error("Le JSON doit contenir une liste de vecteurs de features.");
    }
    setMobileFeatures(vectors);
    setMobileResults(Array.isArray(data.mobile_results) ? data.mobile_results : null);
    setMobileMessages(Array.isArray(data.mobile_messages) ? data.mobile_messages : null);
    setMobileFeatureFile(label);
    setTfliteResult(null);
  }

  const draftRows = parsePreview(content);
  const summary = selectedRun?.metrics_summary;
  const fullMetrics = selectedRun?.metrics;
  const operational = fullMetrics?.at_operational_threshold || summary;

  return (
    <div>
      <PageHeader
        title="Entraînement"
        subtitle="Préparez un jeu, entraînez, testez un message, puis activez depuis Opérations."
        actions={
          <>
            <button type="button" className="btn ghost" onClick={() => setProcessOpen(true)}>
              Comment ça marche
            </button>
            <BusyButton
              className="btn ghost"
              busy={busyAction === "refresh"}
              busyLabel="Actualisation…"
              onClick={refresh}
              disabled={busy || loading}
            >
              <RefreshCw size={16} aria-hidden />
              Actualiser
            </BusyButton>
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
          <Tab id="try" current={tab} onSelect={setTab} icon={MessageSquareText} title="Tester" hint="Message → verdict" />
          <Tab id="tflite" current={tab} onSelect={setTab} icon={Activity} title="Diagnostic local" hint="TFLite et patch" />
        </div>

        {loading ? <Spinner label="Chargement…" /> : null}

        {!loading && tab === "data" ? (
          <DatasetList datasets={datasets} datasetId={datasetId} onOpen={openDataset} onDelete={(id, name) => setDeleteTarget({ type: "dataset", id, name })} />
        ) : null}

        {!loading && tab === "add" ? (
          <form className="form-grid" onSubmit={onUpload}>
            <Field label="Nom du jeu">
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="ex. phishing-mars" />
            </Field>
            <Field
              label="Fichier JSON ou CSV"
              hint="JSON: liste {message, expected}. CSV: colonnes message,expected."
            >
              <input type="file" accept=".json,.csv,text/csv,application/json" onChange={(e) => onFile(e.target.files?.[0])} />
            </Field>
            {importError ? <Alert tone="error">{importError}</Alert> : null}
            {importRows ? (
              <>
                <div className="form-grid">
                  <Field label="message ← colonne"><select value={messageColumn} onChange={(e) => setMessageColumn(e.target.value)}>{importColumns.map((col) => <option key={col}>{col}</option>)}</select></Field>
                  <Field label="expected ← colonne"><select value={labelColumn} onChange={(e) => setLabelColumn(e.target.value)}>{importColumns.map((col) => <option key={col}>{col}</option>)}</select></Field>
                </div>
                <p className="muted">{normalizedRows.length} lignes non vides · {validImportRows.length} valides · {normalizedRows.length - validImportRows.length} étiquettes à corriger</p>
                <div className="table-wrap"><table><thead><tr><th>Message</th><th>Étiquette normalisée</th><th>État</th></tr></thead><tbody>{importPageRows.map((row) => <tr key={row.index}><td>{row.message}</td><td><select value={row.expected === "legitimate" || row.expected === "malicious" ? row.expected : ""} onChange={(e) => setImportRows(importRows.map((item, index) => index === row.index ? { ...item, [labelColumn]: e.target.value } : item))}><option value="">Choisir…</option><option value="legitimate">Bénin</option><option value="malicious">Malveillant</option></select></td><td>{row.valid ? "Prêt" : "À vérifier"}</td></tr>)}</tbody></table></div>
                {normalizedRows.length > importPageSize ? <div className="pager"><button type="button" className="btn ghost" disabled={importPage === 0} onClick={() => setImportPage((page) => page - 1)}>Précédent</button><span>Page {importPage + 1} / {Math.ceil(normalizedRows.length / importPageSize)}</span><button type="button" className="btn ghost" disabled={(importPage + 1) * importPageSize >= normalizedRows.length} onClick={() => setImportPage((page) => page + 1)}>Suivant</button></div> : null}
              </>
            ) : null}
            <Field label="Contenu">
              <textarea
                rows={10}
                value={content}
                onChange={(e) => { setContent(e.target.value); setImportRows(null); }}
                placeholder='[{"message":"…","expected":"phishing"}]'
              />
            </Field>
            {draftRows.length ? (
              <>
                <p className="muted">Aperçu ({draftRows.length} premières lignes)</p>
                <SamplePreview rows={draftRows} empty="" />
              </>
            ) : null}
            <div className="form-actions">
              <BusyButton type="submit" busy={busyAction === "upload"} busyLabel="Envoi…" disabled={importRows ? validImportRows.length === 0 : !content.trim()}>
                <CloudUpload size={16} aria-hidden /> Envoyer le dataset
              </BusyButton>
              <BusyButton
                className="btn ghost"
                busy={busyAction === "seed"}
                busyLabel="Import…"
                onClick={onSeed}
              >
                Jeu intégré
              </BusyButton>
            </div>
          </form>
        ) : null}

        {!loading && tab === "train" ? (
          <div className="form-grid">
            <p className="panel-note">
              L’entraînement produit un patch JSON à poids entiers — c’est ce que le téléphone utilise en OTA.
              La case ci-dessous le copie vers le canary à 0 % seulement s’il est publiable.
            </p>
            <Field label="Dataset">
              <select value={datasetId} onChange={(e) => setDatasetId(e.target.value)}>
                {datasets.map((d) => (
                  <option key={d.id} value={d.id}>
                    #{d.id} {d.name} ({d.sample_count})
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
              <BusyButton
                busy={busyAction === "train"}
                busyLabel="Entraînement…"
                onClick={onTrain}
                disabled={!datasetId}
              >
                <Play size={16} aria-hidden /> Lancer l’entraînement
              </BusyButton>
            </div>
          </div>
        ) : null}

        {!loading && tab === "runs" ? (
          <RunList runs={runs} selectedId={selectedRun?.id} onOpen={openRun} onDelete={(id) => setDeleteTarget({ type: "run", id })} />
        ) : null}

        {!loading && tab === "try" ? (
          <div className="form-grid">
            <p className="panel-note">
              Teste le <strong>patch JSON entier</strong> (même math que l’app après mise à jour OTA).
              Ce n’est pas le fichier TFLite bundlé. Sans run sélectionné, le manifeste canary du serveur est utilisé.
              En CLI : <code>make evaluate</code> dans <code>safedm-backend</code>.
            </p>
            <Field label="Run à évaluer (optionnel)">
              <select
                value={selectedRun?.id || ""}
                onChange={(e) => {
                  const id = Number(e.target.value);
                  if (id) openRun(id);
                  else setSelectedRun(null);
                }}
              >
                <option value="">Manifeste canary actuel</option>
                {runs
                  .filter((r) => r.status === "succeeded")
                  .map((r) => (
                    <option key={r.id} value={r.id}>
                      Run #{r.id}
                      {r.publishable ? " · publiable" : ""}
                    </option>
                  ))}
              </select>
            </Field>
            <Field label="Message à classer">
              <textarea rows={5} value={tryText} onChange={(e) => setTryText(e.target.value)} />
            </Field>
            <div className="form-actions">
              <BusyButton busy={busyAction === "try"} busyLabel="Évaluation…" onClick={onTry} disabled={!tryText.trim()}>
                <MessageSquareText size={16} aria-hidden /> Évaluer le message
              </BusyButton>
            </div>
            {tryResult ? <TryResultCard result={tryResult} /> : null}
          </div>
        ) : null}

        {!loading && tab === "tflite" ? (
          <div className="form-grid">
            <p className="panel-note">
              Exécute le fichier <strong>safedm_v3.tflite réellement présent dans l’app mobile</strong> sur les messages
              étiquetés. L’inférence se fait sur le backend local. Les features Kotlin exportées depuis un téléphone
              peuvent être comparées avec le rapport natif généré depuis Paramètres sur le mobile.
            </p>
            <Field label="Dataset d’évaluation">
              <select value={datasetId} onChange={(event) => { setDatasetId(event.target.value); setTfliteResult(null); setMobileFeatures(null); setMobileResults(null); setMobileMessages(null); setMobileFeatureFile(""); }}>
                {datasets.map((dataset) => (
                  <option key={dataset.id} value={dataset.id}>
                    #{dataset.id} {dataset.name} ({dataset.sample_count} exemples)
                  </option>
                ))}
              </select>
            </Field>
            <Field
              label="Coller le rapport Android (optionnel)"
              hint="Sur Android : Paramètres → Diagnostic du modèle local → copier le rapport. Le JSON doit correspondre au dataset choisi."
            >
              <textarea
                rows={4}
                value={mobileReportText}
                onChange={(event) => setMobileReportText(event.target.value)}
                placeholder='Collez ici le JSON copié depuis Paramètres → Diagnostic du modèle local.'
              />
            </Field>
            <div className="form-actions">
              <BusyButton
                className="btn ghost"
                disabled={!mobileReportText.trim()}
                onClick={() => {
                  try {
                    importMobileReport(JSON.parse(mobileReportText), "rapport mobile collé");
                    setError("");
                  } catch (err) {
                    setError(`Rapport Android invalide : ${err.message}`);
                  }
                }}
              >
                Charger le rapport collé
              </BusyButton>
            </div>
            <Field label="Ou importer le rapport JSON">
              <input
                type="file"
                accept=".json,application/json"
                onChange={async (event) => {
                  const file = event.target.files?.[0];
                  setTfliteResult(null);
                  if (!file) {
                    setMobileFeatures(null);
                    setMobileResults(null);
                    setMobileMessages(null);
                    setMobileFeatureFile("");
                    return;
                  }
                  try {
                    const data = JSON.parse(await file.text());
                    importMobileReport(data, file.name);
                  } catch (err) {
                    setMobileFeatures(null);
                    setMobileResults(null);
                    setMobileMessages(null);
                    setMobileFeatureFile("");
                    setError(`Rapport Android invalide : ${err.message}`);
                  }
                }}
              />
            </Field>
            {mobileFeatures ? <p className="muted">Rapport Android chargé : {mobileFeatureFile} · {mobileFeatures.length} vecteurs. Le nombre doit correspondre au dataset.</p> : null}
            <Field label="Patch JSON à comparer" hint="Le run sélectionné est comparé au TFLite. Sans run, le manifeste canary est utilisé s’il existe.">
              <select
                value={selectedRun?.id || ""}
                onChange={(event) => {
                  const id = Number(event.target.value);
                  if (id) openRun(id);
                  else setSelectedRun(null);
                }}
              >
                <option value="">Manifeste canary actuel</option>
                {runs.filter((run) => run.status === "succeeded").map((run) => (
                  <option key={run.id} value={run.id}>Run #{run.id}{run.publishable ? " · publiable" : ""}</option>
                ))}
              </select>
            </Field>
            <div className="form-actions">
              <BusyButton
                busy={busyAction === "tflite-evaluate"}
                busyLabel="Exécution du TFLite…"
                onClick={onEvaluateTflite}
                disabled={!datasetId || busy}
              >
                <Activity size={16} aria-hidden /> Exécuter le diagnostic
              </BusyButton>
            </div>
            {tfliteResult ? <TfliteDiagnostic result={tfliteResult} /> : null}
          </div>
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
              <p>Produit des métriques. Un run publiable a passé les seuils (rappel ≥ 60 %, faux positifs ≤ 10 %).</p>
            </div>
          </li>
          <li>
            <span className="process-num">3</span>
            <div>
              <strong>Tester</strong>
              <p>Onglet Tester : un message → verdict du patch entier (comme le téléphone après OTA).</p>
            </div>
          </li>
          <li>
            <span className="process-num">4</span>
            <div>
              <strong>Pousser vers le canary</strong>
              <p>Copie le modèle dans le manifeste à 0 %. Les téléphones ne basculent pas encore.</p>
            </div>
          </li>
          <li>
            <span className="process-num">5</span>
            <div>
              <strong>Activer dans Opérations</strong>
              <p>
                <Link to="/operations">Opérations</Link> choisit le pourcentage d’appareils.
              </p>
            </div>
          </li>
        </ol>
      </DetailSheet>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title={deleteTarget?.type === "dataset" ? "Supprimer ce dataset ?" : "Supprimer ce run ?"}
        message={deleteTarget?.type === "dataset"
          ? `« ${deleteTarget.name} » et son historique de runs seront supprimés, ainsi que leurs fichiers locaux d’entraînement. Un patch déjà copié dans le canary n’est pas retiré.`
          : "L’historique de ce run et ses fichiers locaux seront supprimés. Un patch déjà copié dans le canary n’est pas retiré."}
        confirmLabel="Supprimer"
        danger
        busy={deleteBusy}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={confirmDelete}
      />

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
            <SamplePreview rows={preview.preview || []} empty="Aucun exemple à afficher." />
            <div className="form-actions">
              <BusyButton
                onClick={() => {
                  setDatasetId(String(preview.id));
                  setPreview(null);
                  setTab("train");
                }}
              >
                Entraîner avec ce jeu
              </BusyButton>
            </div>
          </>
        ) : null}
      </DetailSheet>

      <DetailSheet
        open={Boolean(selectedRun) && tab !== "try"}
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
            <MetricsPanel operational={operational} metrics={fullMetrics} publishable={selectedRun.publishable} />
            <p className="panel-note">
              Pousser vers le canary met ce modèle dans le manifeste à 0 % (en attente).
              Ensuite, dans <Link to="/operations">Opérations</Link>, Approuver avec un pourcentage.
            </p>
            {selectedRun.error_message ? <Alert tone="error">{selectedRun.error_message}</Alert> : null}
            {selectedRun.log_text ? (
              <>
                <h3 className="stack-top">Journal</h3>
                <pre className="log-box">{selectedRun.log_text}</pre>
              </>
            ) : null}
            {selectedRun.status === "succeeded" ? (
              <div className="form-actions">
                <BusyButton
                  busy={busyAction === "promote"}
                  busyLabel="Envoi canary…"
                  onClick={() => onPromote(selectedRun.id)}
                >
                  <Rocket size={16} aria-hidden /> Pousser vers le canary
                </BusyButton>
                <BusyButton
                  className="btn ghost"
                  onClick={() => {
                    setTab("try");
                  }}
                >
                  <MessageSquareText size={16} aria-hidden /> Tester un message
                </BusyButton>
              </div>
            ) : null}
          </>
        ) : null}
      </DetailSheet>
    </div>
  );
}

function MetricsPanel({ operational, metrics, publishable }) {
  if (!operational && !metrics) {
    return <p className="muted">Pas encore de métriques pour ce run.</p>;
  }
  const cards = [
    {
      label: "Rappel",
      value: formatRate(operational?.recall),
      hint: "Part des vrais messages malveillants correctement détectés. Objectif ≥ 60 % pour publier.",
    },
    {
      label: "Faux positifs",
      value: formatRate(operational?.false_positive_rate),
      hint: "Part des messages bénins classés à tort comme menaces. Objectif ≤ 10 % pour publier.",
    },
    {
      label: "Précision",
      value: formatRate(operational?.precision),
      hint: "Parmi les alertes, part qui sont vraiment malveillantes.",
    },
    {
      label: "Faux négatifs",
      value: formatRate(operational?.false_negative_rate),
      hint: "Menaces manquées. Plus bas = mieux.",
    },
    {
      label: "Publiable",
      value: publishable ? "Oui" : "Non",
      hint: "Seuils opérationnels atteints (rappel + faux positifs).",
    },
    {
      label: "CV folds",
      value: metrics?.cv_folds ?? "—",
      hint: "Nombre de plis de validation croisée utilisés pour estimer les métriques.",
    },
  ];
  return (
    <>
      <div className="metrics-grid">
        {cards.map((card) => (
          <article className="metric-card" key={card.label}>
            <span className="muted">{card.label}</span>
            <strong>{card.value}</strong>
            <small>{card.hint}</small>
          </article>
        ))}
      </div>
      {operational?.confusion ? (
        <p className="muted">
          Matrice (seuil opérationnel) — TN {operational.confusion.tn} · FP {operational.confusion.fp} · FN{" "}
          {operational.confusion.fn} · TP {operational.confusion.tp}
        </p>
      ) : null}
    </>
  );
}

function TryResultCard({ result }) {
  return (
    <div className={`try-result ${result.malicious ? "is-bad" : "is-ok"}`}>
      <p>
        Verdict : <strong>{result.malicious ? "Malveillant" : "Bénin"}</strong>
      </p>
      <p className="muted">
        Score {result.score} (seuil {result.threshold_score}) · source {result.source}
      </p>
      <p className="muted">{result.note}</p>
      {result.top_features?.length ? (
        <>
          <h3 className="stack-top">Features les plus contributives</h3>
          <ul className="sample-list">
            {result.top_features.map((f) => (
              <li key={f.name} className="sample-row">
                <span className="pill soft">{f.name}</span>
                <p>
                  valeur {f.value} · poids {f.weight} · contribution {f.contribution}
                </p>
              </li>
            ))}
          </ul>
        </>
      ) : null}
    </div>
  );
}

function TfliteDiagnostic({ result }) {
  const summary = result.tflite || {};
  const patch = result.patch;
  const errors = (result.rows || []).filter((row) =>
    (row.expected_binary === "BENIN" && row.tflite_decision === "DANGEREUX") ||
    (row.expected_binary === "MALVEILLANT" && row.tflite_decision === "BENIN") ||
    row.tflite_decision === "INCERTAIN" ||
    (row.feature_differences?.length || 0) > 0 ||
    row.tflite_mobile_decision_match === false ||
    (row.tflite_mobile_score_delta != null && row.tflite_mobile_score_delta > 0.00001) ||
    (row.patch_decision && (row.patch_decision === "MALVEILLANT") !== row.tflite_binary_dangerous)
  );
  return (
    <section className="form-grid">
      <div className="panel-note">
        <strong>Modèle réellement exécuté :</strong> {result.model?.path} · {result.model?.bytes} octets · entrée {result.model?.input_shape?.join("×")} {result.model?.input_dtype} · {result.sample_count} exemples.
      </div>
      {result.data_quality?.warning ? <Alert tone="error">{result.data_quality.warning}</Alert> : null}
      <div className="metrics-grid">
        <DiagnosticMetric label="Features Android = Python" value={result.parity?.feature_rows_compared ? `${result.parity.feature_rows_exact}/${result.parity.feature_rows_compared}` : "À mesurer"} detail={`${result.parity?.feature_value_mismatches ?? 0} valeurs différentes`} />
        <DiagnosticMetric label="Patch/TFLite identiques" value={result.parity?.patch_comparable_samples ? `${result.parity.tflite_patch_same_binary_decision}/${result.parity.patch_comparable_samples}` : "—"} detail="Comparaison de la décision binaire" />
        <DiagnosticMetric label="Score mobile/Python cohérent" value={result.parity?.mobile_score_rows_compared ? `${result.parity.mobile_score_exact_decisions}/${result.parity.mobile_score_rows_compared}` : "À mesurer"} detail={`Écart max : ${result.parity?.mobile_score_max_delta == null ? "—" : Number(result.parity.mobile_score_max_delta).toFixed(6)}`} />
        <DiagnosticMetric label="Bénins classés dangereux" value={summary.benign_dangerous} detail={`sur ${summary.benign} bénins`} />
        <DiagnosticMetric label="Menaces classées sûres" value={summary.malicious_safe} detail={`sur ${summary.malicious} menaces`} />
        <DiagnosticMetric label="Menaces incertaines" value={summary.malicious_uncertain} detail="Alerte non définitive" />
        <DiagnosticMetric label="Bénins incertains" value={summary.benign_uncertain} detail="À examiner, pas dangereux" />
      </div>
      <p className="muted">
        Décisions TFLite : sûr &lt; {result.model?.thresholds?.safe_below} · incertain jusqu’à {result.model?.thresholds?.dangerous_from} · dangereux à partir de {result.model?.thresholds?.dangerous_from}.
        {patch ? ` Comparaison patch : ${result.parity?.tflite_patch_same_binary_decision}/${result.parity?.patch_comparable_samples} décisions identiques (${patch.source}).` : " Aucun patch JSON scorable pour comparaison."}
      </p>
      <Alert tone="info">
        La comparaison des 50 valeurs Kotlin avec Python n’est pas encore faite dans ce sprint. Ici, les deux modèles utilisent le vecteur de référence Python; le sprint Android ajoutera le contrôle exact de parité.
      </Alert>
      <div className="table-wrap">
        <table>
          <thead><tr><th>Étiquette</th><th>Verdict TFLite</th><th>Verdict app</th><th>Score brut</th><th>Patch</th><th>Catégorie</th><th>Message</th></tr></thead>
          <tbody>
            {errors.map((row) => {
              const categories = [];
              if (row.expected_binary === "BENIN" && row.tflite_decision === "DANGEREUX") categories.push("Faux positif");
              if (row.expected_binary === "MALVEILLANT" && row.tflite_decision === "BENIN") categories.push("Menace manquée");
              if (row.tflite_decision === "INCERTAIN") categories.push("Incertitude");
              if (row.feature_differences?.length) categories.push(`${row.feature_differences.length} features différentes`);
              if (row.tflite_mobile_decision_match === false) categories.push("Décision app/TFLite différente");
              if (row.tflite_mobile_score_delta != null && row.tflite_mobile_score_delta > 0.00001) categories.push(`Score mobile écart ${Number(row.tflite_mobile_score_delta).toFixed(5)}`);
              if (row.patch_decision && (row.patch_decision === "MALVEILLANT") !== row.tflite_binary_dangerous) categories.push("Divergence patch/TFLite");
              const category = categories.join(" · ");
              return (
                <tr key={row.index}>
                  <td>{row.expected_binary}</td>
                  <td>{row.tflite_decision}</td>
                  <td>{row.mobile_decision || "—"}</td>
                  <td>{Number(row.tflite_probability).toFixed(4)}{row.mobile_probability != null ? ` · score app ${Number(row.mobile_probability).toFixed(4)}` : ""}</td>
                  <td>{row.patch_decision || "—"}</td>
                  <td>{category}</td>
                  <td>
                    {row.message}
                    {row.feature_differences?.length ? (
                      <details className="stack-top">
                        <summary>Voir les features divergentes</summary>
                        <ul className="sample-list">
                          {row.feature_differences.map((feature) => (
                            <li key={feature.index} className="sample-row">
                              <span className="pill soft">{feature.name}</span>
                              <p>Python {feature.python} · Android {feature.android}</p>
                            </li>
                          ))}
                        </ul>
                      </details>
                    ) : null}
                  </td>
                </tr>
              );
            })}
            {!errors.length ? <tr><td colSpan="7">Aucune erreur ni incertitude sur ces exemples.</td></tr> : null}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function DiagnosticMetric({ label, value, detail }) {
  return (
    <article className="metric-card">
      <span className="muted">{label}</span>
      <strong>{value ?? 0}</strong>
      <small>{detail}</small>
    </article>
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

function DatasetList({ datasets, datasetId, onOpen, onDelete }) {
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
        <li className="training-list-row" key={d.id}>
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
          <div className="training-row-actions">
            <button type="button" className="btn small danger" aria-label={`Supprimer le dataset ${d.name}`} title="Supprimer ce dataset" onClick={() => onDelete(d.id, d.name)}><Trash2 size={15} aria-hidden /> Supprimer</button>
          </div>
        </li>
      ))}
    </ul>
  );
}

function RunList({ runs, selectedId, onOpen, onDelete }) {
  if (!runs.length) {
    return <EmptyState title="Aucun run" description="Lancez un entraînement pour voir les métriques ici." />;
  }
  return (
    <ul className="catalog-list">
      {runs.map((r) => (
        <li className="training-list-row" key={r.id}>
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
                  Faux positifs {formatRate(r.metrics_summary.false_positive_rate)} · rappel{" "}
                  {formatRate(r.metrics_summary.recall)}
                </small>
              ) : null}
            </span>
            <span className="pill soft">Détail</span>
          </button>
          <div className="training-row-actions">
            <button type="button" className="btn small danger" aria-label={`Supprimer le run ${r.id}`} title="Supprimer ce run" onClick={() => onDelete(r.id)}><Trash2 size={15} aria-hidden /> Supprimer</button>
          </div>
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

function formatRate(value) {
  if (value == null || Number.isNaN(Number(value))) return "N/D";
  return `${(Number(value) * 100).toFixed(1)}%`;
}

function isBenign(label) {
  const value = String(label || "").toLowerCase();
  return ["benign", "safe", "ham", "ok", "legit", "legitimate", "benign_marketing"].includes(value);
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
