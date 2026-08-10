import React, { useCallback, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import BrandMark from "../components/BrandMark";
import Button from "../components/Button";
import { IconBadge, IconGlyph } from "../components/Icons";
import RiskBadge from "../components/RiskBadge";
import Screen from "../components/Screen";
import { listAlerts } from "../services/alertsStore";
import {
  getEnabledPackageNames,
  isNotificationAccessEnabled,
  syncMonitoredPackages,
} from "../services/notificationBridge";
import * as usersApi from "../api/users";
import { colors, radii } from "../theme/tokens";

function formatWhen(ts) {
  const d = new Date(ts);
  return `Aujourd'hui à ${String(d.getHours()).padStart(2, "0")}:${String(
    d.getMinutes(),
  ).padStart(2, "0")}`;
}

function QuickCard({ icon, label, onPress }) {
  return (
    <Pressable style={styles.quickCard} onPress={onPress}>
      <IconBadge name={icon} size={44} />
      <Text style={styles.quickLabel}>{label}</Text>
    </Pressable>
  );
}

export default function HomeScreen({ navigation }) {
  const [alerts, setAlerts] = useState([]);
  const [enabledApps, setEnabledApps] = useState([]);
  const [accessOn, setAccessOn] = useState(false);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      (async () => {
        try {
          const prefs = await usersApi.getMonitoring();
          const packages = (prefs || [])
            .filter((p) => p.enabled && p.application?.package_name)
            .map((p) => p.application.package_name);
          if (packages.length) {
            await syncMonitoredPackages(packages);
          }
        } catch {
          /* offline / non authentifié */
        }
        const [items, packages, enabled] = await Promise.all([
          listAlerts(),
          getEnabledPackageNames(),
          isNotificationAccessEnabled(),
        ]);
        if (!active) return;
        setAlerts(items.slice(0, 2));
        setEnabledApps(packages);
        setAccessOn(enabled);
      })();
      return () => {
        active = false;
      };
    }, []),
  );

  const monitoringLabel =
    enabledApps.length === 0
      ? "Aucune app sélectionnée"
      : enabledApps
          .map((p) => {
            if (p.includes("whatsapp")) return "WhatsApp";
            if (p.includes("messaging") || p.includes("mms")) return "SMS";
            if (p.includes("gm") || p.includes("outlook")) return "Email";
            return p;
          })
          .filter((v, i, a) => a.indexOf(v) === i)
          .join(" · ");

  return (
    <Screen scroll edges={["top", "left", "right"]}>
      <View style={styles.topBar}>
        <BrandMark size={28} />
        <IconGlyph name="bell" color={colors.bluePrimary} size={22} />
      </View>

      <View
        style={[
          styles.statusCard,
          accessOn ? styles.statusOn : styles.statusOff,
        ]}
      >
        <View
          style={[
            styles.statusDot,
            {
              backgroundColor: accessOn
                ? colors.bluePrimary
                : colors.textMuted,
            },
          ]}
        />
        <View style={{ flex: 1 }}>
          <Text style={styles.statusTitle}>
            {accessOn ? "Surveillance active" : "Surveillance inactive"}
          </Text>
          <Text style={styles.statusSub}>{monitoringLabel}</Text>
        </View>
      </View>

      {!accessOn ? (
        <Button
          label="Activer l’accès notifications"
          onPress={() => navigation.navigate("Permissions")}
          style={{ marginBottom: 20 }}
        />
      ) : null}

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitleInline}>Alertes récentes</Text>
        <Text style={styles.link} onPress={() => navigation.navigate("Alerts")}>
          Voir tout
        </Text>
      </View>

      {alerts.length === 0 ? (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyText}>
            Aucune alerte pour le moment. Les notifications suspectes
            apparaîtront ici.
          </Text>
        </View>
      ) : (
        alerts.map((alert) => (
          <Pressable
            key={alert.id}
            style={styles.alertCard}
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
                    : "whatsapp"
              }
              size={42}
            />
            <View style={{ flex: 1 }}>
              <View style={styles.alertTitleRow}>
                <Text style={styles.alertSource}>{alert.source}</Text>
                <RiskBadge level={alert.level || "unknown"} />
              </View>
              <Text style={styles.alertPreview} numberOfLines={1}>
                {alert.preview}
              </Text>
              <Text style={styles.alertWhen}>{formatWhen(alert.createdAt)}</Text>
            </View>
          </Pressable>
        ))
      )}

      <Text
        style={[styles.link, styles.seeAll]}
        onPress={() => navigation.navigate("Alerts")}
      >
        Voir toutes les alertes
      </Text>

      <Text style={styles.sectionTitle}>Accès rapide</Text>
      <View style={styles.quickRow}>
        <QuickCard
          icon="search"
          label="Analyse manuelle"
          onPress={() => navigation.navigate("ManualAnalysis")}
        />
        <QuickCard
          icon="community"
          label="Menaces communautaires"
          onPress={() => navigation.navigate("Community")}
        />
        <QuickCard
          icon="guide"
          label="Guide"
          onPress={() => navigation.navigate("Guide")}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 20,
  },
  statusCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderRadius: radii.lg,
    padding: 16,
    marginBottom: 16,
  },
  statusOn: { backgroundColor: colors.blueSoft },
  statusOff: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  statusDot: { width: 10, height: 10, borderRadius: 5 },
  statusTitle: { fontSize: 16, fontWeight: "700", color: colors.textPrimary },
  statusSub: { fontSize: 13, color: colors.textSecondary, marginTop: 2 },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  sectionTitleInline: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.textPrimary,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.textPrimary,
    marginBottom: 12,
    marginTop: 8,
  },
  link: { color: colors.bluePrimary, fontWeight: "600", fontSize: 13 },
  emptyCard: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    padding: 16,
    marginBottom: 8,
  },
  emptyText: { color: colors.textSecondary, lineHeight: 20 },
  alertCard: {
    flexDirection: "row",
    gap: 12,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    padding: 14,
    marginBottom: 10,
    backgroundColor: colors.white,
  },
  alertTitleRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  alertSource: { fontWeight: "700", color: colors.textPrimary },
  alertPreview: { color: colors.textSecondary, fontSize: 13 },
  alertWhen: { color: colors.textMuted, fontSize: 12, marginTop: 4 },
  seeAll: { textAlign: "center", marginVertical: 12 },
  quickRow: { flexDirection: "row", gap: 10 },
  quickCard: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    padding: 12,
    alignItems: "center",
    gap: 8,
    minHeight: 110,
  },
  quickLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.textPrimary,
    textAlign: "center",
  },
});
