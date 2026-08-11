import React from "react";
import { Pressable, StyleSheet, Switch, Text, View } from "react-native";
import AppLogo from "./AppLogo";
import { IconGlyph } from "./Icons";
import { colors, radii } from "../theme/tokens";

export default function SettingRow({
  icon,
  iconUri,
  packageName,
  title,
  subtitle,
  valueText,
  onPress,
  switchValue,
  onSwitchChange,
  showChevron = false,
}) {
  const interactive = Boolean(onPress) && switchValue === undefined;

  const content = (
    <>
      <AppLogo
        uri={iconUri}
        packageName={packageName}
        fallbackIcon={icon || "bell"}
        size={40}
      />
      <View style={styles.textCol}>
        <Text style={styles.title}>{title}</Text>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      </View>
      {valueText ? <Text style={styles.value}>{valueText}</Text> : null}
      {switchValue !== undefined ? (
        <Switch
          value={switchValue}
          onValueChange={onSwitchChange}
          trackColor={{ false: colors.border, true: colors.blue200 }}
          thumbColor={switchValue ? colors.bluePrimary : colors.white}
        />
      ) : null}
      {showChevron || interactive ? (
        <IconGlyph name="chevron" color={colors.textMuted} size={22} />
      ) : null}
    </>
  );

  if (interactive) {
    return (
      <Pressable style={styles.row} onPress={onPress}>
        {content}
      </Pressable>
    );
  }

  return <View style={styles.row}>{content}</View>;
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.white,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 14,
    paddingVertical: 14,
    gap: 12,
    marginBottom: 10,
  },
  textCol: {
    flex: 1,
  },
  title: {
    fontSize: 15,
    fontWeight: "700",
    color: colors.textPrimary,
  },
  subtitle: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
  },
  value: {
    fontSize: 13,
    color: colors.textSecondary,
    marginRight: 4,
  },
});
