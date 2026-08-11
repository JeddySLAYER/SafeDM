import React, { useCallback, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { ApiError } from "../api/client";
import { analyzeMessage } from "../api/analysis";
import { createReport } from "../api/reports";
import AppLogo from "../components/AppLogo";
import Button from "../components/Button";
import RiskBadge from "../components/RiskBadge";
import Screen from "../components/Screen";
import ScreenHeader from "../components/ScreenHeader";
import { fallbackIconForSource } from "../services/appIcons";
import { getAlertById, updateAlert } from "../services/alertsStore";
import {
  riskDescription,
  riskHeadline,
  statusToLevel,
} from "../utils/risk";
import { colors, radii } from "../theme/tokens";

export default function AlertDetailScreen({ navigation, route }) {
  const alertId = route.params?.alertId;
  const [alert, setAlert] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    const item = await getAlertById(alertId);
    setAlert(item);
    setLoading(false);
  }, [alertId]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  async function reanalyze() {
    if (!alert?.fullText && !alert?.preview) return;
    setBusy(true);
    setError("");
    try {
      const content = alert.fullText || alert.preview;
      const result = await analyzeMessage({
        content,
        source: "NOTIFICATION",
        application_package: alert.packageName,
      });
      const patched = await updateAlert(alert.id, {
        level: statusToLevel(result.status, result.severity),
        riskScore: result.risk_score,
        status: result.status,
        reasons: result.reasons || [],
        analyzed: true,
      });
      setAlert(patched);
      navigation.navigate("AnalysisResult", {
        result,
        originalContent: content,
      });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Analyse impossible.");
    } finally {
      setBusy(false);
    }
  }

  async function report() {
    const content = alert?.fullText || alert?.preview;
    if (!content || content.length < 8) {
      setError("Contenu trop court pour signaler.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      await createReport({
        content,
        source: "NOTIFICATION",
        severity:
          alert.level === "high"
            ? "HIGH"
            : alert.level === "low"
              ? "LOW"
              : "MEDIUM",
      });
      setMessage("Signalement envoyé.");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Signalement impossible.");
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <Screen>
        <ScreenHeader title="Alerte" onBack={() => navigation.goBack()} />
        <ActivityIndicator color={colors.bluePrimary} />
      </Screen>
    );
  }

  if (!alert) {
    return (
      <Screen>
        <ScreenHeader title="Alerte" onBack={() => navigation.goBack()} />
        <Text style={styles.muted}>Alerte introuvable.</Text>
      </Screen>
    );
  }

  const level = alert.level || "unknown";

  return (
    <Screen scroll>
      <ScreenHeader title="Détail alerte" onBack={() => navigation.goBack()} />

      <View style={styles.card}>
        <View style={styles.top}>
          <View style={styles.sourceRow}>
            <AppLogo
              packageName={alert.packageName}
              fallbackIcon={fallbackIconForSource(alert.source)}
              size={36}
            />
            <Text style={styles.source}>{alert.source}</Text>
          </View>
          <RiskBadge level={level} />
        </View>
        <Text style={styles.headline}>{riskHeadline(level)}</Text>
        <Text style={styles.desc}>{riskDescription(level)}</Text>
        {alert.riskScore != null ? (
          <Text style={styles.score}>Score : {alert.riskScore}/100</Text>
        ) : null}
        <Text style={styles.body}>{alert.fullText || alert.preview}</Text>
        <Text style={styles.meta}>
          {new Date(alert.createdAt).toLocaleString("fr-FR")}
        </Text>
      </View>

      {(alert.reasons || []).length > 0 ? (
        <>
          <Text style={styles.section}>Raisons</Text>
          {alert.reasons.map((r, i) => (
            <Text key={`${r}-${i}`} style={styles.reason}>
              • {r}
            </Text>
          ))}
        </>
      ) : null}

      {error ? <Text style={styles.error}>{error}</Text> : null}
      {message ? <Text style={styles.ok}>{message}</Text> : null}

      <Button
        label="Analyser / afficher le résultat"
        onPress={reanalyze}
        loading={busy}
        style={{ marginTop: 20 }}
      />
      <Button
        label="Signaler ce message"
        variant="outline"
        onPress={report}
        disabled={busy}
        style={{ marginTop: 12 }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  muted: { color: colors.textSecondary },
  card: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.lg,
    padding: 16,
    marginBottom: 16,
  },
  top: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  sourceRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flexShrink: 1,
  },
  source: { fontWeight: "700", fontSize: 16, color: colors.textPrimary },
  headline: {
    fontSize: 18,
    fontWeight: "700",
    color: colors.textPrimary,
    marginBottom: 4,
  },
  desc: { color: colors.textSecondary, fontSize: 13, marginBottom: 8 },
  score: { fontWeight: "600", color: colors.bluePrimary, marginBottom: 10 },
  body: { fontSize: 14, lineHeight: 22, color: colors.textPrimary },
  meta: { marginTop: 12, fontSize: 12, color: colors.textMuted },
  section: {
    fontWeight: "700",
    color: colors.textPrimary,
    marginBottom: 8,
  },
  reason: { color: colors.textPrimary, marginBottom: 6, fontSize: 14 },
  error: { color: "#F04438", marginTop: 12 },
  ok: { color: "#12B76A", marginTop: 12, fontWeight: "600" },
});
