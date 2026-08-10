import React, { useState } from "react";
import {
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { ApiError } from "../api/client";
import { analyzeMessage } from "../api/analysis";
import Button from "../components/Button";
import { IconBadge, IconGlyph } from "../components/Icons";
import Screen from "../components/Screen";
import ScreenHeader from "../components/ScreenHeader";
import { colors, radii } from "../theme/tokens";

const MAX = 1000;
const EXAMPLE =
  "URGENT : votre compte bancaire sera bloqué. Validez immédiatement via https://bank-secure-login.example/confirm";

export default function ManualAnalysisScreen({ navigation }) {
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function onAnalyze() {
    setError("");
    const text = content.trim();
    if (text.length < 8) {
      setError("Collez un message d’au moins 8 caractères.");
      return;
    }
    setLoading(true);
    try {
      const result = await analyzeMessage({
        content: text,
        source: "MANUAL",
      });
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
        <Pressable onPress={() => setContent(EXAMPLE)}>
          <Text style={styles.link}>Exemple de message</Text>
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
    justifyContent: "space-between",
    marginTop: 12,
  },
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
