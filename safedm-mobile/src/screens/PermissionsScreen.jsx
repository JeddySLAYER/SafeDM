import React, { useCallback, useState } from "react";
import { AppState, StyleSheet, Text, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import Button from "../components/Button";
import { IconBadge } from "../components/Icons";
import Screen from "../components/Screen";
import {
  isNotificationAccessEnabled,
  openNotificationListenerSettings,
} from "../services/notificationBridge";
import { colors, spacing, typography } from "../theme/tokens";

export default function PermissionsScreen({ navigation, route }) {
  const onboarding = route?.params?.onboarding === true;
  const [enabled, setEnabled] = useState(false);

  const refresh = useCallback(async () => {
    setEnabled(await isNotificationAccessEnabled());
  }, []);

  useFocusEffect(
    useCallback(() => {
      refresh();
      const sub = AppState.addEventListener("change", (state) => {
        if (state === "active") refresh();
      });
      return () => sub.remove();
    }, [refresh]),
  );

  function continueNext() {
    if (onboarding) {
      if (!enabled) {
        // Soft continue but mark incomplete via next screens + Home banner.
        navigation.replace("BatteryOptimization", {
          onboarding: true,
          nlsSkipped: true,
        });
        return;
      }
      navigation.replace("BatteryOptimization", { onboarding: true });
      return;
    }
    navigation.goBack();
  }

  return (
    <Screen contentStyle={styles.content} style={styles.canvas}>
      <View style={styles.hero}>
        <View style={styles.circle}>
          <IconBadge name="bell" size={72} />
          <View style={styles.shield}>
            <IconBadge name="shield" size={36} />
          </View>
        </View>
        <Text style={styles.title}>Accès aux notifications</Text>
        <Text style={styles.body}>
          SafeDM lit localement les notifications des apps choisies. Aucun
          message n’est modifié ni bloqué. Sans cet accès, la protection
          automatique est inactive.
        </Text>
        <Text style={styles.status}>
          Statut :{" "}
          <Text
            style={{
              color: enabled ? colors.success : colors.danger,
              fontWeight: "700",
            }}
          >
            {enabled ? "Autorisé" : "Non autorisé"}
          </Text>
        </Text>
      </View>

      <View style={styles.footer}>
        <Button
          label="Autoriser l’accès"
          onPress={() => openNotificationListenerSettings()}
        />
        <Button
          label={
            onboarding
              ? enabled
                ? "Continuer"
                : "Continuer sans (déconseillé)"
              : "Retour"
          }
          variant="outline"
          onPress={continueNext}
          style={{ marginTop: 12 }}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  canvas: { backgroundColor: colors.canvas },
  content: { justifyContent: "space-between" },
  hero: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  circle: { position: "relative", marginBottom: spacing.lg },
  shield: { position: "absolute", right: -8, bottom: -8 },
  title: { ...typography.title, textAlign: "center", marginTop: spacing.md },
  body: {
    ...typography.subtitle,
    textAlign: "center",
    marginTop: spacing.md,
    fontSize: 16,
    lineHeight: 24,
    paddingHorizontal: spacing.sm,
  },
  status: { ...typography.label, marginTop: spacing.lg },
  footer: { paddingBottom: spacing.sm },
});
