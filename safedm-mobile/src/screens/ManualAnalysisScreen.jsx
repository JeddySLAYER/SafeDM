import React, { useState } from "react";
import {
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import * as Clipboard from "expo-clipboard";
import { ApiError } from "../api/client";
import { analyzeMessage } from "../api/analysis";
import Button from "../components/Button";
import { IconBadge, IconGlyph } from "../components/Icons";
import Screen from "../components/Screen";
import ScreenHeader from "../components/ScreenHeader";
import { addAlertFromManualAnalysis } from "../services/alertsStore";
import { classifyLocalMessage } from "../services/localThreatClassifier";
import { colors, radii } from "../theme/tokens";

const MAX = 1000;
const EXAMPLE =
  "URGENT : votre compte bancaire sera bloqué. Validez immédiatement via https://bank-secure-login.example/confirm";

export default function ManualAnalysisScreen({ navigation, route }) {
  const [content, setContent] = useState(route?.params?.initialContent || "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function onPaste() {
    setError("");
    try {
      const text = await Clipboard.getStringAsync();
      if (!text?.trim()) {
        setError("Presse-papiers vide.");
        return;
      }
      setContent(text.trim().slice(0, MAX));
    } catch {
      setError("Impossible de lire le presse-papiers.");
    }
  }

  async function onAnalyze() {
    setError("");
    const text = content.trim();
    if (text.length < 8) {
      setError("Collez un message d’au moins 8 caractères.");
      return;
    }
    setLoading(true);
    try {
      const local = await classifyLocalMessage(text);
      if (local.decision !== "UNAVAILABLE") {
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
          recommendations:
            local.decision === "UNCERTAIN"
              ? ["Une consultation distante nécessite votre consentement explicite"]
              : [],
          urls: [],
          providers: { local: { available: true } },
          content_stored: false,
        };
        await addAlertFromManualAnalysis({ content: text, result });
        navigation.navigate("AnalysisResult", {
          result,
          originalContent: text,
        });
        return;
      }
      const result = await analyzeMessage({
        content: text,
        source: "MANUAL",
      });
      await addAlertFromManualAnalysis({ content: text, result });
      navigation.navigate("AnalysisResult", {
        result,
        originalContent: text,
      });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Analyse impossible.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Screen scroll>
      <ScreenHeader
        title="Analyse manuelle"
        onBack={() => navigation.goBack()}
      />

      <View style={styles.introCard}>
        <IconBadge name="clipboard" size={48} />
        <View style={{ flex: 1 }}>
          <Text style={styles.introTitle}>Collez un message suspect</Text>
          <Text style={styles.introBody}>
            WhatsApp, SMS ou e-mail — analyse en quelques secondes.
          </Text>
        </View>
      </View>

      <View style={styles.labelRow}>
        <Text style={styles.label}>Message à analyser</Text>
        <Text style={styles.counter}>
          {content.length} / {MAX}
        </Text>
      </View>

      <TextInput
        value={content}
        onChangeText={(v) => setContent(v.slice(0, MAX))}
        placeholder={'Ex : « Vous avez gagné un iPhone, cliquez ici »'}
        placeholderTextColor={colors.textMuted}
        multiline
        textAlignVertical="top"
        style={styles.textarea}
      />

      <View style={styles.actionsRow}>
        <Pressable onPress={onPaste} style={styles.pasteRow}>
          <IconGlyph name="clipboard" color={colors.bluePrimary} size={15} />
          <Text style={styles.link}>Coller</Text>
        </Pressable>
        <Pressable onPress={() => setContent(EXAMPLE)}>
          <Text style={styles.link}>Exemple</Text>
        </Pressable>
        <Pressable onPress={() => setContent("")}>
          <Text style={styles.clear}>Effacer</Text>
        </Pressable>
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <Button
        label="Analyser"
        onPress={onAnalyze}
        loading={loading}
        icon={<IconGlyph name="shield" color={colors.white} size={16} />}
        style={{ marginTop: 16 }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  introCard: {
    flexDirection: "row",
    gap: 14,
    alignItems: "center",
    backgroundColor: colors.blueSoft,
    borderRadius: radii.lg,
    padding: 16,
    marginBottom: 24,
  },
  introTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.textPrimary,
    marginBottom: 4,
  },
  introBody: {
    fontSize: 13,
    lineHeight: 18,
    color: colors.textSecondary,
  },
  labelRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  label: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.textPrimary,
  },
  counter: {
    fontSize: 13,
    color: colors.textMuted,
  },
  textarea: {
    minHeight: 160,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    padding: 14,
    fontSize: 15,
    lineHeight: 22,
    color: colors.textPrimary,
    backgroundColor: colors.white,
  },
  actionsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 12,
  },
  pasteRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  link: {
    color: colors.bluePrimary,
    fontWeight: "600",
    fontSize: 13,
  },
  clear: {
    color: colors.textSecondary,
    fontSize: 13,
  },
  error: {
    color: "#F04438",
    marginTop: 12,
  },
});
