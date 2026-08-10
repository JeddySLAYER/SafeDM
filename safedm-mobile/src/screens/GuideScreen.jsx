import React, { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { ApiError } from "../api/client";
import { listCategories } from "../api/guide";
import { IconBadge, IconGlyph } from "../components/Icons";
import Screen from "../components/Screen";
import ScreenHeader from "../components/ScreenHeader";
import { colors, radii } from "../theme/tokens";

export default function GuideScreen({ navigation }) {
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useFocusEffect(
    useCallback(() => {
      let active = true;
      (async () => {
        setLoading(true);
        setError("");
        try {
          const data = await listCategories();
          if (active) setCategories(data || []);
        } catch (err) {
          if (active) {
            setError(
              err instanceof ApiError ? err.message : "Guide indisponible.",
            );
          }
        } finally {
          if (active) setLoading(false);
        }
      })();
      return () => {
        active = false;
      };
    }, []),
  );

  return (
    <Screen scroll>
      <ScreenHeader title="Guide" onBack={() => navigation.goBack()} />
      <Text style={styles.subtitle}>
        Conseils pour reconnaître et éviter les messages malveillants.
      </Text>

      {loading ? (
        <ActivityIndicator color={colors.bluePrimary} style={{ marginTop: 24 }} />
      ) : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}

      {categories.map((cat) => (
        <View key={cat.id} style={styles.block}>
          <View style={styles.catHeader}>
            <IconBadge name="guide" size={40} />
            <View style={{ flex: 1 }}>
              <Text style={styles.catTitle}>{cat.title}</Text>
              {cat.description ? (
                <Text style={styles.catDesc}>{cat.description}</Text>
              ) : null}
            </View>
          </View>
          {(cat.articles || []).map((article) => (
            <Pressable
              key={article.id}
              style={styles.articleRow}
              onPress={() =>
                navigation.navigate("GuideArticle", { articleId: article.id })
              }
            >
              <Text style={styles.articleTitle}>{article.title}</Text>
              <IconGlyph name="chevron" color={colors.textMuted} size={22} />
            </Pressable>
          ))}
        </View>
      ))}
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
  block: { marginBottom: 20 },
  catHeader: {
    flexDirection: "row",
    gap: 12,
    alignItems: "center",
    marginBottom: 10,
  },
  catTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.textPrimary,
  },
  catDesc: {
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 2,
  },
  articleRow: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    paddingHorizontal: 14,
    paddingVertical: 14,
    marginBottom: 8,
    backgroundColor: colors.white,
  },
  articleTitle: {
    flex: 1,
    fontSize: 14,
    fontWeight: "600",
    color: colors.textPrimary,
  },
});
