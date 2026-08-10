import React from "react";
import { View, StyleSheet } from "react-native";
import { colors } from "../theme/tokens";

/** Logo icône SafeDM — cercle + 3 segments (signal) */
export default function SafeDMLogo({ size = 40, color = colors.bluePrimary }) {
  const unit = size / 64;
  return (
    <View style={{ width: size, height: size }}>
      <View
        style={[
          styles.dot,
          {
            width: 24 * unit,
            height: 24 * unit,
            borderRadius: 12 * unit,
            backgroundColor: color,
            top: 24 * unit,
            left: 20 * unit,
          },
        ]}
      />
      <View
        style={[
          styles.bar,
          {
            width: 8 * unit,
            height: 12 * unit,
            borderRadius: 2 * unit,
            backgroundColor: color,
            top: 6 * unit,
            left: 28 * unit,
          },
        ]}
      />
      <View
        style={[
          styles.bar,
          {
            width: 8 * unit,
            height: 12 * unit,
            borderRadius: 2 * unit,
            backgroundColor: color,
            top: 10 * unit,
            left: 10 * unit,
            transform: [{ rotate: "-40deg" }],
          },
        ]}
      />
      <View
        style={[
          styles.bar,
          {
            width: 8 * unit,
            height: 12 * unit,
            borderRadius: 2 * unit,
            backgroundColor: color,
            top: 10 * unit,
            left: 46 * unit,
            transform: [{ rotate: "40deg" }],
          },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  dot: {
    position: "absolute",
  },
  bar: {
    position: "absolute",
  },
});
