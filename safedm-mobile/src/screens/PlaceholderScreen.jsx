import React from "react";
import { StyleSheet, Text } from "react-native";
import Screen from "../components/Screen";
import { colors } from "../theme/tokens";

/** Placeholder S7 — analyse manuelle UI déjà maquettée. */
export default function PlaceholderScreen({ route }) {
  const title = route?.params?.title || route?.name || "SafeDM";
  const body =
    route?.params?.body ||
    "Cet écran sera complété au Sprint 7 (analyse, communauté, guide).";

  return (
    <Screen>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.body}>{body}</Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 24, fontWeight: "700", color: colors.textPrimary },
  body: {
    marginTop: 10,
    fontSize: 15,
    lineHeight: 22,
    color: colors.textSecondary,
  },
});
