import React, { useCallback, useState } from "react";
import { AppState, StyleSheet, Text, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import Button from "../components/Button";
import { IconBadge } from "../components/Icons";
import Screen from "../components/Screen";
import SetupSteps from "../components/SetupSteps";
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
      {onboarding ? <SetupSteps step={1} /> : null}
      <View style={styles.hero}>
        <View style={styles.circle}>
          <IconBadge name={enabled ? "shield" : "bell"} size={72} />
        </View>
        <Text style={styles.title}>
          {enabled ? "Notifications autorisées" : "Accès aux notifications"}
        </Text>
        <Text style={styles.body}>
          {enabled
            ? "SafeDM peut lire les notifications des applications choisies. Les messages ne sont ni modifiés ni bloqués."
            : "Sans cet accès, SafeDM ne voit pas les nouveaux messages. Rien n'est modifié ni bloqué."}
        </Text>
      </View>

      <View style={styles.footer}>
        {enabled ? (
          <Button
            label={onboarding ? "Continuer" : "C'est bon"}
            onPress={continueNext}
          />
        ) : (
          <Button
            label="Autoriser l'accès"
            onPress={() => openNotificationListenerSettings()}
          />
        )}
        <Button
          label={
            enabled
              ? "Modifier l'accès"
              : onboarding
                ? "Continuer sans (déconseillé)"
                : "Retour"
          }
          variant="outline"
          onPress={
            enabled ? () => openNotificationListenerSettings() : continueNext
          }
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
