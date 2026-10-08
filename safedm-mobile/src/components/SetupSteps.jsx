import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { colors } from "../theme/tokens";

const STEPS = ["Apps", "Notifs", "Batterie", "Liens"];

export default function SetupSteps({ step = 0 }) {
  return (
    <View style={styles.row}>
      {STEPS.map((label, index) => {
        const done = index < step;
        const current = index === step;
        return (
          <View key={label} style={styles.item}>
            <View
              style={[
                styles.dot,
                (done || current) && styles.dotOn,
                current && styles.dotCurrent,
              ]}
            >
              <Text style={[styles.num, (done || current) && styles.numOn]}>
                {index + 1}
              </Text>
            </View>
            <Text style={[styles.label, current && styles.labelOn]}>{label}</Text>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 18,
  },
  item: { alignItems: "center", flex: 1 },
  dot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surfaceMuted,
  },
  dotOn: { backgroundColor: colors.bluePrimary },
  dotCurrent: { borderWidth: 2, borderColor: colors.blue200 },
  num: { fontSize: 13, fontWeight: "700", color: colors.textSecondary },
  numOn: { color: colors.white },
  label: { marginTop: 6, fontSize: 11, color: colors.textMuted },
  labelOn: { color: colors.bluePrimary, fontWeight: "700" },
});
