import React, { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { ApiError } from "../api/client";
import { createReport } from "../api/reports";
import Button from "../components/Button";
import { IconBadge, IconGlyph } from "../components/Icons";
import Screen from "../components/Screen";
import ScreenHeader from "../components/ScreenHeader";
import {
  riskDescription,
  riskHeadline,
  statusToLevel,
  vtLabel,
} from "../utils/risk";
import { colors, radii } from "../theme/tokens";

function ScoreRing({ score, level }) {
  const ringColor =
    level === "high"
      ? colors.black
      : level === "medium"
        ? colors.bluePrimary
        : level === "low"
          ? colors.risk.low.bg
          : colors.textMuted;

  return (
    <View style={[styles.ring, { borderColor: ringColor }]}>
      <Text style={styles.score}>{score}</Text>
    </View>
  );
}

export default function AnalysisResultScreen({ navigation, route }) {
  const result = route.params?.result;
  const originalContent = route.params?.originalContent || "";
  const [reporting, setReporting] = useState(false);
  const [reportMsg, setReportMsg] = useState("");
  const [error, setError] = useState("");

  if (!result) {
    return (
      <Screen>
        <ScreenHeader title="Résultat" onBack={() => navigation.goBack()} />
        <Text style={styles.empty}>Aucun résultat à afficher.</Text>
      </Screen>
    );
  }

  const level = statusToLevel(result.status, result.severity);
  const urls = Array.isArray(result.urls) ? result.urls : [];
  const reasons = Array.isArray(result.reasons) ? result.reasons : [];
  const recommendations = Array.isArray(result.recommendations)
    ? result.recommendations
    : [];

  async function onReport() {
    setError("");
    setReportMsg("");
    setReporting(true);
    try {
      await createReport({
        content: originalContent,
        source: "MANUAL_ANALYSIS",
        severity: result.severity || "MEDIUM",
      });
      setReportMsg("Message signalé à la communauté.");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Signalement impossible.");
    } finally {
      setReporting(false);
    }
  }

  return (
    <Screen scroll>
      <ScreenHeader title="Résultat" onBack={() => navigation.goBack()} />

      <View style={styles.scoreCard}>
        <ScoreRing score={result.risk_score ?? 0} level={level} />
        <View style={{ flex: 1 }}>
          <Text style={styles.headline}>{riskHeadline(level)}</Text>
          <Text style={styles.desc}>{riskDescription(level)}</Text>
        </View>
      </View>

      {reasons.length > 0 ? (
        <>
          <Text style={styles.section}>Raisons détectées</Text>
          {reasons.map((reason, index) => (
            <View key={`${reason}-${index}`} style={styles.reasonRow}>
              <IconBadge
                name={index === 0 ? "clock" : index === 1 ? "warning" : "shield"}
                size={36}
              />
              <Text style={styles.reasonText}>{reason}</Text>
            </View>
          ))}
        </>
      ) : null}

      {urls.length > 0 ? (
        <>
          <Text style={styles.section}>Analyse des liens</Text>
          {urls.map((item) => {
            const resultCode = (item.result || "UNKNOWN").toUpperCase();
            const malicious = resultCode === "MALICIOUS";
            const suspicious = resultCode === "SUSPICIOUS";
            return (
              <View
                key={item.url}
                style={[
                  styles.urlBanner,
                  malicious && styles.urlMalicious,
                  suspicious && styles.urlSuspicious,
                  !malicious && !suspicious && styles.urlNeutral,
                ]}
              >
                <IconGlyph
                  name="warning"
                  color={malicious ? colors.white : colors.bluePrimary}
                  size={18}
                />
                <View style={{ flex: 1 }}>
                  <Text
                    style={[
                      styles.urlText,
                      malicious && { color: colors.white },
                    ]}
                    numberOfLines={1}
                  >
                    {item.url}
                  </Text>
                  <Text
                    style={[
                      styles.urlLabel,
                      malicious && { color: "#D0D5DD" },
                      suspicious && { color: colors.bluePrimary },
                    ]}
                  >
                    {vtLabel(item.result)}
                  </Text>
                </View>
              </View>
            );
          })}
        </>
      ) : null}

      {recommendations.length > 0 ? (
        <>
          <Text style={styles.section}>Recommandations</Text>
          {recommendations.map((rec, index) => (
            <View key={`${rec}-${index}`} style={styles.recRow}>
              <View style={styles.checkCircle}>
                <Text style={styles.checkMark}>✓</Text>
              </View>
              <Text style={styles.recText}>{rec}</Text>
            </View>
          ))}
        </>
      ) : null}

      {error ? <Text style={styles.error}>{error}</Text> : null}
      {reportMsg ? <Text style={styles.ok}>{reportMsg}</Text> : null}

      <Button
        label="Signaler ce message"
        variant="outline"
        onPress={onReport}
        loading={reporting}
        icon={<IconGlyph name="flag" color={colors.bluePrimary} size={16} />}
        style={{ marginTop: 24 }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  empty: { color: colors.textSecondary },
  scoreCard: {
    flexDirection: "row",
    gap: 16,
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.lg,
    padding: 16,
    marginBottom: 24,
  },
  ring: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 5,
    alignItems: "center",
    justifyContent: "center",
  },
  score: {
    fontSize: 24,
    fontWeight: "700",
    color: colors.textPrimary,
  },
  headline: {
    fontSize: 18,
    fontWeight: "700",
    color: colors.textPrimary,
    marginBottom: 4,
  },
  desc: {
    fontSize: 13,
    lineHeight: 18,
    color: colors.textSecondary,
  },
  section: {
    fontSize: 15,
    fontWeight: "700",
    color: colors.textPrimary,
    marginBottom: 12,
    marginTop: 8,
  },
  reasonRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 12,
  },
  reasonText: {
    flex: 1,
    fontSize: 14,
    color: colors.textPrimary,
  },
  urlBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderRadius: radii.md,
    padding: 14,
    marginBottom: 10,
  },
  urlMalicious: {
    backgroundColor: colors.black,
  },
  urlSuspicious: {
    backgroundColor: colors.blueSoft,
  },
  urlNeutral: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  urlText: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.textPrimary,
  },
  urlLabel: {
    fontSize: 12,
    marginTop: 2,
    color: colors.textSecondary,
  },
  recRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    marginBottom: 12,
  },
  checkCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: colors.bluePrimary,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 1,
  },
  checkMark: {
    color: colors.white,
    fontSize: 12,
    fontWeight: "700",
  },
  recText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
    color: colors.textPrimary,
  },
  error: { color: "#F04438", marginTop: 12 },
  ok: { color: "#12B76A", marginTop: 12, fontWeight: "600" },
});
