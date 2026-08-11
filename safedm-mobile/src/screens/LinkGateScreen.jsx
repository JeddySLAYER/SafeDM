import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { ApiError } from "../api/client";
import { analyzeUrl } from "../api/analysis";
import { createReport } from "../api/reports";
import Button from "../components/Button";
import { IconGlyph } from "../components/Icons";
import Screen from "../components/Screen";
import ScreenHeader from "../components/ScreenHeader";
import { openUrlExternally } from "../services/notificationBridge";
import { statusToLevel, vtLabel } from "../utils/risk";
import { colors, radii } from "../theme/tokens";

function normalizeIncomingUrl(raw) {
  const value = (raw || "").trim();
  if (!value) return "";
  if (/^https?:\/\//i.test(value)) return value;
  if (/^www\./i.test(value)) return `https://${value}`;
  return "";
}

export default function LinkGateScreen({ navigation, route }) {
  const initialUrl = normalizeIncomingUrl(route?.params?.url);
  const [url] = useState(initialUrl);
  const [loading, setLoading] = useState(true);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [reporting, setReporting] = useState(false);
  const [reportMsg, setReportMsg] = useState("");
  const [ackOpen, setAckOpen] = useState(false);

  const runAnalysis = useCallback(async () => {
    if (!url) {
      setError("Aucun lien à analyser.");
      setLoading(false);
      return;
    }
    setLoading(true);
    setError("");
    try {
      const data = await analyzeUrl(url);
      setResult(data);
      if (data.decision === "ALLOW") {
        // Navigateur EXTERNE uniquement (évite boucle si SafeDM = défaut)
        await openUrlExternally(data.url || url);
      }
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : "Impossible d’analyser ce lien.",
      );
    } finally {
      setLoading(false);
    }
  }, [url]);

  useEffect(() => {
    runAnalysis();
  }, [runAnalysis]);

  async function openAnyway() {
    const target = result?.url || url;
    if (!target) return;
    try {
      await openUrlExternally(target);
    } catch {
      setError("Impossible d’ouvrir le navigateur.");
    }
  }

  async function onReport() {
    const target = result?.url || url;
    if (!target) return;
    setReporting(true);
    setReportMsg("");
    setError("");
    try {
      await createReport({
        content: target,
        source: "DIRECT_REPORT",
        severity:
          result?.severity === "HIGH" || result?.severity === "CRITICAL"
            ? "HIGH"
            : "MEDIUM",
      });
      setReportMsg("Lien signalé à la communauté.");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Signalement impossible.");
    } finally {
      setReporting(false);
    }
  }

  const decision = (result?.decision || "").toUpperCase();
  const level = statusToLevel(result?.status, result?.severity);
  const vt = result?.urls?.[0];

  if (loading) {
    return (
      <Screen contentStyle={styles.center}>
        <ScreenHeader title="Vérification du lien" onBack={() => navigation.goBack()} />
        <ActivityIndicator color={colors.bluePrimary} size="large" />
        <Text style={styles.loadingText}>Analyse VirusTotal & SafeDM…</Text>
        <Text style={styles.urlPreview} numberOfLines={2}>
          {url}
        </Text>
      </Screen>
    );
  }

  if (!result) {
    return (
      <Screen>
        <ScreenHeader title="Vérification du lien" onBack={() => navigation.goBack()} />
        <Text style={styles.error}>{error || "Analyse impossible."}</Text>
        <Button label="Réessayer" onPress={runAnalysis} style={{ marginTop: 16 }} />
        <Button
          label="Fermer"
          variant="ghost"
          onPress={() => navigation.goBack()}
          style={{ marginTop: 8 }}
        />
      </Screen>
    );
  }

  if (decision === "BLOCK") {
    return (
      <Screen scroll contentStyle={styles.blockScreen}>
        <View style={styles.blockHero}>
          <View style={styles.blockIcon}>
            <IconGlyph name="warning" color={colors.white} size={36} />
          </View>
          <Text style={styles.blockTitle}>ALERTE — LIEN DANGEREUX</Text>
          <Text style={styles.blockSub}>{result.headline}</Text>
          <Text style={styles.blockUrl} numberOfLines={3}>
            {result.url}
          </Text>
        </View>

        <View style={styles.blockCard}>
          <Text style={styles.blockScore}>Score {result.risk_score}/100</Text>
          {(result.reasons || []).slice(0, 4).map((r, i) => (
            <Text key={`${r}-${i}`} style={styles.blockReason}>
              • {r}
            </Text>
          ))}
          {vt ? (
            <Text style={styles.blockVt}>{vtLabel(vt.result)}</Text>
          ) : null}
        </View>

        <Text style={styles.blockAdvice}>
          N’ouvrez pas ce lien. Ne saisissez aucun mot de passe ni code. SafeDM
          a bloqué la redirection pour votre sécurité.
        </Text>

        {error ? <Text style={styles.error}>{error}</Text> : null}
        {reportMsg ? <Text style={styles.ok}>{reportMsg}</Text> : null}

        <Button
          label="Ne pas ouvrir"
          variant="dark"
          onPress={() => navigation.goBack()}
        />
        <Button
          label="Signaler ce lien"
          variant="outline"
          onPress={onReport}
          loading={reporting}
          style={{ marginTop: 12 }}
        />

        {!ackOpen ? (
          <Pressable onPress={() => setAckOpen(true)} style={styles.dangerLink}>
            <Text style={styles.dangerLinkText}>
              J’ai compris le risque — ouvrir quand même
            </Text>
          </Pressable>
        ) : (
          <Button
            label="Ouvrir malgré l’alerte"
            variant="ghost"
            onPress={openAnyway}
            style={{ marginTop: 8 }}
          />
        )}
      </Screen>
    );
  }

  if (decision === "WARN") {
    return (
      <Screen scroll>
        <ScreenHeader title="Lien à vérifier" onBack={() => navigation.goBack()} />
        <View style={styles.warnBanner}>
          <IconGlyph name="warning" color={colors.bluePrimary} size={22} />
          <Text style={styles.warnTitle}>{result.headline}</Text>
        </View>
        <Text style={styles.urlLine} numberOfLines={3}>
          {result.url}
        </Text>
        <Text style={styles.meta}>
          Score {result.risk_score}/100 · niveau {level}
        </Text>
        {(result.reasons || []).map((r, i) => (
          <Text key={`${r}-${i}`} style={styles.reason}>
            • {r}
          </Text>
        ))}
        {vt ? <Text style={styles.meta}>{vtLabel(vt.result)}</Text> : null}
        <Text style={styles.advice}>
          L’analyse n’est pas conclusive ou détecte un risque moyen. N’ouvrez ce
          lien que si vous faites confiance à l’expéditeur.
        </Text>
        {error ? <Text style={styles.error}>{error}</Text> : null}
        {reportMsg ? <Text style={styles.ok}>{reportMsg}</Text> : null}
        <Button label="Ouvrir quand même" onPress={openAnyway} style={{ marginTop: 20 }} />
        <Button
          label="Ne pas ouvrir"
          variant="outline"
          onPress={() => navigation.goBack()}
          style={{ marginTop: 12 }}
        />
        <Button
          label="Signaler"
          variant="ghost"
          onPress={onReport}
          loading={reporting}
          style={{ marginTop: 8 }}
        />
      </Screen>
    );
  }

  // ALLOW (déjà ouvert en auto ; écran de confirmation)
  return (
    <Screen scroll>
      <ScreenHeader title="Lien vérifié" onBack={() => navigation.goBack()} />
      <View style={styles.okBanner}>
        <IconGlyph name="shield" color={colors.bluePrimary} size={22} />
        <Text style={styles.okTitle}>{result.headline}</Text>
      </View>
      <Text style={styles.urlLine} numberOfLines={3}>
        {result.url}
      </Text>
      <Text style={styles.advice}>
        Aucun signal critique détecté. Le lien a été ouvert dans votre
        navigateur. Restez vigilant sur les pages de connexion.
      </Text>
      <Button label="Rouvrir le lien" onPress={openAnyway} style={{ marginTop: 20 }} />
      <Button
        label="Terminé"
        variant="outline"
        onPress={() => navigation.goBack()}
        style={{ marginTop: 12 }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: "center", justifyContent: "center" },
  loadingText: {
    marginTop: 16,
    color: colors.textSecondary,
    fontWeight: "600",
  },
  urlPreview: {
    marginTop: 12,
    color: colors.textMuted,
    fontSize: 13,
    textAlign: "center",
    paddingHorizontal: 24,
  },
  blockScreen: { backgroundColor: "#0B0B0B" },
  blockHero: {
    backgroundColor: colors.black,
    borderRadius: radii.lg,
    padding: 24,
    alignItems: "center",
    marginBottom: 16,
  },
  blockIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: "#F04438",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  blockTitle: {
    color: colors.white,
    fontSize: 22,
    fontWeight: "800",
    textAlign: "center",
    marginBottom: 8,
  },
  blockSub: {
    color: "#D0D5DD",
    textAlign: "center",
    fontSize: 14,
    marginBottom: 12,
  },
  blockUrl: {
    color: "#F97066",
    fontSize: 13,
    textAlign: "center",
  },
  blockCard: {
    backgroundColor: "#1A1A1A",
    borderRadius: radii.md,
    padding: 16,
    marginBottom: 16,
  },
  blockScore: { color: colors.white, fontWeight: "700", marginBottom: 10 },
  blockReason: { color: "#E4E7EC", marginBottom: 6, lineHeight: 20 },
  blockVt: { color: "#F97066", marginTop: 8, fontWeight: "700" },
  blockAdvice: {
    color: "#D0D5DD",
    lineHeight: 22,
    marginBottom: 20,
    fontSize: 14,
  },
  dangerLink: { marginTop: 18, alignItems: "center" },
  dangerLinkText: { color: "#98A2B3", fontSize: 12, textDecorationLine: "underline" },
  warnBanner: {
    flexDirection: "row",
    gap: 10,
    alignItems: "center",
    backgroundColor: colors.blueSoft,
    borderRadius: radii.md,
    padding: 14,
    marginBottom: 14,
  },
  warnTitle: { flex: 1, fontWeight: "700", color: colors.textPrimary },
  okBanner: {
    flexDirection: "row",
    gap: 10,
    alignItems: "center",
    backgroundColor: "#ECFDF3",
    borderRadius: radii.md,
    padding: 14,
    marginBottom: 14,
  },
  okTitle: { flex: 1, fontWeight: "700", color: colors.textPrimary },
  urlLine: { color: colors.bluePrimary, marginBottom: 8, fontSize: 14 },
  meta: { color: colors.textSecondary, marginBottom: 8, fontSize: 13 },
  reason: { color: colors.textPrimary, marginBottom: 4, lineHeight: 20 },
  advice: { color: colors.textSecondary, lineHeight: 21, marginTop: 8 },
  error: { color: "#F04438", marginTop: 12 },
  ok: { color: "#12B76A", marginTop: 12, fontWeight: "600" },
});
