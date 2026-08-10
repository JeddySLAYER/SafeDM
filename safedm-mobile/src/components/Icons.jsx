import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { colors } from "../theme/tokens";

/** Icônes outline légères (pas de dépendance native). */
export function IconGlyph({ name, color = colors.bluePrimary, size = 20 }) {
  const map = {
    user: "👤",
    lock: "🔒",
    eye: "👁",
    eyeOff: "🙈",
    home: "⌂",
    alerts: "🔔",
    reports: "⚑",
    settings: "⚙",
    whatsapp: "💬",
    sms: "✉",
    email: "📧",
    bell: "🔔",
    shield: "🛡",
    search: "🔍",
    community: "👥",
    guide: "📖",
    chevron: "›",
    back: "‹",
    logout: "⎋",
    flag: "⚑",
    clipboard: "📋",
    check: "✓",
    warning: "⚠",
    globe: "🌐",
    doc: "📄",
    branch: "⑂",
    clock: "🕐",
  };
  return (
    <Text style={{ fontSize: size, color, lineHeight: size + 4 }}>
      {map[name] || "•"}
    </Text>
  );
}

export function IconBadge({ name, size = 40, color = colors.bluePrimary }) {
  return (
    <View style={[styles.badge, { width: size, height: size, borderRadius: size / 2 }]}>
      <IconGlyph name={name} color={color} size={size * 0.42} />
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    backgroundColor: colors.blue50,
    alignItems: "center",
    justifyContent: "center",
  },
});
