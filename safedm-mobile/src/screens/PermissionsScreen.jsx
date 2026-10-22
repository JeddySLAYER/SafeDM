import React, { useCallback, useState } from "react";
import { AppState, Pressable, StyleSheet, Text, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import Button from "../components/Button";
import { IconBadge, IconGlyph } from "../components/Icons";
import Screen from "../components/Screen";
import SetupSteps from "../components/SetupSteps";
import {
  getPermissionState,
  isNotificationAccessEnabled,
  openAppDetailsSettings,
  openNotificationListenerSettings,
} from "../services/notificationBridge";
import {
  areNotificationsEnabled,
  requestNotificationPermission,
} from "../services/notifications";
import { colors, radii, spacing, typography } from "../theme/tokens";

/**
 * Autorisations — parcours guide.
 *
 * Le piege principal sur Android 13+ : installee hors du Play Store, une
 * application ne peut pas obtenir l'acces aux notifications tant que
 * l'utilisateur n'a pas deverrouille les "parametres restreints" dans sa
 * fiche. Sans explication, l'utilisateur tourne en rond : le bouton ne
 * fonctionne pas et rien ne dit pourquoi.
 *
 * D'ou les trois etapes explicites ci-dessous.
 */
export default function PermissionsScreen({ navigation, route }) {
  const onboarding = route?.params?.onboarding === true;
  const [enabled, setEnabled] = useState(false);
  const [notificationsAllowed, setNotificationsAllowed] = useState(false);
  const [restrictedRequired, setRestrictedRequired] = useState(false);

  const refresh = useCallback(async () => {
    const state = await getPermissionState();
    setEnabled(state.notificationAccess);
    setRestrictedRequired(state.restrictedSettingsRequired);
    setNotificationsAllowed(await areNotificationsEnabled());
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

  /**
   * Autorise les notifications une fois l'acces aux notifications systeme
   * accorde.
   *
   * Android 13 (API 33) exige une autorisation explicite pour afficher une
   * notification ; sans elle, l'analyse locale continue de fonctionner mais
   * l'utilisateur n'est prevenu de rien.
   */
  const askNotificationPermission = useCallback(async () => {
    const granted = await requestNotificationPermission();
    setNotificationsAllowed(granted);
    return granted;
  }, []);

  function continueNext() {
    if (onboarding) {
      navigation.replace("Apps", {
        onboarding: true,
        nlsSkipped: !enabled,
      });
      return;
    }
    navigation.goBack();
  }

  // L'etape "parametres restreints" n'a de sens que tant que l'acces aux
  // notifications n'est pas accorde : c'est en tentant de l'accorder que
  // l'utilisateur deverrouille le menu "..." de sa fiche d'application.
  const showRestrictedStep = restrictedRequired && !enabled;

  return (
    <Screen contentStyle={styles.content} style={styles.canvas}>
      {onboarding ? <SetupSteps step={0} /> : null}
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
        {enabled && !notificationsAllowed ? (
          <Button
            label="Autoriser les alertes SafeDM"
            variant="outline"
            onPress={askNotificationPermission}
            style={styles.notifyButton}
          />
        ) : null}
        {enabled && notificationsAllowed ? (
          <Text style={styles.status}>Les alertes SafeDM sont activées</Text>
        ) : null}
      </View>

      {showRestrictedStep ? (
        <View style={styles.restrictedCard}>
          <View style={styles.restrictedHead}>
            <IconGlyph name="warning" color={colors.blue600} size={18} />
            <Text style={styles.restrictedTitle}>
              Une étape de plus sur Android 13 et plus
            </Text>
          </View>
          <Text style={styles.restrictedBody}>
            SafeDM est installé hors du Play Store. Android bloque l’accès aux
            notifications tant que vous n’avez pas autorisé les paramètres
            restreints. C’est Android qui bloque, pas SafeDM.
          </Text>
          <Text style={styles.restrictedSteps}>
            1. Touchez « Autoriser l’accès notifications » — Android affiche un
            message, fermez-le.{"\n"}2. Ouvrez la fiche de SafeDM dans les
            réglages, puis le menu « … » en haut à droite.{"\n"}3. Choisissez
            « Autoriser les paramètres restreints », puis revenez ici.
          </Text>
          <Button
            label="Ouvrir la fiche de SafeDM"
            variant="outline"
            onPress={openAppDetailsSettings}
            style={{ marginTop: 14 }}
          />
        </View>
      ) : null}

      <View style={styles.footer}>
        <Button
          label={enabled ? (onboarding ? "Continuer" : "C'est bon") : "Autoriser l'accès"}
          onPress={enabled ? continueNext : () => openNotificationListenerSettings()}
        />
        <Pressable
          onPress={enabled ? () => openNotificationListenerSettings() : continueNext}
          style={styles.later}
        >
          <Text style={styles.laterText}>
            {enabled ? "Modifier l'accès" : onboarding ? "Plus tard" : "Retour"}
          </Text>
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
  notifyButton: { marginTop: spacing.lg },
  restrictedCard: {
    backgroundColor: colors.blueSoft,
    borderRadius: radii.lg,
    padding: 16,
    marginBottom: spacing.md,
  },
  restrictedHead: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 8,
  },
  restrictedTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.blue800,
    flex: 1,
  },
  restrictedBody: {
    fontSize: 13,
    color: colors.textSecondary,
    lineHeight: 19,
  },
  restrictedSteps: {
    fontSize: 13,
    color: colors.textPrimary,
    lineHeight: 20,
    marginTop: 10,
  },
  footer: { paddingBottom: spacing.sm },
  later: { alignItems: "center", paddingVertical: 14 },
  laterText: {
    fontSize: 15,
    fontWeight: "600",
    color: colors.textSecondary,
  },
});
