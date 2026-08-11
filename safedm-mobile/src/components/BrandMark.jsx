import React from "react";
import { StyleSheet, Text, View } from "react-native";
import SafeDMLogo from "./SafeDMLogo";
import { colors } from "../theme/tokens";

/**
 * Marque Safeguard DM.
 * - compact=false (défaut) : logo complet (icône + wordmark)
 * - compact=true : icône seule (headers / barres)
 */
export default function BrandMark({
  size = 36,
  showTagline = false,
  centered = false,
  compact = false,
}) {
  if (compact) {
    return (
      <View style={[styles.wrap, centered && styles.centered]}>
        <SafeDMLogo size={size} variant="icon" />
        {showTagline ? (
          <Text style={styles.tagline}>Protégez vos messages</Text>
        ) : null}
      </View>
    );
  }

  return (
    <View style={[styles.wrap, centered && styles.centered]}>
      <SafeDMLogo size={size} variant="full" />
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
  tagline: {
    marginTop: 10,
    fontSize: 15,
    color: colors.textSecondary,
  },
});
