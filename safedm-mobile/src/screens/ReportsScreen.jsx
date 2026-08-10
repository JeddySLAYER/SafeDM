import React from "react";
import { StyleSheet, Text } from "react-native";
import Screen from "../components/Screen";
import { colors } from "../theme/tokens";

export default function ReportsScreen() {
  return (
    <Screen>
      <Text style={styles.title}>Signalements</Text>
      <Text style={styles.subtitle}>
        Vos signalements communautaires arriveront au Sprint 7.
      </Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 28, fontWeight: "700", color: colors.textPrimary },
  subtitle: {
    marginTop: 8,
    fontSize: 15,
    lineHeight: 22,
    color: colors.textSecondary,
  },
});
