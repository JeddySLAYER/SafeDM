import React, { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import NetInfo from "@react-native-community/netinfo";
import { colors, typography } from "../theme/tokens";

/**
 * Bannière non bloquante : l'analyse locale continue sans réseau.
 * Le cloud / sync API sont simplement indisponibles.
 */
export default function OfflineBanner() {
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    const apply = (state) => {
      // null = unknown — don't flash the banner until NetInfo is sure.
      setOffline(
        state.isConnected === false || state.isInternetReachable === false
      );
    };

    NetInfo.fetch().then(apply).catch(() => setOffline(false));
    const unsub = NetInfo.addEventListener(apply);
    return () => unsub();
  }, []);

  if (!offline) return null;

  return (
    <View style={styles.banner} accessibilityRole="alert">
      <Text style={styles.text}>
        Hors ligne. L'analyse sur le téléphone reste active.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    backgroundColor: colors.textPrimary,
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  text: {
    ...typography.caption,
    color: colors.white,
    textAlign: "center",
    fontSize: 13,
    fontWeight: "600",
  },
});
