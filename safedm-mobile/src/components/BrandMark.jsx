import React from "react";
import { StyleSheet, Text, View } from "react-native";
import SafeDMLogo from "./SafeDMLogo";
import { colors } from "../theme/tokens";

export default function BrandMark({ size = 36, showTagline = false, centered = false }) {
  return (
    <View style={[styles.wrap, centered && styles.centered]}>
      <View style={styles.row}>
        <SafeDMLogo size={size} />
        <Text style={[styles.wordmark, { fontSize: size * 0.7 }]}>
          <Text style={styles.safe}>Safe</Text>
          <Text style={styles.dm}>DM</Text>
        </Text>
      </View>
      {showTagline ? (
        <Text style={styles.tagline}>Protégez vos messages</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: "flex-start",
  },
  centered: {
    alignItems: "center",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  wordmark: {
    fontWeight: "700",
  },
  safe: {
    color: colors.black,
  },
  dm: {
    color: colors.bluePrimary,
  },
  tagline: {
    marginTop: 10,
    fontSize: 15,
    color: colors.textSecondary,
  },
});
