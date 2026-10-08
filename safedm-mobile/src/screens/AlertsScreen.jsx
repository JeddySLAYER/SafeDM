import React, { useCallback, useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import AppLogo from "../components/AppLogo";
import RiskBadge from "../components/RiskBadge";
import Screen from "../components/Screen";
import { fallbackIconForSource } from "../services/appIcons";
import { subscribeAlertsChanged } from "../services/alertsEvents";
import { formatAlertWhen, listAlerts } from "../services/alertsStore";
import { getHideSensitivePreview } from "../utils/storage";
import { colors, radii, typography } from "../theme/tokens";

const FILTERS = [
  { id: "all", label: "Tous" },
  { id: "high", label: "Élevé" },
  { id: "medium", label: "Moyen" },
  { id: "low", label: "Faible" },
];

export default function AlertsScreen() {
  const navigation = useNavigation();
  const [alerts, setAlerts] = useState([]);
  const [hidePreview, setHidePreview] = useState(false);
  const [filter, setFilter] = useState("all");

  const refresh = useCallback(async () => {
    const [items, hide] = await Promise.all([
      listAlerts(),
      getHideSensitivePreview(),
    ]);
    setAlerts(items);
    setHidePreview(hide);
  }, []);

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh]),
  );

  useEffect(() => subscribeAlertsChanged(refresh), [refresh]);

  const visible =
    filter === "all" ? alerts : alerts.filter((a) => (a.level || "unknown") === filter);

  return (
    <Screen scroll>
      <Text style={styles.title}>Alertes</Text>
      <Text style={styles.subtitle}>
        Historique local 7 jours. Textes sur l'appareil. Paramètres pour
        masquer ou tout effacer.
      </Text>
      <View style={styles.filters}>
        {FILTERS.map((f) => (
          <Pressable
            key={f.id}
            onPress={() => setFilter(f.id)}
            style={[styles.chip, filter === f.id && styles.chipOn]}
          >
            <Text style={[styles.chipText, filter === f.id && styles.chipTextOn]}>
              {f.label}
            </Text>
          </Pressable>
        ))}
      </View>
      {visible.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyTitle}>Rien pour l’instant</Text>
          <Text style={styles.emptyText}>
            Activez la surveillance ou analysez un message depuis l’accueil.
          </Text>
        </View>
      ) : (
        <View style={styles.list}>
          {visible.map((alert, index) => (
            <Pressable
              key={alert.id}
              style={[
                styles.row,
                index < visible.length - 1 && styles.rowBorder,
              ]}
              onPress={() =>
                navigation.navigate("AlertDetail", { alertId: alert.id })
              }
            >
              <AppLogo
                packageName={alert.packageName}
                fallbackIcon={fallbackIconForSource(alert.source)}
                size={42}
              />
              <View style={{ flex: 1 }}>
                <View style={styles.metaRow}>
                  <Text style={styles.source}>{alert.source}</Text>
                  <RiskBadge level={alert.level || "unknown"} />
                </View>
                <Text style={styles.preview} numberOfLines={2}>
                  {hidePreview
                    ? "Contenu masqué (Paramètres)"
                    : alert.preview}
                </Text>
                <Text style={styles.when}>
                  {formatAlertWhen(alert.createdAt)}
                  {alert.analyzed ? " · Analysé" : ""}
                </Text>
              </View>
            </Pressable>
          ))}
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { ...typography.title },
  subtitle: {
    ...typography.caption,
    marginTop: 8,
    marginBottom: 12,
    lineHeight: 20,
  },
  filters: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 16,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: radii.pill,
    backgroundColor: colors.surface,
    minHeight: 36,
    justifyContent: "center",
  },
  chipOn: { backgroundColor: colors.bluePrimary },
  chipText: { fontSize: 13, fontWeight: "600", color: colors.textSecondary },
  chipTextOn: { color: colors.white },
  empty: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    padding: 24,
  },
  emptyTitle: { ...typography.label, marginBottom: 8 },
  emptyText: { ...typography.caption, lineHeight: 20 },
  list: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    overflow: "hidden",
  },
  row: {
    flexDirection: "row",
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 14,
    minHeight: 72,
    alignItems: "center",
  },
  rowBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.borderSubtle,
  },
  metaRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 8,
  },
  source: { fontWeight: "700", color: colors.textPrimary, flexShrink: 1 },
  preview: {
    color: colors.textSecondary,
    marginTop: 4,
    fontSize: 14,
    lineHeight: 20,
  },
  when: { marginTop: 6, fontSize: 12, color: colors.textMuted },
});
