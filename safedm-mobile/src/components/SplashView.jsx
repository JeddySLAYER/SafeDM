import React from "react";
import { ActivityIndicator, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import BrandMark from "./BrandMark";
import { APP_VERSION } from "../config";
import { colors } from "../theme/tokens";

const FULL_LOGO_ASPECT = 1380 / 352;

export default function SplashView() {
  const { width } = useWindowDimensions();
  const logoHeight = Math.round((width - 20) / FULL_LOGO_ASPECT);

  return (
    <View style={styles.root}>
      <View style={styles.center}>
        <BrandMark size={logoHeight} showTagline centered />
      </View>
      <View style={styles.footer}>
        <ActivityIndicator color={colors.bluePrimary} style={styles.spinner} />
        <Text style={styles.version}>v{APP_VERSION}</Text>
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
    paddingHorizontal: 10,
    width: "100%",
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
