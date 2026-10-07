import React from "react";
import { StyleSheet, Text, View } from "react-native";
import SafeDMLogo from "./SafeDMLogo";
import { colors, typography } from "../theme/tokens";

/**
 * Marque SafeDM.
 * - compact : icône seule (headers)
 * - défaut : logo complet (icône + wordmark image)
 * - wordmark : text-logo seul
 */
export default function BrandMark({
  size = 36,
  showTagline = false,
  centered = false,
  compact = false,
  wordmark = false,
}) {
  let variant = "full";
  if (compact) variant = "icon";
  else if (wordmark) variant = "text";

  return (
    <View style={[styles.wrap, centered && styles.centered]}>
      <SafeDMLogo size={size} variant={variant} />
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
    ...typography.caption,
    marginTop: 10,
    fontSize: 15,
    color: colors.textSecondary,
  },
});
