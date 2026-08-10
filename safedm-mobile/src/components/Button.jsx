import React from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { colors, radii } from "../theme/tokens";

export default function Button({
  label,
  onPress,
  variant = "primary",
  disabled = false,
  loading = false,
  icon,
  style,
}) {
  const isPrimary = variant === "primary";
  const isOutline = variant === "outline";
  const isDark = variant === "dark";

  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled || loading}
      onPress={onPress}
      style={({ pressed }) => [
        styles.base,
        isPrimary && styles.primary,
        isOutline && styles.outline,
        isDark && styles.dark,
        variant === "ghost" && styles.ghost,
        (disabled || loading) && styles.disabled,
        pressed && !disabled && !loading && styles.pressed,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator
          color={isPrimary || isDark ? colors.white : colors.bluePrimary}
        />
      ) : (
        <View style={styles.row}>
          {icon}
          <Text
            style={[
              styles.label,
              isPrimary && styles.labelOnPrimary,
              isOutline && styles.labelOutline,
              isDark && styles.labelOnPrimary,
              variant === "ghost" && styles.labelGhost,
            ]}
          >
            {label}
          </Text>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: 52,
    borderRadius: radii.pill,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 20,
  },
  primary: {
    backgroundColor: colors.bluePrimary,
  },
  outline: {
    backgroundColor: colors.white,
    borderWidth: 1.5,
    borderColor: colors.bluePrimary,
  },
  dark: {
    backgroundColor: colors.black,
  },
  ghost: {
    backgroundColor: "transparent",
  },
  disabled: {
    opacity: 0.45,
  },
  pressed: {
    opacity: 0.88,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  label: {
    fontSize: 16,
    fontWeight: "700",
  },
  labelOnPrimary: {
    color: colors.white,
  },
  labelOutline: {
    color: colors.bluePrimary,
  },
  labelGhost: {
    color: colors.bluePrimary,
  },
});
