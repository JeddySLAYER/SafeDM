import React, { useCallback, useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import { IconBadge } from "../components/Icons";
import RiskBadge from "../components/RiskBadge";
import Screen from "../components/Screen";
import { subscribeAlertsChanged } from "../services/alertsEvents";
import { formatAlertWhen, listAlerts } from "../services/alertsStore";
import { colors, radii } from "../theme/tokens";

export default function AlertsScreen() {
  const navigation = useNavigation();
  const [alerts, setAlerts] = useState([]);

  const refresh = useCallback(async () => {
    setAlerts(await listAlerts());
  }, []);

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh]),
  );

  useEffect(() => subscribeAlertsChanged(refresh), [refresh]);

  return (
    <Screen scroll>
      <Text style={styles.title}>Alertes</Text>
      <Text style={styles.subtitle}>
        Historique local des 7 derniers jours (appareil uniquement) — notifications
        capturées et analyses manuelles.
      </Text>
      {alerts.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyText}>
            Aucune alerte enregistrée. Activez la surveillance ou analysez un
            message depuis l’accueil.
          </Text>
        </View>
      ) : (
        alerts.map((alert) => (
          <Pressable
            key={alert.id}
            style={styles.card}
            onPress={() =>
              navigation.navigate("AlertDetail", { alertId: alert.id })
            }
          >
            <IconBadge
              name={
                alert.source === "SMS"
                  ? "sms"
                  : alert.source === "Email"
                    ? "email"
                    : alert.source === "Manuel"
                      ? "search"
                      : "whatsapp"
              }
              size={42}
            />
            <View style={{ flex: 1 }}>
              <View style={styles.row}>
                <Text style={styles.source}>{alert.source}</Text>
                <RiskBadge level={alert.level || "unknown"} />
              </View>
              <Text style={styles.preview} numberOfLines={2}>
                {alert.preview}
              </Text>
              <Text style={styles.meta}>
                {formatAlertWhen(alert.createdAt)}
                {alert.analyzed ? " · Analysé" : ""}
              </Text>
            </View>
          </Pressable>
        ))
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 28, fontWeight: "700", color: colors.textPrimary },
  subtitle: {
    fontSize: 14,
    color: colors.textSecondary,
    marginTop: 8,
    marginBottom: 20,
    lineHeight: 20,
  },
  empty: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    padding: 20,
  },
  emptyText: { color: colors.textSecondary, lineHeight: 20 },
  card: {
    flexDirection: "row",
    gap: 12,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    padding: 14,
    marginBottom: 10,
    backgroundColor: colors.white,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  source: { fontWeight: "700", color: colors.textPrimary },
  preview: { color: colors.textSecondary, marginTop: 4, fontSize: 13 },
  meta: { color: colors.textMuted, marginTop: 6, fontSize: 12 },
});
