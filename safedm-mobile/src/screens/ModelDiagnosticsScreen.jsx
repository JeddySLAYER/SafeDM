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

/**
 * Horodatage de reference FIXE pour le diagnostic.
 *
 * `hour_off_hours` (41) et `is_weekend` (42) dependent de l'heure de
 * reception. Sans reference fixe, deux executions — ou deux appareils — ne
 * donnent pas le meme vecteur, et la comparaison avec le serveur n'a aucun
 * sens. Cette valeur est reprise telle quelle dans le rapport : le backend
 * peut reproduire exactement le meme vecteur avec
 * `extract_features(message, post_time_ms=<meme valeur>)`.
 *
 * Jeudi 15 janvier 2026, 12:00 UTC : en pleinheur de semaine, sans ambiguite
 * de fuseau (l'extraction Kotlin et Python travaillent toutes les deux en UTC).
 */
const DIAGNOSTIC_POST_TIME_MS = Date.UTC(2026, 0, 15, 12, 0, 0);
const DIAGNOSTIC_PACKAGE_NAME = null;

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
        throw new Error("Le module natif de diagnostic n’est pas installé. Reconstruisez le build Android (le module a été ajouté après la version installée).");
      }
      const { items = [] } = await apiRequest(`admin/ml/datasets/${datasetId}/cases`);
      if (!items.length || items.length > 500) {
        throw new Error("Choisissez un dataset non vide de 500 exemples maximum pour ce test sur téléphone.");
      }
      const mobileFeatures = [];
      const mobileResults = [];
      for (const item of items) {
        const message = String(item.message || item.text || "").trim();
        // L'appel natif est asynchrone : sans `await`, `features` serait la
        // promesse elle-même et `Array.from(features)` produirait [].
        const features = await native.extractFeaturesForDiagnostics(
          message,
          DIAGNOSTIC_POST_TIME_MS,
          DIAGNOSTIC_PACKAGE_NAME,
        );
        if (!Array.isArray(features) || features.length !== 50) {
          throw new Error("L’extraction native n’a pas renvoyé les 50 signaux attendus.");
        }
        const output = await runBundledTfliteFeatures(features);
        mobileFeatures.push(Array.from(features));
        mobileResults.push({ probability: output.rawProbability, decision: output.decision });
      }
      const report = {
        format: "safedm-mobile-model-diagnostic-v1",
        dataset_id: datasetId,
        post_time_ms: DIAGNOSTIC_POST_TIME_MS,
        package_name: DIAGNOSTIC_PACKAGE_NAME,
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
      setError(err.message || "Vérification impossible");
    } finally {
      setRunning(false);
    }
  }

  return (
    <Screen scroll style={styles.canvas}>
      <ScreenHeader title="Vérification du modèle local" onBack={() => navigation.goBack()} />
      <Text style={styles.lead}>
        Calcule les signaux avec le module natif et exécute directement le modèle embarqué, sans passer par le serveur.
        Le rapport contient les messages du jeu de données et les signaux : il reste copié dans le presse-papiers de cet appareil. Ne le partagez qu’avec une destination de confiance.
      </Text>
      {loading ? <ActivityIndicator color={colors.bluePrimary} /> : null}
      {datasets.map((dataset) => (
        <Button
          key={dataset.id}
          label={`#${dataset.id} ${dataset.name} · ${dataset.sample_count} exemples`}
          variant={dataset.id === datasetId ? "primary" : "outline"}
          onPress={() => { setDatasetId(dataset.id); setSummary(null); }}
          accessibilityLabel={`Sélectionner le jeu de données ${dataset.name}, ${dataset.sample_count} exemples`}
          style={styles.datasetButton}
        />
      ))}
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <Button label="Exécuter le modèle sur ce jeu de données" onPress={runDiagnostic} loading={running} disabled={loading || !datasetId} style={styles.runButton} />
      {summary ? (
        <View style={styles.resultCard}>
          <Text style={styles.resultTitle}>Rapport prêt · {summary.count} messages</Text>
          <Text style={styles.resultBody}>Modèle local : {summary.dangerous} dangereux · {summary.uncertain} incertains · {summary.safe} bénins</Text>
          <Text style={styles.resultBody}>Le rapport (JSON) avec les messages, les 50 signaux et les scores bruts est copié. Il peut contenir des données sensibles.</Text>
          <Text style={styles.hint}>Collez-le dans Entraînement → Diagnostic local sur le dashboard puis relancez la comparaison.</Text>
          <Button
            label="Recopier le dernier rapport"
            onPress={() => Clipboard.setStringAsync(reportText)}
            accessibilityLabel="Recopier le rapport sensible dans le presse-papiers"
            variant="outline"
            style={styles.runButton}
          />
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
