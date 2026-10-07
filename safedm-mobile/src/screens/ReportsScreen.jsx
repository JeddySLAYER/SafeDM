import React, { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import { ApiError } from "../api/client";
import { listMyReports, withdrawReport } from "../api/reports";
import Button from "../components/Button";
import { IconGlyph } from "../components/Icons";
import RiskBadge from "../components/RiskBadge";
import Screen from "../components/Screen";
import { severityToLevel } from "../utils/risk";
import { colors, radii } from "../theme/tokens";

export default function ReportsScreen() {
  const navigation = useNavigation();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await listMyReports(true);
      setItems(data.items || []);
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : "Impossible de charger vos signalements.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  function confirmWithdraw(report) {
    Alert.alert(
      "Retirer le signalement",
      "Ce message ne sera plus compté dans la communauté.",
      [
        { text: "Annuler", style: "cancel" },
        {
          text: "Retirer",
          style: "destructive",
          onPress: () => onWithdraw(report.id),
        },
      ],
    );
  }

  async function onWithdraw(id) {
    setBusyId(id);
    try {
      await withdrawReport(id);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Retrait impossible.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <Screen scroll>
      <Text style={styles.title}>Signalements</Text>
      <Text style={styles.subtitle}>
        Messages que vous avez explicitement signalés à la communauté.
      </Text>

      <Button
        label="Signaler un message"
        onPress={() => navigation.navigate("DirectReport")}
        icon={<IconGlyph name="flag" color={colors.white} size={16} />}
        style={{ marginBottom: 20 }}
      />

      {loading ? (
        <ActivityIndicator color={colors.bluePrimary} style={{ marginTop: 8 }} />
      ) : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}

      {!loading && items.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyText}>
            Aucun signalement actif. Analysez un message puis utilisez « Signaler
            ce message ».
          </Text>
        </View>
      ) : null}

      {items.map((report) => (
        <View key={report.id} style={styles.card}>
          <View style={styles.top}>
            <Text style={styles.meta}>
              {new Date(report.created_at).toLocaleString("fr-FR")}
            </Text>
            <RiskBadge level={severityToLevel(report.severity)} />
          </View>
          <Text style={styles.preview} numberOfLines={3}>
            {report.threat_preview}
          </Text>
          <Text style={styles.count}>
            {report.report_count} signalement
            {report.report_count > 1 ? "s" : ""} communauté
          </Text>
          <Button
            label="Retirer"
            variant="outline"
            loading={busyId === report.id}
            onPress={() => confirmWithdraw(report)}
            style={{ marginTop: 12 }}
          />
        </View>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: {
    fontSize: 28,
    fontWeight: "700",
    color: colors.textPrimary,
  },
  subtitle: {
    fontSize: 14,
    color: colors.textSecondary,
    marginTop: 8,
    marginBottom: 20,
    lineHeight: 20,
  },
  error: { color: "#F04438", marginBottom: 12 },
  empty: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    padding: 16,
  },
  emptyText: { color: colors.textSecondary, lineHeight: 20 },
  card: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    padding: 14,
    marginBottom: 12,
    backgroundColor: colors.white,
  },
  top: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  meta: { fontSize: 12, color: colors.textMuted },
  preview: { fontSize: 14, lineHeight: 20, color: colors.textPrimary },
  count: {
    marginTop: 8,
    fontSize: 12,
    color: colors.textSecondary,
    fontWeight: "600",
  },
});
