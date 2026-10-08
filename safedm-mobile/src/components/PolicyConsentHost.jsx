import React, { useEffect, useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { registerPolicyPresenter } from "../services/policyConsent";
import { colors, radii } from "../theme/tokens";

export default function PolicyConsentHost() {
  const [dialog, setDialog] = useState(null);

  useEffect(() => registerPolicyPresenter(setDialog), []);

  function choose(value) {
    const current = dialog;
    setDialog(null);
    current?.resolve?.(value);
  }

  return (
    <Modal visible={Boolean(dialog)} transparent animationType="fade" onRequestClose={() => choose(false)}>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <Text style={styles.title}>{dialog?.title}</Text>
          <ScrollView style={styles.scroll}>
            <Text style={styles.body}>{dialog?.body}</Text>
          </ScrollView>
          <Pressable style={styles.primary} onPress={() => choose(true)}>
            <Text style={styles.primaryLabel}>{dialog?.confirmLabel}</Text>
          </Pressable>
          <Pressable style={styles.secondary} onPress={() => choose(false)}>
            <Text style={styles.secondaryLabel}>{dialog?.cancelLabel}</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(16, 24, 40, 0.45)",
    justifyContent: "center",
    padding: 20,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    padding: 18,
    maxHeight: "80%",
  },
  title: { fontSize: 18, fontWeight: "700", color: colors.textPrimary },
  scroll: { marginTop: 12, maxHeight: 320 },
  body: { fontSize: 15, lineHeight: 22, color: colors.textSecondary },
  primary: {
    marginTop: 16,
    backgroundColor: colors.bluePrimary,
    borderRadius: radii.pill,
    minHeight: 48,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryLabel: { color: colors.white, fontWeight: "700", fontSize: 15 },
  secondary: { marginTop: 8, minHeight: 44, alignItems: "center", justifyContent: "center" },
  secondaryLabel: { color: colors.textSecondary, fontWeight: "600" },
});
