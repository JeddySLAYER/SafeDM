import React from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import BrandMark from "./BrandMark";
import { appVersion, colors } from "../theme/tokens";

export default function SplashView() {
  return (
    <View style={styles.root}>
      <View style={styles.center}>
        <BrandMark size={56} showTagline centered />
      </View>
      <View style={styles.footer}>
        <ActivityIndicator color={colors.bluePrimary} style={styles.spinner} />
        <Text style={styles.version}>v{appVersion}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.white,
    justifyContent: "center",
  },
  center: {
    alignItems: "center",
  },
  footer: {
    position: "absolute",
    bottom: 40,
    left: 0,
    right: 0,
    alignItems: "center",
  },
  spinner: {
    marginBottom: 12,
  },
  version: {
    fontSize: 12,
    color: colors.textMuted,
  },
});
