import { useCallback, useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  Activity,
  ArrowRight,
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
  Freshness,
  PageHeader,
  Spinner,
} from "../components/ui";
import { useToast } from "../context/ToastContext";
import { binaryLabel, mlStatus, reviewStatus } from "../copy/glossary";
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
  reviewMlArtifact,
  reviewMlRun,
  seedBuiltinMlDataset,
  startMlTrain,
  tryMlMessage,
} from "../services/adminApi";

const TAB_IDS = ["data", "add", "train", "runs", "try", "tflite"];

const TESTED_RUNS_KEY = "safedm.ml.testedRuns";

function readTestedRuns() {
  try {
    const raw = JSON.parse(localStorage.getItem(TESTED_RUNS_KEY) || "[]");
    return Array.isArray(raw) ? raw : [];
  } catch {
    return [];
  }
}

export default function TrainingPage() {
  const { toast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const [datasets, setDatasets] = useState([]);
  const [runs, setRuns] = useState([]);
  const [selectedRun, setSelectedRun] = useState(null);
  const [datasetId, setDatasetId] = useState("");
  const [preview, setPreview] = useState(null);
  const [tab, setTab] = useState(() => {
    const requested = searchParams.get("tab");
    return TAB_IDS.includes(requested) ? requested : "data";
  });
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
  const [testedRuns, setTestedRuns] = useState(readTestedRuns);
  const [tfliteModelFile, setTfliteModelFile] = useState(null);
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
  const [updatedAt, setUpdatedAt] = useState("");

  const refresh = useCallback(async () => {
    setError("");
    setBusyAction("refresh");
    try {
      const [d, r] = await Promise.all([listMlDatasets(), listMlRuns()]);
      setDatasets(d.items || []);
      setRuns(r.items || []);
      setDatasetId((current) => current || (d.items?.[0] ? String(d.items[0].id) : ""));
      setUpdatedAt(new Date().toISOString());
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

  useEffect(() => {
    const runParam = searchParams.get("run");
    if (!runParam || selectedRun) return;
    if (runs.some((r) => String(r.id) === runParam)) openRun(Number(runParam));
    // openRun is stable enough for this one-shot restore
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [runs]);

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
      "Jeu enregistré");
      setName("");
      setContent("");
      setImportRows(null);
      setDatasetId(String(created.id));
      selectTab("data");
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
      selectTab("data");
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
        null,
      );
      if (promoteCanary) {
        toast(run.publishable ? "Entraînement terminé — préparé pour le canary à 0 %." : "Entraînement terminé — seuils non atteints, aucun canary préparé.", run.publishable ? "success" : "error");
      } else {
        toast("Entraînement terminé");
      }
      showRun(run);
      await refresh();
    } catch {
      /* toast already shown */
    }
  }

  function selectTab(id) {
    if (!TAB_IDS.includes(id)) return;
    setTab(id);
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set("tab", id);
      if (id !== "runs") next.delete("run");
      return next;
    }, { replace: true });
  }

  function showRun(run, { activate = true } = {}) {
    setSelectedRun(run);
    if (run) {
      if (activate) setTab("runs");
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        if (activate) next.set("tab", "runs");
        next.set("run", String(run.id));
        return next;
      }, { replace: true });
    }
  }

  async function openRun(id) {
    try {
      showRun(await runAction("open-run", () => getMlRun(id)), { activate: false });
    } catch {
      /* toast already shown */
    }
  }

  function closeRun() {
    setSelectedRun(null);
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.delete("run");
      return next;
    }, { replace: true });
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
        if (selectedRun?.dataset_id === deleteTarget.id) closeRun();
      } else {
        await deleteMlRun(deleteTarget.id);
        if (selectedRun?.id === deleteTarget.id) closeRun();
      }
      toast(deleteTarget.type === "dataset" ? "Jeu et entraînements associés supprimés" : "Entraînement et fichiers associés supprimés");
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
      await runAction("promote", () => promoteMlRun(id), "Modèle placé en canary à 0 %.");
      setSelectedRun(await getMlRun(id));
      toast("Ouvrez Opérations pour activer un pourcentage.", "success");
    } catch {
      /* toast already shown */
    }
  }

  function markTested(runId) {
    const key = runId ?? "adhoc";
    setTestedRuns((current) => {
      if (current.includes(key)) return current;
      const next = [...current, key];
      try {
        localStorage.setItem(TESTED_RUNS_KEY, JSON.stringify(next));
      } catch {
        /* storage unavailable — keep in memory only */
      }
      return next;
    });
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
      markTested(selectedRun?.id);
    } catch {
      setTryResult(null);
    }
  }

  async function onEvaluateTflite() {
    if (!datasetId) return;
    const result = await runAction(
      "tflite-evaluate",
      () => evaluateMlTflite(datasetId, selectedRun?.id || null, mobileFeatures, mobileResults, mobileMessages, tfliteModelFile),
      "Évaluation du fichier TFLite terminée",
    );
    setTfliteResult(result);
    markTested(selectedRun?.id);
  }

  async function onReviewArtifact(status) {
    const id = tfliteResult?.artifact?.id;
    if (!id) return;
    try {
      const updated = await runAction("review-artifact", () => reviewMlArtifact(id, status), "Revue de l’artefact enregistrée");
      setTfliteResult((current) => ({ ...current, artifact: updated }));
    } catch {
      /* toast already shown */
    }
  }

  async function onReviewRun(status) {
    if (!selectedRun?.id) return;
    try {
      const updated = await runAction("review-run", () => reviewMlRun(selectedRun.id, status), "Revue de l’entraînement enregistrée");
      setSelectedRun(updated);
      await refresh();
    } catch {
      /* toast already shown */
    }
  }

  function importMobileReport(data, label = "rapport Android") {
    const vectors = Array.isArray(data)
      ? data
      : data.mobile_features || data.features || data.rows?.map((row) => row.features || row.mobile_features);
    if (!Array.isArray(vectors) || vectors.some((vector) => !Array.isArray(vector))) {
      throw new Error("Le JSON doit contenir une liste de vecteurs de caractéristiques.");
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
  const tabIds = TAB_IDS;
  const testKey = selectedRun?.id ?? "adhoc";
  const hasTestResult = Boolean(tryResult || tfliteResult) || testedRuns.includes(testKey);
  const stages = buildStages({ datasets, runs, hasTestResult });
  const nextStage = stages.find((stage) => !stage.done);
  const tabState = Object.fromEntries(TAB_IDS.map((id) => [id, stageTabState(id, stages, nextStage)]));

  function moveTab(event, currentId) {
    const currentIndex = tabIds.indexOf(currentId);
    if (currentIndex < 0 || !["ArrowRight", "ArrowDown", "ArrowLeft", "ArrowUp", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    const offset = event.key === "Home" ? 0 : event.key === "End" ? tabIds.length - 1 : (currentIndex + (event.key === "ArrowRight" || event.key === "ArrowDown" ? 1 : -1) + tabIds.length) % tabIds.length;
    const nextId = tabIds[offset];
    selectTab(nextId);
    document.getElementById(`tab-${nextId}`)?.focus();
  }

  return (
    <div>
      <PageHeader
        title="Entraînement"
        subtitle="Préparez un jeu, entraînez, testez un message, puis activez depuis Opérations."
        actions={
          <>
            <Freshness updatedAt={updatedAt} refreshing={busyAction === "refresh"} />
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
        <div className="stage-banner">
          <div className="stage-banner-text">
            <p className="eyebrow">Parcours d’entraînement</p>
            {nextStage ? (
              <button
                type="button"
                className="stage-next"
                onClick={() => selectTab(nextStage.tab)}
                title={`Aller à l’onglet ${nextStage.label}`}
              >
                Prochaine étape : <strong>{nextStage.label}</strong>
                <ArrowRight size={15} aria-hidden />
              </button>
            ) : (
              <p className="stage-next is-complete">
                Cycle complet — <strong>prêt pour la production</strong>
              </p>
            )}
          </div>
          {selectedRun ? <span className="pill soft">Entraînement #{selectedRun.id}</span> : null}
        </div>
        <div className="tabs" role="tablist" aria-label="Parcours d’entraînement">
          <Tab id="data" current={tab} onSelect={selectTab} onKeyDown={moveTab} icon={CloudUpload} title="Jeux" hint="Voir les exemples" state={tabState.data} />
          <Tab id="add" current={tab} onSelect={selectTab} onKeyDown={moveTab} icon={FlaskConical} title="Ajouter" hint="Importer un fichier" state={tabState.add} />
          <Tab id="train" current={tab} onSelect={selectTab} onKeyDown={moveTab} icon={BrainCircuit} title="Entraîner" hint="Calculer le modèle" state={tabState.train} />
          <Tab id="runs" current={tab} onSelect={selectTab} onKeyDown={moveTab} icon={Play} title="Résultats" hint="Métriques et déploiement" state={tabState.runs} />
          <Tab id="try" current={tab} onSelect={selectTab} onKeyDown={moveTab} icon={MessageSquareText} title="Tester" hint="Message → verdict" state={tabState.try} />
          <Tab id="tflite" current={tab} onSelect={selectTab} onKeyDown={moveTab} icon={Activity} title="Diagnostic TFLite" hint="Vérifier le modèle" state={tabState.tflite} />
        </div>

        {loading ? <Spinner label="Chargement…" /> : null}

        {!loading && tab === "data" ? (
          <div id="panel-data" role="tabpanel" tabIndex={0} aria-labelledby="tab-data"><DatasetList datasets={datasets} datasetId={datasetId} onOpen={openDataset} onDelete={(id, name) => setDeleteTarget({ type: "dataset", id, name })} /></div>
        ) : null}

        {!loading && tab === "add" ? (
          <form id="panel-add" className="form-grid" role="tabpanel" tabIndex={0} aria-labelledby="tab-add" onSubmit={onUpload}>
            <Field label="Nom du jeu">
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="ex. phishing-mars" />
            </Field>
            <Field
              label="Fichier JSON ou CSV"
              hint="Indiquez ensuite quelles colonnes contiennent le message et son étiquette (bénin ou malveillant)."
            >
              <input type="file" accept=".json,.csv,text/csv,application/json" onChange={(e) => onFile(e.target.files?.[0])} />
            </Field>
            {importError ? <Alert tone="error">{importError}</Alert> : null}
            {importRows ? (
              <>
                <div className="form-grid">
                  <Field label="Colonne du message"><select value={messageColumn} onChange={(e) => setMessageColumn(e.target.value)}>{importColumns.map((col) => <option key={col}>{col}</option>)}</select></Field>
                  <Field label="Colonne de l'étiquette"><select value={labelColumn} onChange={(e) => setLabelColumn(e.target.value)}>{importColumns.map((col) => <option key={col}>{col}</option>)}</select></Field>
                </div>
                <p className="muted">{normalizedRows.length} lignes non vides · {validImportRows.length} valides · {normalizedRows.length - validImportRows.length} à vérifier</p>
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
                <CloudUpload size={16} aria-hidden /> Enregistrer le jeu
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
          <div id="panel-train" className="form-grid" role="tabpanel" tabIndex={0} aria-labelledby="tab-train">
            <p className="panel-note">
              L’entraînement produit un patch JSON à poids entiers — c’est ce que le téléphone utilise en OTA.
              La case ci-dessous le copie vers le canary à <strong>0 %</strong> seulement s’il est <strong>publiable</strong> (seuils atteints : rappel ≥ 60 %, faux positifs ≤ 10 %) : aucun appareil ne change tant qu’Opérations n’a pas approuvé un pourcentage.
            </p>
            <Field label="Jeu">
              <select value={datasetId} onChange={(e) => setDatasetId(e.target.value)} disabled={Boolean(preview) || loading}>
                {datasets.map((d) => (
                  <option key={d.id} value={d.id}>
                    #{d.id} {d.name} ({d.sample_count})
                  </option>
                ))}
              </select>
            </Field>
            <CheckboxField
              label="Si publiable, préparer le canary à 0 % à la fin (aucun impact appareil)"
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
          <div id="panel-runs" role="tabpanel" tabIndex={0} aria-labelledby="tab-runs"><RunList runs={runs} selectedId={selectedRun?.id} onOpen={openRun} onDelete={(id) => setDeleteTarget({ type: "run", id })} /></div>
        ) : null}

        {!loading && tab === "try" ? (
          <div id="panel-try" className="form-grid" role="tabpanel" tabIndex={0} aria-labelledby="tab-try">
            <p className="panel-note">
              Teste le <strong>patch JSON entier</strong> (même math que l’app après mise à jour OTA).
              Ce n’est pas le fichier TFLite bundlé. Sans entraînement sélectionné, le manifeste canary du serveur est utilisé
              (le canary est la version de modèle actuellement déployée sur une partie du trafic).
            </p>
            <Field label="Entraînement à évaluer (optionnel)">
              <select
                value={selectedRun?.id || ""}
                onChange={(e) => {
                  const id = Number(e.target.value);
                  if (id) openRun(id);
                  else closeRun();
                }}
              >
                <option value="">Manifeste canary actuel</option>
                {runs
                  .filter((r) => r.status === "succeeded")
                  .map((r) => (
                    <option key={r.id} value={r.id}>
                      Entraînement #{r.id}
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
          <div id="panel-tflite" className="form-grid" role="tabpanel" tabIndex={0} aria-labelledby="tab-tflite">
            <p className="panel-note">
              Évaluez un fichier TFLite sur les messages étiquetés. Choisissez un modèle ci-dessous ou laissez le champ
              vide pour utiliser le modèle bundlé dans l’app. L’analyse s’exécute sur le serveur de l’API configurée,
              en local ou après déploiement. Le fichier envoyé est supprimé après l’évaluation.
            </p>
            <h3 className="substep">1 · Sources</h3>
            <Field label="Modèle TFLite à évaluer (optionnel)" hint="Fichier .tflite, jusqu’à 25 Mio. Il est transmis à l’API configurée et conservé temporairement pendant l’évaluation uniquement.">
              <input key={tfliteModelFile ? "model-selected" : "model-empty"} type="file" accept=".tflite,application/octet-stream" onChange={(event) => { setTfliteModelFile(event.target.files?.[0] || null); setTfliteResult(null); }} />
            </Field>
            {tfliteModelFile ? (
              <div className="form-actions">
                <span className="muted">Modèle choisi : {tfliteModelFile.name} · {(tfliteModelFile.size / (1024 * 1024)).toFixed(2)} Mio</span>
                <button type="button" className="btn ghost" onClick={() => { setTfliteModelFile(null); setTfliteResult(null); }}>Utiliser le modèle bundlé</button>
              </div>
            ) : null}
            <Field label="Jeu d’évaluation">
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
              hint="Sur Android : Paramètres → Diagnostic du modèle local → copier le rapport. Le JSON doit correspondre au jeu choisi."
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
            {mobileFeatures ? <p className="muted">Rapport Android chargé : {mobileFeatureFile} · {mobileFeatures.length} vecteurs. Le nombre doit correspondre au jeu.</p> : null}
            <Field label="Patch JSON à comparer" hint="L’entraînement sélectionné est comparé au TFLite. Sans entraînement, le manifeste canary est utilisé s’il existe.">
              <select
                value={selectedRun?.id || ""}
                onChange={(event) => {
                  const id = Number(event.target.value);
                  if (id) openRun(id);
                  else closeRun();
                }}
              >
                <option value="">Manifeste canary actuel</option>
                {runs.filter((run) => run.status === "succeeded").map((run) => (
                  <option key={run.id} value={run.id}>Entraînement #{run.id}{run.publishable ? " · publiable" : ""}</option>
                ))}
              </select>
            </Field>
            <h3 className="substep">2 · Évaluer</h3>
            <div className="form-actions">
              <BusyButton
                busy={busyAction === "tflite-evaluate"}
                busyLabel="Envoi et évaluation…"
                onClick={onEvaluateTflite}
                disabled={!datasetId || busy}
              >
                <Activity size={16} aria-hidden /> Évaluer le modèle
              </BusyButton>
            </div>
            <h3 className="substep">3 · Résultats</h3>
            {tfliteResult ? (
              <>
                <TfliteDiagnostic result={tfliteResult} />
                {tfliteResult.artifact ? (
                  <div className="form-actions">
                    <span className="muted">Revue artefact : {reviewStatus(tfliteResult.artifact.review_status)}</span>
                    <BusyButton className="btn ghost" busy={busyAction === "review-artifact"} onClick={() => onReviewArtifact("approved")}>Approuver l’artefact</BusyButton>
                    <BusyButton className="btn ghost" busy={busyAction === "review-artifact"} onClick={() => onReviewArtifact("rejected")}>Rejeter</BusyButton>
                  </div>
                ) : null}
              </>
            ) : (
              <p className="muted">Lancez une évaluation pour afficher le diagnostic ici.</p>
            )}
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
              <p>Produit des métriques. Un entraînement publiable a passé les seuils (rappel ≥ 60 %, faux positifs ≤ 10 %).</p>
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
        title={deleteTarget?.type === "dataset" ? "Supprimer ce jeu ?" : "Supprimer cet entraînement ?"}
        message={deleteTarget?.type === "dataset"
          ? `« ${deleteTarget.name} » et son historique de runs seront supprimés, ainsi que leurs fichiers locaux d’entraînement. Un patch déjà copié dans le canary n’est pas retiré.`
          : "L’historique de cet entraînement et ses fichiers locaux seront supprimés. Un patch déjà copié dans le canary n’est pas retiré."}
        confirmLabel="Supprimer"
        danger
        busy={deleteBusy}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={confirmDelete}
      />

      <DetailSheet
        open={Boolean(preview)}
        title={preview ? preview.name : "Jeu"}
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
                  selectTab("train");
                }}
              >
                Entraîner avec ce jeu
              </BusyButton>
            </div>
          </>
        ) : null}
      </DetailSheet>

      <DetailSheet
        open={Boolean(selectedRun) && tab !== "try" && tab !== "tflite"}
        title={selectedRun ? `Entraînement #${selectedRun.id}` : "Entraînement"}
        eyebrow="Résultat d’entraînement"
        onClose={closeRun}
      >
        {selectedRun ? (
          <>
            <p>
              Statut : <strong>{mlStatus(selectedRun.status)}</strong>
              {selectedRun.publishable ? " · publiable" : " · non publiable"} · revue{" "}
              <strong>{reviewStatus(selectedRun.review_status)}</strong>
            </p>
            <MetricsPanel operational={operational} metrics={fullMetrics} publishable={selectedRun.publishable} />
            <div className="canary-callout">
              <strong>Impact canary : 0 %</strong>
              <p>La promotion prépare le modèle sans changer le verdict sur les appareils.</p>
              <p className="muted">Prochaine action : approuver un pourcentage dans <Link to="/operations">Opérations</Link>.</p>
            </div>
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
                  className="btn ghost"
                  busy={busyAction === "review-run"}
                  onClick={() => onReviewRun("approved")}
                >
                  Approuver la revue
                </BusyButton>
                <BusyButton
                  busy={busyAction === "promote"}
                  busyLabel="Envoi canary…"
                  onClick={() => onPromote(selectedRun.id)}
                  disabled={selectedRun.review_status !== "approved"}
                >
                  <Rocket size={16} aria-hidden /> Pousser vers le canary
                </BusyButton>
                {selectedRun.review_status !== "approved" ? (
                  <small className="muted">Approuvez la revue avant la promotion canary.</small>
                ) : null}
                <BusyButton
                  className="btn ghost"
                  onClick={() => {
                    selectTab("try");
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
      label: "Validation croisée",
      value: metrics?.cv_folds != null ? `${metrics.cv_folds} plis` : "—",
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
          <h3 className="stack-top">Caractéristiques les plus influentes</h3>
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
  const parityBlocked = (result.parity?.feature_value_mismatches || 0) > 0 ||
    (result.parity?.patch_comparable_samples > 0 && result.parity.tflite_patch_same_binary_decision < result.parity.patch_comparable_samples) ||
    (result.parity?.mobile_score_rows_compared > 0 && result.parity.mobile_score_exact_decisions < result.parity.mobile_score_rows_compared);
  const blocked = Boolean(result.data_quality?.warning) || errors.length > 0 || parityBlocked;
  return (
    <section className="form-grid">
      <div className={`diagnostic-decision ${blocked ? "is-blocked" : "is-pass"}`} role="status">
        <strong>{blocked ? "DÉCISION : BLOQUÉ" : "DÉCISION : PASSÉ"}</strong>
        <span>{blocked ? "Corrigez les divergences ou les exemples signalés avant toute promotion." : "Aucune divergence bloquante détectée sur le jeu évalué."}</span>
      </div>
      <div className="panel-note">
        <strong>Modèle réellement exécuté :</strong> {result.model?.filename || result.model?.path || "fichier transmis"} · source {result.model?.source || "bundled"} · {result.model?.bytes} octets · entrée {result.model?.input_shape?.join("×")} {result.model?.input_dtype} · {result.sample_count} exemples.
        {result.model?.sha256 ? <div>SHA-256 : <code>{result.model.sha256}</code></div> : null}
      </div>
      {result.data_quality?.warning ? <Alert tone="warn">{result.data_quality.warning}</Alert> : null}
      <div className="metrics-grid">
        <DiagnosticMetric label="Caractéristiques Android = Python" value={result.parity?.feature_rows_compared ? `${result.parity.feature_rows_exact}/${result.parity.feature_rows_compared}` : "À mesurer"} detail={`${result.parity?.feature_value_mismatches ?? 0} valeurs différentes`} />
        <DiagnosticMetric label="Patch/TFLite identiques" value={result.parity?.patch_comparable_samples ? `${result.parity.tflite_patch_same_binary_decision}/${result.parity.patch_comparable_samples}` : "—"} detail="Comparaison de la décision binaire" />
        <DiagnosticMetric label="Score mobile/Python cohérent" value={result.parity?.mobile_score_rows_compared ? `${result.parity.mobile_score_exact_decisions}/${result.parity.mobile_score_rows_compared}` : "À mesurer"} detail={`Écart max : ${result.parity?.mobile_score_max_delta == null ? "—" : Number(result.parity.mobile_score_max_delta).toFixed(6)}`} />
        <DiagnosticMetric label="Bénins classés dangereux" value={summary.benign_dangerous} detail={`sur ${summary.benign} bénins`} />
        <DiagnosticMetric label="Menaces classées sûres" value={summary.malicious_safe} detail={`sur ${summary.malicious} menaces`} />
        <DiagnosticMetric label="Menaces incertaines" value={summary.malicious_uncertain} detail="Alerte non définitive" />
        <DiagnosticMetric label="Bénins incertains" value={summary.benign_uncertain} detail="À examiner, pas dangereux" />
        <DiagnosticMetric label="Exactitude TFLite" value={formatRate(result.metrics?.per_class?.BENIN?.accuracy != null && result.metrics?.per_class?.MALVEILLANT?.accuracy != null ? ((result.metrics.per_class.BENIN.correct + result.metrics.per_class.MALVEILLANT.correct) / result.sample_count) : null)} detail="Sur le jeu sélectionné" />
      </div>
      {result.metrics?.confusion_matrix ? (
        <>
          <p className="muted">
            Matrice TFLite — TN {result.metrics.confusion_matrix.tn} · FP {result.metrics.confusion_matrix.fp} · FN {result.metrics.confusion_matrix.fn} · TP {result.metrics.confusion_matrix.tp}
          </p>
          <div style={{ width: "100%", height: 220 }}>
            <ResponsiveContainer>
              <BarChart
                data={[
                  { label: "TN", count: result.metrics.confusion_matrix.tn },
                  { label: "FP", count: result.metrics.confusion_matrix.fp },
                  { label: "FN", count: result.metrics.confusion_matrix.fn },
                  { label: "TP", count: result.metrics.confusion_matrix.tp },
                ]}
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="label" />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="count" className="chart-bar" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </>
      ) : null}
      {result.metrics?.production_comparison?.available ? (
        <p className="muted">
          Comparaison production — {result.metrics.production_comparison.same_decision}/{result.metrics.production_comparison.rows_compared} décisions identiques au modèle bundlé.
        </p>
      ) : null}
      <p className="muted">
        Décisions TFLite : sûr &lt; {result.model?.thresholds?.safe_below} · incertain de {result.model?.thresholds?.safe_below} à {result.model?.thresholds?.dangerous_from} · dangereux ≥ {result.model?.thresholds?.dangerous_from}.
        {patch ? ` Comparaison patch : ${result.parity?.tflite_patch_same_binary_decision}/${result.parity?.patch_comparable_samples} décisions identiques (${patch.source}).` : " Aucun patch JSON scorable pour comparaison."}
      </p>
      <div className="table-wrap">
        <table>
          <thead><tr><th>Étiquette</th><th>Verdict TFLite</th><th>Verdict app</th><th>Score brut</th><th>Patch</th><th>Catégorie</th><th>Message</th></tr></thead>
          <tbody>
            {errors.map((row) => {
              const categories = [];
              if (row.expected_binary === "BENIN" && row.tflite_decision === "DANGEREUX") categories.push("Faux positif");
              if (row.expected_binary === "MALVEILLANT" && row.tflite_decision === "BENIN") categories.push("Menace manquée");
              if (row.tflite_decision === "INCERTAIN") categories.push("Incertitude");
              if (row.feature_differences?.length) categories.push(`${row.feature_differences.length} caractéristiques différentes`);
              if (row.tflite_mobile_decision_match === false) categories.push("Décision app/TFLite différente");
              if (row.tflite_mobile_score_delta != null && row.tflite_mobile_score_delta > 0.00001) categories.push(`Score mobile écart ${Number(row.tflite_mobile_score_delta).toFixed(5)}`);
              if (row.patch_decision && (row.patch_decision === "MALVEILLANT") !== row.tflite_binary_dangerous) categories.push("Divergence patch/TFLite");
              const category = categories.join(" · ");
              return (
                <tr key={row.index}>
                  <td>{binaryLabel(row.expected_binary)}</td>
                  <td>{binaryLabel(row.tflite_decision)}</td>
                  <td>{binaryLabel(row.mobile_decision)}</td>
                  <td>{Number(row.tflite_probability).toFixed(4)}{row.mobile_probability != null ? ` · score app ${Number(row.mobile_probability).toFixed(4)}` : ""}</td>
                  <td>{binaryLabel(row.patch_decision)}</td>
                  <td>{category}</td>
                  <td>
                    {row.message}
                    {row.feature_differences?.length ? (
                      <details className="stack-top">
                        <summary>Voir les caractéristiques divergentes</summary>
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

function Tab({ id, current, onSelect, onKeyDown, icon: Icon, title, hint, state = "none" }) {
  const active = current === id;
  const stateLabel = state === "done" ? "terminée" : state === "next" ? "prochaine étape" : state === "todo" ? "à faire" : "";
  return (
    <button
      id={`tab-${id}`}
      type="button"
      className={active ? "tab active" : "tab"}
      role="tab"
      aria-selected={active}
      aria-controls={`panel-${id}`}
      tabIndex={active ? 0 : -1}
      onClick={() => onSelect(id)}
      onKeyDown={(event) => onKeyDown(event, id)}
    >
      <span className="tab-icon" data-state={state}>
        <Icon size={17} aria-hidden />
        {state === "done" ? <span className="tab-check" aria-hidden>✓</span> : null}
      </span>
      <span className="tab-text">
        <strong>{title}</strong>
        <small>{hint}</small>
      </span>
      {stateLabel ? <span className="sr-only">{stateLabel}</span> : null}
    </button>
  );
}

const LIFECYCLE_TABS = new Set(["data", "train", "runs", "try"]);

function buildStages({ datasets, runs, hasTestResult }) {
  return [
    { id: "data", tab: "data", label: "Données", done: datasets.length > 0 },
    { id: "train", tab: "train", label: "Entraînement", done: runs.some((run) => run.status === "succeeded") },
    { id: "review", tab: "runs", label: "Revue", done: runs.some((run) => run.review_status === "approved") },
    { id: "test", tab: "try", label: "Tests", done: hasTestResult },
    { id: "promote", tab: "runs", label: "Promotion", done: runs.some((run) => run.status === "succeeded" && run.review_status === "approved" && run.promoted_at) },
  ];
}

function stageTabState(tabId, stages, nextStage) {
  if (!LIFECYCLE_TABS.has(tabId)) return "none";
  const owned = stages.filter((stage) => stage.tab === tabId);
  if (owned.length && owned.every((stage) => stage.done)) return "done";
  if (nextStage && nextStage.tab === tabId) return "next";
  return "todo";
}

function DatasetList({ datasets, datasetId, onOpen, onDelete }) {
  if (!datasets.length) {
    return (
      <EmptyState
        title="Aucun jeu"
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
            <button type="button" className="btn small danger" aria-label={`Supprimer le jeu ${d.name}`} title="Supprimer ce jeu" onClick={() => onDelete(d.id, d.name)}><Trash2 size={15} aria-hidden /> Supprimer</button>
          </div>
        </li>
      ))}
    </ul>
  );
}

function RunList({ runs, selectedId, onOpen, onDelete }) {
  if (!runs.length) {
    return <EmptyState title="Aucun entraînement" description="Lancez un entraînement pour voir les métriques ici." />;
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
              Entraînement #{r.id} · {mlStatus(r.status)}
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
            <button type="button" className="btn small danger" aria-label={`Supprimer l’entraînement ${r.id}`} title="Supprimer cet entraînement" onClick={() => onDelete(r.id)}><Trash2 size={15} aria-hidden /> Supprimer</button>
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
