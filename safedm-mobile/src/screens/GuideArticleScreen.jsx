import React, { useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, Text } from "react-native";
import { ApiError } from "../api/client";
import { getArticle } from "../api/guide";
import Screen from "../components/Screen";
import ScreenHeader from "../components/ScreenHeader";
import { colors } from "../theme/tokens";

export default function GuideArticleScreen({ navigation, route }) {
  const articleId = route.params?.articleId;
  const [article, setArticle] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    (async () => {
      setLoading(true);
      try {
        const data = await getArticle(articleId);
        if (active) setArticle(data);
      } catch (err) {
        if (active) {
          setError(
            err instanceof ApiError ? err.message : "Article introuvable.",
          );
        }
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [articleId]);

  return (
    <Screen scroll>
      <ScreenHeader
        title="Article"
        onBack={() => navigation.goBack()}
      />
      {loading ? (
        <ActivityIndicator color={colors.bluePrimary} />
      ) : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {article ? (
        <>
          <Text style={styles.title}>{article.title}</Text>
          <Text style={styles.content}>{article.content}</Text>
        </>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  error: { color: "#F04438" },
  title: {
    fontSize: 24,
    fontWeight: "700",
    color: colors.textPrimary,
    marginBottom: 16,
  },
  content: {
    fontSize: 15,
    lineHeight: 24,
    color: colors.textPrimary,
  },
});
