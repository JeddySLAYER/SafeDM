import React, { useCallback, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { ApiError } from "../api/client";
import { listCommunityThreats } from "../api/threats";
import Button from "../components/Button";
import RiskBadge from "../components/RiskBadge";
import Screen from "../components/Screen";
import ScreenHeader from "../components/ScreenHeader";
import { severityToLevel } from "../utils/risk";
import { colors, radii } from "../theme/tokens";

const PAGE_SIZE = 20;

export default function CommunityScreen({ navigation }) {
  const [items, setItems] = useState([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState("");

  const loadPage = useCallback(async (nextPage, append) => {
    if (append) setLoadingMore(true);
    else setLoading(true);
    setError("");
    try {
      const data = await listCommunityThreats(nextPage, PAGE_SIZE);
      setTotal(data.total || 0);
      setPage(nextPage);
      setItems((prev) =>
        append ? [...prev, ...(data.items || [])] : data.items || [],
      );
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : "Impossible de charger les menaces.",
      );
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadPage(1, false);
    }, [loadPage]),
  );

  const hasMore = items.length < total;

  return (
    <Screen scroll>
      <ScreenHeader
        title="Menaces communautaires"
        onBack={() => navigation.goBack()}
      />
      <Text style={styles.subtitle}>
        Menaces signalées par la communauté SafeDM.
      </Text>

      {loading ? (
        <ActivityIndicator color={colors.bluePrimary} style={{ marginTop: 24 }} />
      ) : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}

      {!loading && items.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyText}>Aucune menace active pour le moment.</Text>
        </View>
      ) : null}

      {items.map((threat) => (
        <View key={threat.id} style={styles.card}>
          <View style={styles.cardTop}>
            <Text style={styles.meta}>
              {threat.report_count} signalement
              {threat.report_count > 1 ? "s" : ""}
            </Text>
            <RiskBadge level={severityToLevel(threat.severity)} />
          </View>
          <Text style={styles.preview} numberOfLines={3}>
            {threat.content}
          </Text>
          {threat.urls?.length ? (
            <Text style={styles.urls} numberOfLines={1}>
              {threat.urls[0].original_url}
            </Text>
          ) : null}
        </View>
      ))}

      {hasMore ? (
        <Button
          label="Charger plus"
          variant="outline"
          loading={loadingMore}
          onPress={() => loadPage(page + 1, true)}
          style={{ marginTop: 8 }}
        />
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  subtitle: {
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: 16,
    marginTop: -8,
  },
  error: { color: "#F04438", marginBottom: 12 },
  empty: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    padding: 16,
  },
  emptyText: { color: colors.textSecondary },
  card: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    padding: 14,
    marginBottom: 10,
    backgroundColor: colors.white,
  },
  cardTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  meta: { fontSize: 12, color: colors.textSecondary, fontWeight: "600" },
  preview: { fontSize: 14, lineHeight: 20, color: colors.textPrimary },
  urls: {
    marginTop: 8,
    fontSize: 12,
    color: colors.bluePrimary,
  },
});
