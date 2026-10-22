import React, { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { ApiError } from "../api/client";
import { createReport } from "../api/reports";
import AuthPrompt from "../components/AuthPrompt";
import Button from "../components/Button";
import { IconBadge, IconGlyph } from "../components/Icons";
import LinkActions from "../components/LinkActions";
import RiskBadge from "../components/RiskBadge";
import Screen from "../components/Screen";
import ScreenHeader from "../components/ScreenHeader";
import useAuthGate from "../hooks/useAuthGate";
import { confirmDialog } from "../services/appDialog";
import {
  riskDecision,
  riskDescription,
  statusToLevel,
  vtLabel,
} from "../utils/risk";
import { colors, levelTint, radii } from "../theme/tokens";

export default function AnalysisResultScreen({ navigation, route }) {
  const result = route.params?.result;
  const originalContent = route.params?.originalContent || "";
  const { requiresAuth, prefer, capture } = useAuthGate();
  const [reporting, setReporting] = useState(false);
  const [reportMsg, setReportMsg] = useState("");
  const [error, setError] = useState("");

  if (!result) {
    return (
      <Screen>
        <ScreenHeader title="Résultat" onBack={() => navigation.goBack()} />
        <Text style={styles.empty}>Aucun résultat à afficher.</Text>
        <Button
          label="Retour"
          variant="outline"
          onPress={() => navigation.goBack()}
          style={{ marginTop: 16 }}
        />
      </Screen>
    );
  }

  const level = statusToLevel(result.status, result.severity);
  const tint = levelTint[level] || levelTint.unknown;
  const urls = Array.isArray(result.urls) ? result.urls : [];
  const reasons = Array.isArray(result.reasons) ? result.reasons : [];
  const recommendations = Array.isArray(result.recommendations)
    ? result.recommendations.slice(0, 5)
    : [];
  const score = Number.isFinite(Number(result.risk_score))
    ? Number(result.risk_score)
    : null;
  const providerKeys = Object.keys(result.providers || {});
  const modelSource =
    result.model_source ||
    result.modelSource ||
    (providerKeys.length ? "Vérification serveur" : "Modèle local");
  const modelSourceLabel =
    modelSource === "tflite"
      ? "Modèle local embarqué"
      : modelSource === "patch"
        ? "Mise à jour du modèle local"
        : modelSource === "local"
          ? "Modèle local embarqué"
          : providerKeys.length > 0
            ? "Vérification distante"
            : "Modèle local";

  async function onReport() {
    const ok = await confirmDialog({
      title: "Signaler ce message ?",
      message:
        "Le texte du message sera envoyé aux serveurs de SafeDM pour aider à protéger d’autres personnes.",
      confirmLabel: "Signaler",
      cancelLabel: "Annuler",
    });
    if (!ok) return;
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
      if (capture(err)) return;
      setError(err instanceof ApiError ? err.message : "Signalement impossible.");
    } finally {
      setReporting(false);
    }
  }

  return (
    <Screen scroll>
      <ScreenHeader title="Résultat" onBack={() => navigation.goBack()} />

      <View
        accessible
        accessibilityLabel={`${riskDecision(level)}. ${riskDescription(level)}`}
        style={styles.verdict}
      >
        <View style={[styles.verdictIcon, { backgroundColor: tint.bg }]}>
          <IconGlyph name={tint.icon} color={tint.fg} size={30} />
        </View>
        <Text style={styles.verdictTitle}>{riskDecision(level)}</Text>
        <Text style={styles.verdictDesc}>{riskDescription(level)}</Text>
        <View style={styles.verdictMeta}>
          <RiskBadge level={level} />
          <Text style={styles.verdictScore}>
            {score == null ? "Score indisponible" : `Score ${score}/100`}
          </Text>
        </View>
      </View>

      <Text style={styles.source}>Analyse : {modelSourceLabel}</Text>

      {reasons.length > 0 ? (
        <>
          <Text style={styles.section}>Ce qui a été repéré</Text>
          <View style={styles.group}>
            {reasons.slice(0, 5).map((reason, index) => (
              <View key={`${reason}-${index}`} style={styles.reasonRow}>
                <IconBadge
                  name={index === 0 ? "clock" : index === 1 ? "warning" : "shield"}
                  size={34}
                />
                <Text style={styles.reasonText}>{reason}</Text>
              </View>
            ))}
          </View>
        </>
      ) : null}

      {urls.length > 0 ? (
        <>
          <Text style={styles.section}>Liens détectés</Text>
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
                <Pressable
                  onPress={() =>
                    navigation.navigate("LinkGate", { url: item.url })
                  }
                  style={styles.urlMain}
                  accessible
                  accessibilityRole="button"
                  accessibilityLabel={`${vtLabel(item.result)} : ${item.url}. Vérifier avant d’ouvrir.`}
                >
                  <IconGlyph
                    name={malicious || suspicious ? "warning" : "globe"}
                    color={
                      malicious
                        ? colors.dangerText
                        : suspicious
                          ? colors.blue800
                          : colors.textSecondary
                    }
                    size={18}
                  />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.urlText} numberOfLines={1}>
                      {item.url}
                    </Text>
                    <Text
                      style={[
                        styles.urlLabel,
                        malicious && { color: colors.dangerText },
                        suspicious && { color: colors.blue800 },
                      ]}
                    >
                      {vtLabel(item.result)} · Toucher pour vérifier avant d’ouvrir
                    </Text>
                  </View>
                </Pressable>
                <LinkActions url={item.url} style={{ paddingLeft: 30 }} />
              </View>
            );
          })}
        </>
      ) : null}

      {recommendations.length > 0 ? (
        <>
          <Text style={styles.section}>Ce qu’il faut faire</Text>
          <View style={styles.group}>
            {recommendations.map((rec, index) => (
              <View key={`${rec}-${index}`} style={styles.recRow}>
                <View style={styles.checkCircle}>
                  <IconGlyph
                    name="check"
                    color={colors.white}
                    size={12}
                    strokeWidth={3}
                  />
                </View>
                <Text style={styles.recText}>{rec}</Text>
              </View>
            ))}
          </View>
        </>
      ) : null}

      {error ? <Text style={styles.error}>{error}</Text> : null}
      {reportMsg ? <Text style={styles.ok}>{reportMsg}</Text> : null}

      {requiresAuth ? (
        <AuthPrompt
          navigation={navigation}
          icon="flag"
          prefer={prefer}
          title="Signaler ce message"
          body="Le signalement est transmis à la communauté SafeDM : il demande un compte. Créez-le en quelques secondes, ou connectez-vous si vous en avez déjà un."
          note="Le résultat de l'analyse ci-dessus reste visible sans compte."
        />
      ) : (
        <Button
          label="Signaler ce message"
          variant="outline"
          onPress={onReport}
          loading={reporting}
          icon={<IconGlyph name="flag" color={colors.blue800} size={16} />}
          accessibilityLabel="Signaler ce message à la communauté. Le texte sera envoyé au serveur."
          style={{ marginTop: 24 }}
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  empty: {
    color: colors.textSecondary,
    fontSize: 15,
    lineHeight: 22,
  },
  verdict: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.lg,
    padding: 24,
    alignItems: "center",
    marginBottom: 8,
  },
  verdictIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  verdictTitle: {
    fontSize: 20,
    lineHeight: 27,
    fontWeight: "700",
    color: colors.textPrimary,
    textAlign: "center",
    marginBottom: 8,
  },
  verdictDesc: {
    fontSize: 14,
    lineHeight: 20,
    color: colors.textSecondary,
    textAlign: "center",
    marginBottom: 16,
  },
  verdictMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  verdictScore: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.textSecondary,
  },
  source: {
    fontSize: 12,
    color: colors.textSecondary,
    textAlign: "center",
    marginBottom: 8,
  },
  section: {
    fontSize: 15,
    fontWeight: "700",
    color: colors.textPrimary,
    marginBottom: 10,
    marginTop: 16,
  },
  group: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    padding: 16,
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
    lineHeight: 20,
    color: colors.textPrimary,
  },
  urlBanner: {
    borderRadius: radii.md,
    padding: 14,
    marginBottom: 10,
  },
  urlMain: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  urlMalicious: {
    backgroundColor: colors.dangerSoft,
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
    backgroundColor: colors.successText,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 1,
  },
  recText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
    color: colors.textPrimary,
  },
  error: { color: colors.dangerText, marginTop: 12 },
  ok: { color: colors.successText, marginTop: 12, fontWeight: "600" },
});
