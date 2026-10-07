import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { colors, radii } from "../theme/tokens";

export default function RiskBadge({ level = "unknown" }) {
  const tone = colors.risk[level] || colors.risk.unknown;
  return (
    <View style={[styles.badge, { backgroundColor: tone.bg }]}>
      <Text style={[styles.text, { color: tone.fg }]}>{tone.label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radii.pill,
  },
  text: {
    fontSize: 12,
    fontWeight: "700",
  },
});
