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
import { createReport } from "../api/reports";
import Button from "../components/Button";
import { IconBadge, IconGlyph } from "../components/Icons";
import Screen from "../components/Screen";
import ScreenHeader from "../components/ScreenHeader";
import { colors, radii } from "../theme/tokens";

const MAX = 2000;

export default function DirectReportScreen({ navigation }) {
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

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

  async function onSubmit() {
    setError("");
    setDone(false);
    const text = content.trim();
    if (text.length < 8) {
      setError("Le message doit contenir au moins 8 caractères.");
      return;
    }
    setLoading(true);
    try {
      await createReport({
        content: text,
        source: "DIRECT_REPORT",
        severity: "MEDIUM",
      });
      setDone(true);
      setContent("");
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : "Signalement impossible.",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <Screen scroll>
      <ScreenHeader
        title="Signaler un message"
        onBack={() => navigation.goBack()}
      />

      <View style={styles.introCard}>
        <IconBadge name="flag" size={48} />
        <View style={{ flex: 1 }}>
          <Text style={styles.introTitle}>Contribution communautaire</Text>
          <Text style={styles.introBody}>
            En signalant, vous autorisez la conservation de ce contenu pour
            protéger d’autres utilisateurs.
          </Text>
        </View>
      </View>

      <View style={styles.labelRow}>
        <Text style={styles.label}>Contenu à signaler</Text>
        <Text style={styles.counter}>
          {content.length} / {MAX}
        </Text>
      </View>

      <TextInput
        value={content}
        onChangeText={(v) => setContent(v.slice(0, MAX))}
        placeholder="Collez le message ou le lien malveillant…"
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
        <Pressable onPress={() => setContent("")}>
          <Text style={styles.clear}>Effacer</Text>
        </Pressable>
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}
      {done ? (
        <Text style={styles.ok}>
          Message signalé. Merci — la communauté en bénéficie.
        </Text>
      ) : null}

      <Button
        label="Confirmer le signalement"
        onPress={onSubmit}
        loading={loading}
        icon={<IconGlyph name="flag" color={colors.white} size={16} />}
        style={{ marginTop: 16 }}
      />

      <Button
        label="Voir mes signalements"
        variant="outline"
        onPress={() => navigation.navigate("MainTabs", { screen: "Reports" })}
        style={{ marginTop: 12 }}
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
  ok: {
    color: colors.risk.low.bg,
    marginTop: 12,
    fontWeight: "600",
  },
});
