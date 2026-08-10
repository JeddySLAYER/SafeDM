import React, { useCallback, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { IconBadge } from "../components/Icons";
import RiskBadge from "../components/RiskBadge";
import Screen from "../components/Screen";
import { listAlerts } from "../services/alertsStore";
import { colors, radii } from "../theme/tokens";

export default function AlertsScreen() {
  const [alerts, setAlerts] = useState([]);

  useFocusEffect(
    useCallback(() => {
      listAlerts().then(setAlerts);
    }, []),
  );

  return (
    <Screen scroll>
      <Text style={styles.title}>Alertes</Text>
      <Text style={styles.subtitle}>
        Historique local des 7 derniers jours (appareils uniquement).
      </Text>
      {alerts.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyText}>Aucune alerte enregistrée.</Text>
        </View>
      ) : (
        alerts.map((alert) => (
          <View key={alert.id} style={styles.card}>
            <IconBadge
              name={
                alert.source === "SMS"
                  ? "sms"
                  : alert.source === "Email"
                    ? "email"
                    : "whatsapp"
              }
              size={42}
            />
            <View style={{ flex: 1 }}>
              <View style={styles.row}>
                <Text style={styles.source}>{alert.source}</Text>
                <RiskBadge level={alert.level || "unknown"} />
              </View>
              <Text style={styles.preview}>{alert.preview}</Text>
              <Text style={styles.meta}>
                {new Date(alert.createdAt).toLocaleString("fr-FR")}
              </Text>
            </View>
          </View>
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
  },
  empty: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    padding: 20,
  },
  emptyText: { color: colors.textSecondary },
  card: {
    flexDirection: "row",
    gap: 12,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    padding: 14,
    marginBottom: 10,
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
