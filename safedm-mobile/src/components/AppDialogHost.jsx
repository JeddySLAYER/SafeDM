import React, { useEffect, useState } from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { finishDialog, registerDialogPresenter } from "../services/appDialog";
import { colors, radii } from "../theme/tokens";

export default function AppDialogHost() {
  const [dialog, setDialog] = useState(null);

  useEffect(() => {
    return registerDialogPresenter(setDialog);
  }, []);

  function choose(value) {
    const current = dialog;
    setDialog(null);
    finishDialog();
    current?.resolve?.(value);
  }

  return (
    <Modal
      visible={Boolean(dialog)}
      transparent
      animationType="fade"
      onRequestClose={() => choose(false)}
    >
      <Pressable style={styles.backdrop} onPress={() => choose(false)}>
        <Pressable style={styles.card} onPress={() => {}}>
          <Text style={styles.title}>{dialog?.title}</Text>
          {dialog?.message ? (
            <Text style={styles.message}>{dialog.message}</Text>
          ) : null}
          <View style={styles.actions}>
            {(dialog?.actions || []).map((action) => (
              <Pressable
                key={action.label}
                onPress={() => choose(action.value)}
                style={[
                  styles.button,
                  action.variant === "primary" && styles.primary,
                  action.variant === "danger" && styles.danger,
                ]}
              >
                <Text
                  style={[
                    styles.buttonLabel,
                    (action.variant === "primary" || action.variant === "danger") &&
                      styles.buttonLabelOn,
                  ]}
                >
                  {action.label}
                </Text>
              </Pressable>
            ))}
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(16, 24, 40, 0.45)",
    justifyContent: "center",
    padding: 24,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    padding: 20,
  },
  title: {
    fontSize: 18,
    fontWeight: "700",
    color: colors.textPrimary,
  },
  message: {
    marginTop: 8,
    fontSize: 15,
    lineHeight: 22,
    color: colors.textSecondary,
  },
  actions: {
    marginTop: 18,
    gap: 8,
  },
  button: {
    minHeight: 48,
    borderRadius: radii.pill,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surfaceMuted,
  },
  primary: { backgroundColor: colors.bluePrimary },
  danger: { backgroundColor: colors.danger },
  buttonLabel: {
    fontSize: 15,
    fontWeight: "700",
    color: colors.textPrimary,
  },
  buttonLabelOn: { color: colors.white },
});
