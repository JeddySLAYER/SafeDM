import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { IconGlyph } from "./Icons";
import { colors } from "../theme/tokens";

/** Header maquette : flèche retour + titre gras. */
export default function ScreenHeader({ title, onBack }) {
  return (
    <View style={styles.row}>
      {onBack ? (
        <Pressable onPress={onBack} hitSlop={12} style={styles.back}>
          <IconGlyph name="back" color={colors.textPrimary} size={28} />
        </Pressable>
      ) : (
        <View style={styles.backSpacer} />
      )}
      <Text style={styles.title} numberOfLines={1}>
        {title}
      </Text>
      <View style={styles.backSpacer} />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 20,
    minHeight: 40,
  },
  back: {
    width: 36,
    alignItems: "flex-start",
  },
  backSpacer: {
    width: 36,
  },
  title: {
    flex: 1,
    textAlign: "center",
    fontSize: 18,
    fontWeight: "700",
    color: colors.textPrimary,
  },
});
