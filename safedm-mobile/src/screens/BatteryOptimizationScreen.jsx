import React, { useState } from "react";
import { Linking, Platform, StyleSheet, Text, View } from "react-native";
import Button from "../components/Button";
import { IconBadge } from "../components/Icons";
import Screen from "../components/Screen";
import SetupSteps from "../components/SetupSteps";
import { colors, spacing, typography } from "../theme/tokens";

/**
 * OEM survival step — NLS dies without unrestricted battery on many devices.
 */
export default function BatteryOptimizationScreen({ navigation, route }) {
  const onboarding = route?.params?.onboarding === true;
  const nlsSkipped = route?.params?.nlsSkipped === true;
  const [hint, setHint] = useState("");

  async function openBatterySettings() {
    setHint("");
    try {
      await Linking.openSettings();
      setHint(
        "Paramètres → Applications → SafeDM → Batterie : choisissez « Sans restriction » / ignorer l’optimisation.",
      );
    } catch {
      setHint("Ouvrez manuellement Paramètres → Applications → SafeDM → Batterie.");
    }
  }

  function finish() {
    if (onboarding) {
      navigation.replace("LinkProtection", {
        onboarding: true,
        nlsSkipped,
      });
      return;
    }
    navigation.goBack();
  }

  return (
    <Screen contentStyle={styles.content} style={styles.canvas}>
      {onboarding ? <SetupSteps step={2} /> : null}
      <View style={styles.hero}>
        <IconBadge name="shield" size={72} />
        <Text style={styles.title}>Gardez SafeDM actif</Text>
        <Text style={styles.body}>
          Sur Xiaomi, Huawei, Samsung et d’autres marques, Android peut arrêter
          l’écoute des notifications. Autorisez SafeDM à tourner en arrière-plan.
        </Text>
        {nlsSkipped ? (
          <Text style={styles.warn}>
            L'accès aux notifications n'est pas encore accordé. Activez-le dans
            Paramètres pour une protection réelle.
          </Text>
        ) : null}
        {Platform.OS === "android" ? (
          <Text style={styles.tip}>
            Cherchez « Batterie », « Sans restriction », « Démarrage automatique »
            ou « Autostart ».
          </Text>
        ) : null}
        {hint ? <Text style={styles.hint}>{hint}</Text> : null}
      </View>
      <View style={styles.footer}>
        <Button label="Ouvrir les réglages système" onPress={openBatterySettings} />
        <Button
          label={onboarding ? "Continuer" : "Retour"}
          variant="outline"
          onPress={finish}
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
    paddingHorizontal: spacing.sm,
  },
  title: { ...typography.title, textAlign: "center", marginTop: spacing.lg },
  body: {
    ...typography.subtitle,
    textAlign: "center",
    marginTop: spacing.md,
    fontSize: 16,
    lineHeight: 24,
  },
  tip: {
    ...typography.caption,
    textAlign: "center",
    marginTop: spacing.md,
  },
  warn: {
    ...typography.caption,
    textAlign: "center",
    marginTop: spacing.md,
    color: colors.danger,
  },
  hint: {
    ...typography.caption,
    textAlign: "center",
    marginTop: spacing.md,
    color: colors.blue600,
  },
  footer: { paddingBottom: spacing.sm },
});
