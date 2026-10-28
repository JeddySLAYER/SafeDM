import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Dimensions,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ApiError } from "../api/client";
import { getArticle } from "../api/guide";
import { IconGlyph } from "../components/Icons";
import { colors, radii } from "../theme/tokens";

const { width } = Dimensions.get("window");

function splitContent(content) {
  if (!content) return ["Pas de contenu disponible."];
  const parts = content
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);
  if (parts.length === 0) return [content];
  return parts;
}

export default function GuideArticleScreen({ navigation, route }) {
  const articleId = route.params?.articleId;
  const [article, setArticle] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const insets = useSafeAreaInsets();
  const [index, setIndex] = useState(0);
  const slides = splitContent(article?.content);

  useEffect(() => {
    let active = true;
    (async () => {
      setLoading(true);
      try {
        const data = await getArticle(articleId);
        if (active) setArticle(data);
      } catch (err) {
        if (active) {
          setError(err instanceof ApiError ? err.message : "Article introuvable.");
        }
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [articleId]);

  const onViewableItemsChanged = useRef(({ viewableItems }) => {
    if (viewableItems && viewableItems.length > 0) {
      setIndex(viewableItems[0].index || 0);
    }
  }).current;

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + 4 }]}>
        <Pressable onPress={() => navigation.goBack()} style={styles.backBtn}>
          <IconGlyph
            name="chevron"
            color={colors.textPrimary}
            size={22}
            style={{ transform: [{ rotate: "180deg" }] }}
          />
        </Pressable>
        <View style={styles.titleWrap}>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {article?.title || "Article"}
          </Text>
        </View>
        {slides.length > 1 ? (
          <Text style={styles.progressText}>
            {index + 1}/{slides.length}
          </Text>
        ) : (
          <View style={{ width: 40 }} />
        )}
      </View>
      {loading ? <ActivityIndicator color={colors.bluePrimary} style={{ marginTop: 40 }} /> : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {!loading && article ? (
        slides.length === 1 ? (
          <View style={[styles.singlePage, { width }]}>
            <Text style={styles.articleTitle}>{article.title}</Text>
            <Text style={styles.content}>{slides[0]}</Text>
            <Text style={styles.swipeHint}>Glisser pour parcourir</Text>
          </View>
        ) : (
          <FlatList
            data={slides}
            keyExtractor={(_, i) => String(i)}
            renderItem={({ item }) => (
              <View style={[styles.page, { width }]}>
                <Text style={styles.content}>{item}</Text>
              </View>
            )}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onViewableItemsChanged={onViewableItemsChanged}
            viewabilityConfig={{ itemVisiblePercentThreshold: 50 }}
            bounces={false}
          />
        )
      ) : null}
    </View>
  );
}


const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 12,
    paddingBottom: 10,
    backgroundColor: colors.background,
  },
  backBtn: { padding: 6 },
  titleWrap: { flex: 1 },
  headerTitle: { fontSize: 16, fontWeight: "700", color: colors.textPrimary },
  progressText: { fontSize: 12, color: colors.textMuted, fontWeight: "600", width: 40, textAlign: "right" },
  error: { color: "#F04438", margin: 16 },
  page: { flex: 1, paddingHorizontal: 20, paddingTop: 16 },
  singlePage: { flex: 1, paddingHorizontal: 20, paddingTop: 16 },
  articleTitle: {
    fontSize: 28,
    fontWeight: "800",
    color: colors.textPrimary,
    marginBottom: 18,
  },
  content: {
    fontSize: 17,
    lineHeight: 30,
    color: colors.textPrimary,
  },
  swipeHint: {
    textAlign: "center",
    marginTop: 28,
    color: colors.textMuted,
    fontSize: 13,
  },
});
