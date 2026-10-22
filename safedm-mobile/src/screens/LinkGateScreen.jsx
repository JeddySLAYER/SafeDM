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
import AuthPrompt from "../components/AuthPrompt";
import Button from "../components/Button";
import { IconGlyph } from "../components/Icons";
import LinkActions from "../components/LinkActions";
import RiskBadge from "../components/RiskBadge";
import Screen from "../components/Screen";
import ScreenHeader from "../components/ScreenHeader";
import useAuthGate from "../hooks/useAuthGate";
import { confirmDialog } from "../services/appDialog";
import { openUrlExternally } from "../services/notificationBridge";
import { NOTIFICATION_TYPES, notify } from "../services/notifications";
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
  const { requiresAuth, prefer, capture } = useAuthGate();
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
      } else if (data.decision === "BLOCK") {
        // Le lien a ete bloque : on le signale, meme si l'utilisateur ne
        // regarde pas l'ecran. L'URL est dans la notification — c'est elle que
        // l'utilisateur a tente d'ouvrir, pas un contenu de message.
        await notify(NOTIFICATION_TYPES.LINK_BLOCKED, {
          title: "Lien dangereux bloqué",
          body: `SafeDM a bloqué l’ouverture d’un lien à risque élevé.`,
          data: { url: data.url || url },
        });
      }
    } catch (err) {
      // La verification d'un lien passe par le serveur : sans session, on
      // propose de se connecter plutot que d'afficher une erreur morte.
      if (capture(err)) return;
      setError(
        err instanceof ApiError
          ? err.message
          : "Impossible d’analyser ce lien.",
      );
    } finally {
      setLoading(false);
    }
  }, [url, capture]);

  useEffect(() => {
    runAnalysis();
  }, [runAnalysis]);

  async function openAnyway() {
    const target = result?.url || url;
    if (!target) return;
    const ok = await confirmDialog({
      title: "Ouvrir quand même ?",
      message:
        "Ce lien présente un risque. Ouvrir dans le navigateur peut exposer vos informations.",
      confirmLabel: "Ouvrir quand même",
      cancelLabel: "Annuler",
      destructive: true,
    });
    if (!ok) return;
    try {
      await openUrlExternally(target);
    } catch {
      setError("Impossible d’ouvrir le navigateur.");
    }
  }

  async function onReport() {
    const target = result?.url || url;
    if (!target) return;
    const ok = await confirmDialog({
      title: "Signaler ce lien ?",
      message: "Le lien sera signalé à la communauté pour aider à le bloquer.",
      confirmLabel: "Signaler",
      cancelLabel: "Annuler",
    });
    if (!ok) return;
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
      if (capture(err)) return;
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
        <Text style={styles.loadingText}>Vérification en cours…</Text>
        <Text style={styles.urlPreview} numberOfLines={2}>
          {url}
        </Text>
      </Screen>
    );
  }

  if (!result) {
    return (
      <Screen scroll>
        <ScreenHeader title="Vérification du lien" onBack={() => navigation.goBack()} />
        {requiresAuth ? (
          <>
            <Text style={styles.urlPreview}>{url}</Text>
            <AuthPrompt
              navigation={navigation}
              icon="globe"
              prefer={prefer}
              title="Vérifier ce lien"
              body="Le contrôle d'un lien passe par le serveur SafeDM : il demande un compte. Créez-le en quelques secondes, ou connectez-vous si vous en avez déjà un."
              note="Le lien n'a pas été ouvert. Vous pouvez le copier pour l'analyser plus tard."
            />
          </>
        ) : (
          <>
            <Text style={styles.error}>{error || "Analyse impossible."}</Text>
            <Button label="Réessayer" onPress={runAnalysis} style={{ marginTop: 16 }} />
            <Button
              label="Fermer"
              variant="ghost"
              onPress={() => navigation.goBack()}
              style={{ marginTop: 8 }}
            />
          </>
        )}
      </Screen>
    );
  }

  if (decision === "BLOCK") {
    return (
      <Screen scroll>
        <ScreenHeader title="Lien vérifié" onBack={() => navigation.goBack()} />

        <View
          accessible
          accessibilityLabel={`Lien potentiellement dangereux. ${result.headline || "Ce lien présente un risque."}`}
          style={styles.blockHero}
        >
          <View style={styles.blockIcon}>
            <IconGlyph name="warning" color={colors.dangerText} size={30} />
          </View>
          <Text style={styles.blockTitle}>Lien potentiellement dangereux</Text>
          <Text style={styles.blockSub}>
            {result.headline || "Ce lien présente un risque."}
          </Text>
          <Text style={styles.blockUrl} numberOfLines={3}>
            {result.url}
          </Text>
          <LinkActions url={result.url || url} style={{ alignSelf: "center" }} />
        </View>

        <View style={styles.blockCard}>
          <View style={styles.blockScoreRow}>
            <RiskBadge level={level} />
            <Text style={styles.blockScore}>{result.risk_score}/100</Text>
          </View>
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
          Mieux vaut ne pas ouvrir ce lien. Si vous ne l’attendiez pas, ignorez-le.
        </Text>

        {error ? <Text style={styles.error}>{error}</Text> : null}
        {reportMsg ? <Text style={styles.ok}>{reportMsg}</Text> : null}

        {!ackOpen ? (
          <Pressable
            accessible
            accessibilityRole="button"
            accessibilityLabel="J’ai compris le risque. Ouvrir quand même."
            onPress={() => setAckOpen(true)}
            style={styles.dangerLink}
          >
            <Text style={styles.dangerLinkText}>
              J’ai compris le risque. Ouvrir quand même.
            </Text>
          </Pressable>
        ) : (
          <Button
            label="Ouvrir malgré le risque"
            variant="ghost"
            onPress={openAnyway}
            style={{ marginTop: 4 }}
          />
        )}

        <Button
          label="Ne pas ouvrir"
          variant="primary"
          onPress={() => navigation.goBack()}
          style={{ marginTop: 16 }}
        />
        {requiresAuth ? (
          <AuthPrompt
            navigation={navigation}
            icon="flag"
            prefer={prefer}
            title="Signaler ce lien"
            body="Le signalement est transmis à la communauté SafeDM : il demande un compte. Créez-le en quelques secondes, ou connectez-vous si vous en avez déjà un."
          />
        ) : (
          <Button
            label="Signaler ce lien"
            variant="outline"
            onPress={onReport}
            loading={reporting}
            style={{ marginTop: 12 }}
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
          <IconGlyph name="warning" color={colors.blue600} size={22} />
          <Text style={styles.warnTitle}>{result.headline}</Text>
        </View>
        <Text style={styles.urlLine} numberOfLines={3}>
          {result.url}
        </Text>
        <LinkActions url={result.url || url} />
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
        {requiresAuth ? (
          <AuthPrompt
            navigation={navigation}
            icon="flag"
            prefer={prefer}
            title="Signaler ce lien"
            body="Le signalement est transmis à la communauté SafeDM : il demande un compte. Créez-le en quelques secondes, ou connectez-vous si vous en avez déjà un."
          />
        ) : (
          <Button
            label="Signaler"
            variant="ghost"
            onPress={onReport}
            loading={reporting}
            style={{ marginTop: 8 }}
          />
        )}
      </Screen>
    );
  }

  // ALLOW (déjà ouvert en auto ; écran de confirmation)
  return (
    <Screen scroll>
      <ScreenHeader title="Lien vérifié" onBack={() => navigation.goBack()} />
      <View style={styles.okBanner}>
        <IconGlyph name="shield" color={colors.blue600} size={22} />
        <Text style={styles.okTitle}>{result.headline}</Text>
      </View>
      <Text style={styles.urlLine} numberOfLines={3}>
        {result.url}
      </Text>
      <LinkActions url={result.url || url} />
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
  blockHero: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.lg,
    padding: 24,
    alignItems: "center",
    marginBottom: 12,
  },
  blockIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.dangerSoft,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  blockTitle: {
    color: colors.textPrimary,
    fontSize: 20,
    lineHeight: 27,
    fontWeight: "700",
    textAlign: "center",
    marginBottom: 8,
  },
  blockSub: {
    color: colors.textSecondary,
    textAlign: "center",
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 12,
  },
  blockUrl: {
    color: colors.textPrimary,
    fontSize: 13,
    fontWeight: "600",
    textAlign: "center",
  },
  blockCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    padding: 16,
    marginBottom: 12,
  },
  blockScoreRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 12,
  },
  blockScore: { color: colors.textSecondary, fontWeight: "700", fontSize: 13 },
  blockReason: { color: colors.textPrimary, marginBottom: 6, lineHeight: 20 },
  blockVt: { color: colors.dangerText, marginTop: 8, fontWeight: "700" },
  blockAdvice: {
    color: colors.textSecondary,
    lineHeight: 22,
    marginBottom: 20,
    fontSize: 14,
  },
  dangerLink: { marginTop: 14, marginBottom: 4, alignItems: "center" },
  dangerLinkText: {
    color: colors.textSecondary,
    fontSize: 12,
    textDecorationLine: "underline",
  },
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
    backgroundColor: colors.successSoft,
    borderRadius: radii.md,
    padding: 14,
    marginBottom: 14,
  },
  okTitle: { flex: 1, fontWeight: "700", color: colors.textPrimary },
  urlLine: { color: colors.blue800, marginBottom: 8, fontSize: 14 },
  meta: { color: colors.textSecondary, marginBottom: 8, fontSize: 13 },
  reason: { color: colors.textPrimary, marginBottom: 4, lineHeight: 20 },
  advice: { color: colors.textSecondary, lineHeight: 21, marginTop: 8 },
  error: { color: colors.dangerText, marginTop: 12 },
  ok: { color: colors.successText, marginTop: 12, fontWeight: "600" },
});
