import React, { useCallback, useEffect, useState } from "react";
import {
  Alert,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import * as Clipboard from "expo-clipboard";
import { ApiError } from "../api/client";
import { analyzeFeatureVector, analyzeMessage } from "../api/analysis";
import * as usersApi from "../api/users";
import BrandMark from "../components/BrandMark";
import Button from "../components/Button";
import AppLogo from "../components/AppLogo";
import { IconBadge, IconGlyph } from "../components/Icons";
import RiskBadge from "../components/RiskBadge";
import Screen from "../components/Screen";
import { fallbackIconForSource } from "../services/appIcons";
import { subscribeAlertsChanged } from "../services/alertsEvents";
import {
  addAlertFromManualAnalysis,
  formatAlertWhen,
  listAlerts,
} from "../services/alertsStore";
import {
  classifyLocalFeatures,
  extractLocalFeatures,
} from "../services/localThreatClassifier";
import {
  getEnabledPackageNames,
  isNotificationAccessEnabled,
  syncMonitoredPackages,
} from "../services/notificationBridge";
import { ensureContentUploadConsent } from "../utils/cloudConsent";
import { getHideSensitivePreview } from "../utils/storage";
import { colors, radii } from "../theme/tokens";

const MAX = 1000;
const MIN_ANALYZE = 8;

function QuickCard({ icon, label, onPress }) {
  return (
    <Pressable style={styles.quickCard} onPress={onPress}>
      <IconBadge name={icon} size={44} />
      <Text style={styles.quickLabel}>{label}</Text>
    </Pressable>
  );
}

export default function HomeScreen({ navigation }) {
  const [alerts, setAlerts] = useState([]);
  const [enabledApps, setEnabledApps] = useState([]);
  const [accessOn, setAccessOn] = useState(false);
  const [draft, setDraft] = useState("");
  const [analyzing, setAnalyzing] = useState(false);
  const [captureError, setCaptureError] = useState("");
  const [hidePreview, setHidePreview] = useState(false);

  const refreshAlerts = useCallback(async () => {
    const items = await listAlerts();
    setAlerts(items.slice(0, 3));
  }, []);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      (async () => {
        try {
          const prefs = await usersApi.getMonitoring();
          const packages = (prefs || [])
            .filter((p) => p.enabled && p.application?.package_name)
            .map((p) => p.application.package_name);
          await syncMonitoredPackages(packages);
        } catch {
          /* offline / non authentifié */
        }
        const [packages, enabled] = await Promise.all([
          getEnabledPackageNames(),
          isNotificationAccessEnabled(),
        ]);
        const hide = await getHideSensitivePreview();
        if (!active) return;
        setEnabledApps(packages);
        setAccessOn(enabled);
        setHidePreview(hide);
        await refreshAlerts();
      })();
      return () => {
        active = false;
      };
    }, [refreshAlerts]),
  );

  useEffect(() => subscribeAlertsChanged(refreshAlerts), [refreshAlerts]);

  const monitoringLabel =
    enabledApps.length === 0
      ? "Aucune app sélectionnée"
      : enabledApps
          .map((p) => {
            if (p.includes("whatsapp")) return "WhatsApp";
            if (p.includes("messaging") || p.includes("mms")) return "SMS";
            if (p.includes("gm") || p.includes("outlook")) return "Email";
            return p;
          })
          .filter((v, i, a) => a.indexOf(v) === i)
          .join(" · ");

  async function onPaste() {
    setCaptureError("");
    try {
      const text = await Clipboard.getStringAsync();
      if (!text?.trim()) {
        setCaptureError("Presse-papiers vide.");
        return;
      }
      setDraft(text.trim().slice(0, MAX));
    } catch {
      setCaptureError("Impossible de lire le presse-papiers.");
    }
  }

  async function onQuickAnalyze() {
    setCaptureError("");
    const text = draft.trim();
    if (!text) {
      setCaptureError("Collez un message ou un lien à analyser.");
      return;
    }
    // Lien seul → Link Gate (analyse avant ouverture)
    const urlOnly = text.match(/^(https?:\/\/\S+|www\.\S+)$/i);
    if (urlOnly) {
      const url = text.toLowerCase().startsWith("www.")
        ? `https://${text}`
        : text;
      setDraft("");
      navigation.navigate("LinkGate", { url });
      return;
    }
    if (text.length < MIN_ANALYZE) {
      navigation.navigate("ManualAnalysis", { initialContent: text });
      return;
    }
    setAnalyzing(true);
    try {
      const features = await extractLocalFeatures(text);
      const local = features
        ? await classifyLocalFeatures(features)
        : { decision: "UNAVAILABLE", confidence: null, riskScore: null };

      if (local.decision !== "UNAVAILABLE") {
        if (local.decision === "UNCERTAIN") {
          const remoteResult = await new Promise((resolve) => {
            Alert.alert(
              "Analyse complémentaire",
              "Le modèle local est incertain. Avec votre accord, seuls 50 paramètres numériques seront transmis. Le texte ne sera pas envoyé.",
              [
                {
                  text: "Refuser",
                  style: "cancel",
                  onPress: () => resolve(null),
                },
                {
                  text: "Autoriser",
                  onPress: () =>
                    analyzeFeatureVector(features)
                      .then(resolve)
                      .catch(() => resolve(null)),
                },
              ],
            );
          });
          if (remoteResult) {
            await addAlertFromManualAnalysis({
              content: text,
              result: remoteResult,
            });
            setDraft("");
            navigation.navigate("AnalysisResult", {
              result: remoteResult,
              originalContent: text,
            });
            return;
          }
        }
        const result = {
          status:
            local.decision === "DANGEROUS"
              ? "DANGEROUS"
              : local.decision === "SAFE"
                ? "SAFE"
                : "PARTIAL",
          risk_score: local.riskScore,
          severity:
            local.decision === "DANGEROUS"
              ? "HIGH"
              : local.decision === "UNCERTAIN"
                ? "MEDIUM"
                : "LOW",
          reasons: ["Décision produite hors ligne par le modèle local"],
          recommendations: [],
          urls: [],
          providers: { local: { available: true } },
          content_stored: false,
        };
        await addAlertFromManualAnalysis({ content: text, result });
        setDraft("");
        navigation.navigate("AnalysisResult", {
          result,
          originalContent: text,
        });
        return;
      }

      const allowed = await ensureContentUploadConsent({
        title: "Analyse cloud",
        message:
          "Le modèle local n’est pas disponible. Autoriser l’envoi du texte à l’API SafeDM ?",
      });
      if (!allowed) {
        setCaptureError(
          "Analyse cloud refusée. Activez l’analyse cloud dans Paramètres.",
        );
        return;
      }
      const result = await analyzeMessage({
        content: text,
        source: "MANUAL",
        consentExternal: true,
      });
      await addAlertFromManualAnalysis({ content: text, result });
      setDraft("");
      navigation.navigate("AnalysisResult", {
        result,
        originalContent: text,
      });
    } catch (err) {
      setCaptureError(
        err instanceof ApiError ? err.message : "Analyse impossible.",
      );
    } finally {
      setAnalyzing(false);
    }
  }

  return (
    <Screen scroll edges={["top", "left", "right"]}>
      <View style={styles.topBar}>
        <BrandMark size={36} compact />
        <Pressable
          onPress={() => navigation.navigate("Alerts")}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel="Voir les alertes"
        >
          <IconGlyph name="bell" color={colors.bluePrimary} size={22} />
        </Pressable>
      </View>

      <View
        style={[
          styles.statusCard,
          accessOn ? styles.statusOn : styles.statusOff,
        ]}
      >
        <View
          style={[
            styles.statusDot,
            {
              backgroundColor: accessOn
                ? colors.bluePrimary
                : colors.textMuted,
            },
          ]}
        />
        <View style={{ flex: 1 }}>
          <Text style={styles.statusTitle}>
            {accessOn ? "Surveillance active" : "Surveillance inactive"}
          </Text>
          <Text style={styles.statusSub}>{monitoringLabel}</Text>
        </View>
      </View>

      {!accessOn ? (
        <View style={styles.warnBanner}>
          <Text style={styles.warnTitle}>Protection incomplète</Text>
          <Text style={styles.warnBody}>
            L’accès notifications n’est pas actif. Les messages ne sont pas
            analysés automatiquement.
          </Text>
          <Button
            label="Activer l’accès notifications"
            onPress={() => navigation.navigate("Permissions")}
            style={{ marginTop: 12 }}
          />
          <Button
            label="Batterie / arrière-plan"
            variant="outline"
            onPress={() => navigation.navigate("BatteryOptimization")}
            style={{ marginTop: 8 }}
          />
        </View>
      ) : null}

      <View style={styles.captureCard}>
        <Text style={styles.captureTitle}>Vérifier un message</Text>
        <Text style={styles.captureHint}>
          Collez un SMS, WhatsApp, e-mail ou un lien suspect — analyse en un
          geste.
        </Text>
        <TextInput
          value={draft}
          onChangeText={(v) => setDraft(v.slice(0, MAX))}
          placeholder="Collez un message ou un lien…"
          placeholderTextColor={colors.textMuted}
          multiline
          textAlignVertical="top"
          style={styles.captureInput}
        />
        <View style={styles.captureActions}>
          <Pressable onPress={onPaste} style={styles.pasteBtn} hitSlop={6}>
            <IconGlyph name="clipboard" color={colors.bluePrimary} size={16} />
            <Text style={styles.pasteLabel}>Coller</Text>
          </Pressable>
          <Text style={styles.counter}>
            {draft.length} / {MAX}
          </Text>
        </View>
        {captureError ? (
          <Text style={styles.captureError}>{captureError}</Text>
        ) : null}
        <Button
          label="Analyser"
          onPress={onQuickAnalyze}
          loading={analyzing}
          icon={<IconGlyph name="shield" color={colors.white} size={16} />}
          style={{ marginTop: 12 }}
        />
        <Pressable
          onPress={() =>
            navigation.navigate("ManualAnalysis", {
              initialContent: draft.trim() || undefined,
            })
          }
          style={styles.expandLink}
        >
          <Text style={styles.link}>Ouvrir l’analyse détaillée</Text>
        </Pressable>
      </View>

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitleInline}>Alertes récentes</Text>
        <Text style={styles.link} onPress={() => navigation.navigate("Alerts")}>
          Voir tout
        </Text>
      </View>

      {alerts.length === 0 ? (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyText}>
            Aucune alerte pour le moment. Les notifications suspectes
            apparaîtront ici.
          </Text>
        </View>
      ) : (
        alerts.map((alert) => (
          <Pressable
            key={alert.id}
            style={styles.alertCard}
            onPress={() =>
              navigation.navigate("AlertDetail", { alertId: alert.id })
            }
          >
            <AppLogo
              packageName={alert.packageName}
              fallbackIcon={fallbackIconForSource(alert.source)}
              size={42}
            />
            <View style={{ flex: 1 }}>
              <View style={styles.alertTitleRow}>
                <Text style={styles.alertSource}>{alert.source}</Text>
                <RiskBadge level={alert.level || "unknown"} />
              </View>
              <Text style={styles.alertPreview} numberOfLines={1}>
                {hidePreview
                  ? "Contenu masqué (Paramètres → confidentialité)"
                  : alert.preview}
              </Text>
              <Text style={styles.alertWhen}>
                {formatAlertWhen(alert.createdAt)}
                {alert.analyzed ? " · Analysé" : ""}
              </Text>
            </View>
          </Pressable>
        ))
      )}

      <Text style={styles.sectionTitle}>Accès rapide</Text>
      <View style={styles.quickRow}>
        <QuickCard
          icon="community"
          label="Communauté"
          onPress={() => navigation.navigate("Community")}
        />
        <QuickCard
          icon="guide"
          label="Guide"
          onPress={() => navigation.navigate("Guide")}
        />
        <QuickCard
          icon="flag"
          label="Signaler"
          onPress={() => navigation.navigate("DirectReport")}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  statusCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderRadius: radii.lg,
    padding: 14,
    marginBottom: 12,
  },
  statusOn: { backgroundColor: colors.blueSoft },
  statusOff: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  statusDot: { width: 10, height: 10, borderRadius: 5 },
  statusTitle: { fontSize: 15, fontWeight: "700", color: colors.textPrimary },
  statusSub: { fontSize: 13, color: colors.textSecondary, marginTop: 2 },
  warnBanner: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    padding: 16,
    marginBottom: 16,
    borderLeftWidth: 4,
    borderLeftColor: colors.danger,
  },
  warnTitle: { fontSize: 15, fontWeight: "700", color: colors.textPrimary },
  warnBody: {
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 6,
    lineHeight: 19,
  },
  captureCard: {
    borderRadius: radii.lg,
    padding: 16,
    marginBottom: 22,
    backgroundColor: colors.surface,
  },
  captureTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.textPrimary,
    marginBottom: 4,
  },
  captureHint: {
    fontSize: 13,
    lineHeight: 18,
    color: colors.textSecondary,
    marginBottom: 12,
  },
  captureInput: {
    minHeight: 88,
    maxHeight: 140,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    padding: 12,
    fontSize: 15,
    lineHeight: 21,
    color: colors.textPrimary,
    backgroundColor: colors.surface,
  },
  captureActions: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 10,
  },
  pasteBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  pasteLabel: {
    color: colors.bluePrimary,
    fontWeight: "700",
    fontSize: 13,
  },
  counter: { fontSize: 12, color: colors.textMuted },
  captureError: { color: "#F04438", marginTop: 10, fontSize: 13 },
  expandLink: { alignItems: "center", marginTop: 12 },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  sectionTitleInline: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.textPrimary,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.textPrimary,
    marginBottom: 12,
    marginTop: 16,
  },
  link: { color: colors.bluePrimary, fontWeight: "600", fontSize: 13 },
  emptyCard: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    padding: 16,
    marginBottom: 8,
  },
  emptyText: { color: colors.textSecondary, lineHeight: 20 },
  alertCard: {
    flexDirection: "row",
    gap: 12,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    padding: 14,
    marginBottom: 10,
    backgroundColor: colors.white,
  },
  alertTitleRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  alertSource: { fontWeight: "700", color: colors.textPrimary },
  alertPreview: { color: colors.textSecondary, fontSize: 13 },
  alertWhen: { color: colors.textMuted, fontSize: 12, marginTop: 4 },
  quickRow: { flexDirection: "row", gap: 10 },
  quickCard: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    padding: 12,
    alignItems: "center",
    gap: 8,
    minHeight: 100,
  },
  quickLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.textPrimary,
    textAlign: "center",
  },
});
