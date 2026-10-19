import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useUpdateStatus } from "../context/UpdateStatusContext";
import { colors, radii } from "../theme/tokens";

const BG = {
  patching: colors.bluePrimary,
  updating: colors.bluePrimary,
  canary_active: colors.risk.medium.bg,
  ready: colors.risk.low.bg,
  error: colors.danger,
  idle: "transparent",
};

const FG = {
  patching: colors.white,
  updating: colors.white,
  canary_active: colors.risk.medium.text,
  ready: colors.risk.low.text,
  error: colors.white,
  idle: colors.textSecondary,
};

export default function UpdateBanner() {
  const { status, clear } = useUpdateStatus();

  if (!status.visible || status.state === "idle") {
    return null;
  }

  const bg = BG[status.state] || colors.surfaceMuted;
  const fg = FG[status.state] || colors.textPrimary;

  return (
    <View
      style={[styles.wrapper, { backgroundColor: bg }]}
      accessibilityRole={status.state === "error" ? "alert" : "status"}
    >
      <Text style={[styles.text, { color: fg }]}>{status.message}</Text>
      {status.state === "ready" || status.state === "error" ? (
        <Pressable
          onPress={clear}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Fermer"
        >
          <Text style={[styles.close, { color: fg }]}>×</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  text: {
    fontSize: 14,
    fontWeight: "600",
    flex: 1,
  },
  close: {
    fontSize: 20,
    fontWeight: "700",
    paddingHorizontal: 4,
  },
});
