import React, { useCallback, useState } from "react";
import { AppState, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import Button from "../components/Button";
import { IconBadge, IconGlyph } from "../components/Icons";
import Screen from "../components/Screen";
import SetupSteps from "../components/SetupSteps";
import { useAuth } from "../context/AuthContext";
import {
  getPermissionState,
  openAppDetailsSettings,
  openBatteryOptimizationList,
  openNotificationListenerSettings,
  requestBatteryExemption,
} from "../services/notificationBridge";
import { colors, spacing, typography } from "../theme/tokens";

/**
 * Arriere-plan et batterie — etat reel, pas etat suppose.
 *
 * Android peut geler le service qui lit les notifications : l'application
 * affiche alors "protection active" alors que plus rien n'arrive. Cet ecran
 * interroge le systeme (`getPermissionState`) et n'affiche "autorise" que
 * lorsque c'est vrai.
 */
export default function BatteryOptimizationScreen({ navigation, route }) {
  const onboarding = route?.params?.onboarding === true;
  const nlsSkipped = route?.params?.nlsSkipped === true;
  const { completeSetup } = useAuth();
  const [batteryExempt, setBatteryExempt] = useState(false);
  const [notificationAccess, setNotificationAccess] = useState(false);
  const [manufacturer, setManufacturer] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [hint, setHint] = useState("");

  const refresh = useCallback(async () => {
    const state = await getPermissionState();
    setBatteryExempt(state.batteryExempt);
    setNotificationAccess(state.notificationAccess);
    setManufacturer(state.manufacturer);
    setLoaded(true);
  }, []);

  useFocusEffect(
    useCallback(() => {
      refresh();
      // L'utilisateur passe par les reglages systeme : on relit l'etat a son
      // retour dans l'application, sans lui demander de rafraichir a la main.
      const sub = AppState.addEventListener("change", (next) => {
        if (next === "active") refresh();
      });
      return () => sub.remove();
    }, [refresh]),
  );

  async function requestExemption() {
    setHint("");
    const opened = await requestBatteryExemption();
    if (!opened) {
      // Dialogue systeme indisponible (constructeur restrictif, permission non
      // declaree) : la fiche de l'application expose « Sans restriction ».
      openAppDetailsSettings();
      setHint(
        "Dans la fiche de SafeDM, choisissez « Batterie », puis « Sans restriction ».",
      );
      return;
    }
    setHint(
      "Acceptez la demande Android. L'état se met à jour dès que vous revenez ici.",
    );
  }

  async function finish() {
    if (onboarding) {
      await completeSetup();
      navigation.reset({ index: 0, routes: [{ name: "MainTabs" }] });
      return;
    }
    navigation.goBack();
  }

  const exempt = loaded && batteryExempt;

  return (
    <Screen contentStyle={styles.content} style={styles.canvas}>
      {onboarding ? <SetupSteps step={2} /> : null}
      <View style={styles.hero}>
        <IconBadge name={exempt ? "shield" : "battery"} size={72} />
        <Text style={styles.title}>
          {exempt ? "SafeDM tourne en arrière-plan" : "Gardez SafeDM actif"}
        </Text>
        <Text style={styles.body}>
          {exempt
            ? "Android a mis SafeDM en exception d'optimisation de batterie. L'écoute des notifications continue même quand l'écran est éteint."
            : "Sur Xiaomi, Huawei, Samsung et d'autres marques, Android peut arrêter l'écoute des notifications. Autorisez SafeDM à tourner en arrière-plan."}
        </Text>

        <View style={styles.statusRow}>
          <IconGlyph
            name={exempt ? "check" : "warning"}
            color={exempt ? colors.successText : colors.dangerText}
            size={18}
          />
          <Text style={styles.statusText}>
            {exempt
              ? "Exemption de batterie accordée"
              : "Optimisation de batterie active"}
          </Text>
        </View>

        {!notificationAccess ? (
          <Text style={styles.warn}>
            L'accès aux notifications n'est pas encore accordé. Sans lui, cette
            étape ne sert à rien : activez-le dans Paramètres.
          </Text>
        ) : null}

        {nlsSkipped ? (
          <Text style={styles.warn}>
            L'accès aux notifications n'est pas encore accordé. Activez-le dans
            Paramètres pour une protection réelle.
          </Text>
        ) : null}

        {Platform.OS === "android" && !exempt ? (
          <Text style={styles.tip}>
            {manufacturer
              ? `Sur ${manufacturer}, cherchez aussi « Démarrage automatique » ou « Autostart ».`
              : "Cherchez « Batterie », « Sans restriction », « Démarrage automatique » ou « Autostart »."}
          </Text>
        ) : null}

        {hint ? <Text style={styles.hint}>{hint}</Text> : null}
      </View>

      <View style={styles.footer}>
        {exempt ? (
          <>
            <Button
              label="Ouvrir les réglages batterie"
              variant="outline"
              onPress={openBatteryOptimizationList}
            />
            {!notificationAccess ? (
              <Button
                label="Autoriser l'accès notifications"
                onPress={openNotificationListenerSettings}
                style={{ marginTop: 10 }}
              />
            ) : null}
          </>
        ) : (
          <>
            <Button label="Autoriser en arrière-plan" onPress={requestExemption} />
            {!notificationAccess ? (
              <Button
                label="Autoriser l'accès notifications"
                variant="outline"
                onPress={openNotificationListenerSettings}
                style={{ marginTop: 10 }}
              />
            ) : null}
          </>
        )}
        <Pressable onPress={finish} style={styles.later}>
          <Text style={styles.laterText}>{onboarding ? "Plus tard" : "Retour"}</Text>
        </Pressable>
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
  statusRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: spacing.lg,
  },
  statusText: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.textPrimary,
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
  later: { alignItems: "center", paddingVertical: 14 },
  laterText: {
    fontSize: 15,
    fontWeight: "600",
    color: colors.textSecondary,
  },
});
