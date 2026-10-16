import React, { useCallback, useState } from "react";
import { ActivityIndicator, NativeModules, StyleSheet, Text, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import * as Clipboard from "expo-clipboard";
import { apiRequest } from "../api/client";
import Button from "../components/Button";
import Screen from "../components/Screen";
import ScreenHeader from "../components/ScreenHeader";
import { runBundledTfliteFeatures } from "../services/localThreatClassifier";
import { colors, radii, spacing, typography } from "../theme/tokens";

export default function ModelDiagnosticsScreen({ navigation }) {
  const [datasets, setDatasets] = useState([]);
  const [datasetId, setDatasetId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState("");
  const [summary, setSummary] = useState(null);
  const [reportText, setReportText] = useState("");

  useFocusEffect(
    useCallback(() => {
      let active = true;
      setLoading(true);
      apiRequest("admin/ml/datasets")
        .then((result) => {
          if (!active) return;
          const items = result.items || [];
          setDatasets(items);
          setDatasetId((current) => current || items[0]?.id || null);
        })
        .catch((err) => active && setError(err.message || "Jeux indisponibles"))
        .finally(() => active && setLoading(false));
      return () => { active = false; };
    }, []),
  );

  async function runDiagnostic() {
    if (!datasetId) return;
    setRunning(true);
    setError("");
    setSummary(null);
    try {
      const native = NativeModules.SafeDMNotifications;
      if (!native?.extractFeaturesForDiagnostics) {
        throw new Error("Le module natif de diagnostic n’est pas installé. Recompilez le build Android de développement.");
      }
      const { items = [] } = await apiRequest(`admin/ml/datasets/${datasetId}/cases`);
      if (!items.length || items.length > 500) {
        throw new Error("Choisissez un dataset non vide de 500 exemples maximum pour ce test sur téléphone.");
      }
      const mobileFeatures = [];
      const mobileResults = [];
      for (const item of items) {
        const message = String(item.message || item.text || "").trim();
        const features = await native.extractFeaturesForDiagnostics(message);
        const output = await runBundledTfliteFeatures(features);
        mobileFeatures.push(Array.from(features));
        mobileResults.push({ probability: output.rawProbability, decision: output.decision });
      }
      const report = {
        format: "safedm-mobile-model-diagnostic-v1",
        dataset_id: datasetId,
        mobile_messages: items.map((item) => String(item.message || item.text || "").trim()),
        mobile_features: mobileFeatures,
        mobile_results: mobileResults,
      };
      const serializedReport = JSON.stringify(report);
      await Clipboard.setStringAsync(serializedReport);
      setReportText(serializedReport);
      const dangerous = mobileResults.filter((row) => row.decision === "DANGEROUS").length;
      const uncertain = mobileResults.filter((row) => row.decision === "UNCERTAIN").length;
      const safe = mobileResults.filter((row) => row.decision === "SAFE").length;
      setSummary({ count: items.length, dangerous, uncertain, safe });
    } catch (err) {
      setError(err.message || "Diagnostic mobile impossible");
    } finally {
      setRunning(false);
    }
  }

  return (
    <Screen scroll style={styles.canvas}>
      <ScreenHeader title="Diagnostic du modèle local" onBack={() => navigation.goBack()} />
      <Text style={styles.lead}>
        Calcule les features avec le module Kotlin et exécute directement le TFLite bundlé, sans utiliser le patch JSON OTA.
        Le rapport reste copié dans le presse-papiers de cet appareil.
      </Text>
      {loading ? <ActivityIndicator color={colors.bluePrimary} /> : null}
      {datasets.map((dataset) => (
        <Button
          key={dataset.id}
          label={`#${dataset.id} ${dataset.name} · ${dataset.sample_count} exemples`}
          variant={dataset.id === datasetId ? "primary" : "outline"}
          onPress={() => { setDatasetId(dataset.id); setSummary(null); }}
          style={styles.datasetButton}
        />
      ))}
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <Button label="Exécuter le TFLite sur ce dataset" onPress={runDiagnostic} loading={running} disabled={loading || !datasetId} style={styles.runButton} />
      {summary ? (
        <View style={styles.resultCard}>
          <Text style={styles.resultTitle}>Rapport prêt · {summary.count} messages</Text>
          <Text style={styles.resultBody}>TFLite : {summary.dangerous} dangereux · {summary.uncertain} incertains · {summary.safe} bénins</Text>
          <Text style={styles.resultBody}>Le JSON avec les 50 features et les scores bruts est copié.</Text>
          <Text style={styles.hint}>Collez-le dans Entraînement → Diagnostic local sur le dashboard puis relancez la comparaison.</Text>
          <Button label="Recopier le dernier rapport" onPress={() => Clipboard.setStringAsync(reportText)} variant="outline" style={styles.runButton} />
        </View>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  canvas: { backgroundColor: colors.canvas },
  lead: { ...typography.caption, lineHeight: 20, marginBottom: spacing.md },
  datasetButton: { marginBottom: 8 },
  runButton: { marginTop: spacing.md },
  error: { color: colors.danger, marginTop: spacing.md },
  resultCard: { marginTop: spacing.md, backgroundColor: colors.surface, borderRadius: radii.lg, padding: spacing.md },
  resultTitle: { ...typography.label, marginBottom: 8 },
  resultBody: { ...typography.caption, marginBottom: 6 },
  hint: { ...typography.caption, color: colors.textSecondary, marginTop: 8 },
});
