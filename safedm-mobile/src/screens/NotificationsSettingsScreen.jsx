import React, { useCallback, useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { IconGlyph } from "../components/Icons";
import Screen from "../components/Screen";
import ScreenHeader from "../components/ScreenHeader";
import SettingRow from "../components/SettingRow";
import {
  areNotificationsEnabled,
  getNotificationPreferences,
  NOTIFICATION_TYPE_DETAILS,
  openNotificationSettings,
  requestNotificationPermission,
  setNotificationEnabled,
} from "../services/notifications";
import { alertDialog } from "../services/appDialog";
import { colors, radii } from "../theme/tokens";

export default function NotificationsSettingsScreen({ navigation }) {
  const [notifPrefs, setNotifPrefs] = useState({});
  const [systemNotifs, setSystemNotifs] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    Promise.all([getNotificationPreferences(), areNotificationsEnabled()]).then(
      ([prefs, enabled]) => {
        if (!active) return;
        setNotifPrefs(prefs);
        setSystemNotifs(enabled);
        setLoading(false);
      },
    );
    return () => {
      active = false;
    };
  }, []);

  const toggleNotification = useCallback(
    async (type, next) => {
      if (!next) {
        setNotifPrefs((current) => ({ ...current, [type]: false }));
        await setNotificationEnabled(type, false);
        return;
      }
      if (!(await areNotificationsEnabled())) {
        const granted = await requestNotificationPermission();
        if (!granted) {
          await alertDialog({
            title: "Notifications autorisées ?",
            message:
              "Sans l'autorisation du système, aucune notification ne peut être affichée. Vous pouvez l'accorder dans les réglages Android.",
          });
          await openNotificationSettings();
          setSystemNotifs(await areNotificationsEnabled());
          return;
        }
        setSystemNotifs(true);
      }
      setNotifPrefs((current) => ({ ...current, [type]: true }));
      await setNotificationEnabled(type, true);
    },
    [],
  );

  return (
    <Screen scroll>
      <ScreenHeader title="Notifications" onBack={() => navigation.goBack()} />
      <Text style={styles.subtitle}>
        Choisissez les alertes à recevoir. Le contenu sensible reste masqué par
        défaut.
      </Text>

      {!systemNotifs ? (
        <View style={styles.warningCard}>
          <IconGlyph name="bell" color={colors.warning} size={22} />
          <View style={{ flex: 1 }}>
            <Text style={styles.warningTitle}>Notifications bloquées</Text>
            <Text style={styles.warningBody}>
              Autorisez les notifications pour recevoir les alertes de sécurité.
            </Text>
          </View>
        </View>
      ) : null}

      <Text style={styles.section}>Types de notifications</Text>
      {Object.entries(NOTIFICATION_TYPE_DETAILS).map(([type, spec]) => (
        <SettingRow
          key={type}
          icon={spec.channel === "info" ? "shield" : "bell"}
          title={spec.label}
          subtitle={spec.description}
          switchValue={Boolean(notifPrefs[type])}
          onSwitchChange={(next) => toggleNotification(type, next)}
        />
      ))}

      <SettingRow
        icon="bell"
        title="Réglages système Android"
        subtitle="Gérer les canaux et le comportement global"
        onPress={openNotificationSettings}
        showChevron
      />

      <Text style={styles.note}>
        Le contenu d’un message n’apparaît jamais dans une notification sauf si
        vous avez laissé l’aperçu visible dans les réglages de confidentialité.
      </Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  subtitle: {
    fontSize: 14,
    color: colors.textSecondary,
    lineHeight: 20,
    marginBottom: 16,
  },
  warningCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: colors.warningSoft,
    borderRadius: radii.lg,
    padding: 14,
    marginBottom: 18,
  },
  warningTitle: { fontSize: 15, fontWeight: "700", color: colors.textPrimary },
  warningBody: { fontSize: 13, color: colors.textSecondary, marginTop: 2 },
  section: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.textSecondary,
    marginBottom: 10,
    marginTop: 8,
  },
  note: {
    fontSize: 12,
    color: colors.textMuted,
    lineHeight: 18,
    marginTop: 8,
  },
});
