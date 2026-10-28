import React, { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { ApiError } from "../api/client";
import { listCategories } from "../api/guide";
import { IconBadge, IconGlyph } from "../components/Icons";
import Screen from "../components/Screen";
import {
  REFLEXES,
  SCENARIOS,
} from "../content/guideContent";
import { countChecked, getGuideProgress } from "../services/guideProgress";
import { colors, radii } from "../theme/tokens";

/**
 * Guide de bonnes pratiques.
 *
 * L'ecran n'est pas une table des matieres : il propose trois entrees —
 * les reflexes (a cocher), le quiz, et les situations — puis les articles
 * du CMS quand le serveur repond. Le tout marche hors ligne.
 */
export default function GuideScreen({ navigation }) {
  const [articles, setArticles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [progress, setProgress] = useState({ checked: {} });

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    // La progression locale d'abord : l'ecran s'affiche sans attendre le reseau.
    setProgress(await getGuideProgress());
    try {
      const data = await listCategories();
      const flat = (data || []).flatMap((cat) =>
        (cat.articles || []).map((article) => ({ ...article, category: cat.title })),
      );
      setArticles(flat);
    } catch (err) {
      // Pas de reseau ? Le guide local reste complet : on ne signale l'echec
      // que si des articles etaient attendus.
      if (err instanceof ApiError && err.status === 0) {
        setError("");
      } else {
        setError(
          err instanceof ApiError ? err.message : "Articles indisponibles.",
        );
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      (async () => {
        await load();
        if (!active) return;
      })();
      return () => {
        active = false;
      };
    }, [load]),
  );

  const checkedCount = countChecked(progress);

  return (
    <Screen scroll>
      <Text style={styles.title}>Guide</Text>
      <Text style={styles.subtitle}>
        Des réflexes, pas des alertes. Trois minutes ici valent mieux qu’un
        message d’arnaque de travers.
      </Text>

      {/* Entree 1 — les reflexes, avec une progression visible. */}
      <Pressable
        style={styles.hero}
        onPress={() => navigation.navigate("GuideChecklist")}
        accessibilityRole="button"
        accessibilityLabel={`Les ${REFLEXES.length} réflexes à prendre. ${checkedCount} déjà cochés.`}
      >
        <View style={styles.heroTop}>
          <IconBadge name="shield" size={44} />
          <View style={{ flex: 1 }}>
            <Text style={styles.heroTitle}>Les {REFLEXES.length} réflexes</Text>
            <Text style={styles.heroBody}>
              {checkedCount === 0
                ? "Cochez-les un par un : ils restent sur votre téléphone."
                : checkedCount === REFLEXES.length
                  ? "Tous cochés. Revenez dessus de temps en temps."
                  : `${checkedCount} sur ${REFLEXES.length} déjà pris.`}
            </Text>
          </View>
          <IconGlyph name="chevron" color={colors.textMuted} size={22} />
        </View>
        <View style={styles.progressTrack}>
          <View
            style={[
              styles.progressFill,
              { width: `${(checkedCount / REFLEXES.length) * 100}%` },
            ]}
          />
        </View>
      </Pressable>

      {/* Entree 2 — le quiz. */}
      <Pressable
        style={styles.quizCard}
        onPress={() => navigation.navigate("GuideQuiz")}
        accessibilityRole="button"
        accessibilityLabel="Testez vos réflexes"
      >
        <IconBadge name="warning" size={40} />
        <View style={{ flex: 1 }}>
          <Text style={styles.quizTitle}>Testez vos réflexes</Text>
          <Text style={styles.quizBody}>
            {progress.quizScore != null
              ? `Dernier score : ${progress.quizScore}/${progress.quizTotal}.`
              : "Cinq questions pour vérifier que les réflexes sont en place."}
          </Text>
        </View>
        <IconGlyph name="chevron" color={colors.textMuted} size={22} />
      </Pressable>

      {/* Entree 3 — les situations, le coeur du guide. */}
      <Text style={styles.section}>Situations courantes</Text>
      {SCENARIOS.map((scenario) => (
        <Pressable
          key={scenario.id}
          style={styles.scenarioRow}
          onPress={() =>
            navigation.navigate("GuideLesson", { scenarioId: scenario.id })
          }
          accessibilityRole="button"
          accessibilityLabel={`${scenario.title}. ${scenario.tagline}`}
        >
          <IconBadge name={scenario.icon} size={40} />
          <View style={{ flex: 1 }}>
            <Text style={styles.scenarioTitle}>{scenario.title}</Text>
            <Text style={styles.scenarioTagline}>{scenario.tagline}</Text>
          </View>
          <IconGlyph name="chevron" color={colors.textMuted} size={22} />
        </Pressable>
      ))}

      {/* Articles du CMS — complements, pas le socle. */}
      {loading ? (
        <ActivityIndicator color={colors.bluePrimary} style={{ marginTop: 16 }} />
      ) : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {!loading && articles.length > 0 ? (
        <>
          <Text style={styles.section}>Pour aller plus loin</Text>
          {articles.map((article) => (
            <Pressable
              key={article.id}
              style={styles.articleRow}
              onPress={() =>
                navigation.navigate("GuideArticle", { articleId: article.id })
              }
              accessibilityRole="button"
            >
              <View style={{ flex: 1 }}>
                {article.category ? (
                  <Text style={styles.articleCategory}>{article.category}</Text>
                ) : null}
                <Text style={styles.articleTitle}>{article.title}</Text>
                <Text style={styles.articleSubtitle}>Lire en glissant</Text>
              </View>
              <IconGlyph name="chevron" color={colors.textMuted} size={22} />
            </Pressable>
          ))}
        </>
      ) : null}
      {!loading && articles.length === 0 && !error ? (
        <Text style={styles.offlineNote}>
          Les articles détaillés se chargent quand le réseau est disponible.
        </Text>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: {
    fontSize: 28,
    fontWeight: "700",
    color: colors.textPrimary,
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 14,
    color: colors.textSecondary,
    lineHeight: 20,
    marginBottom: 20,
  },
  hero: {
    backgroundColor: colors.blueSoft,
    borderRadius: radii.lg,
    padding: 16,
    marginBottom: 12,
  },
  heroTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  heroTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.textPrimary,
  },
  heroBody: {
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 3,
    lineHeight: 19,
  },
  progressTrack: {
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.white,
    marginTop: 14,
    overflow: "hidden",
  },
  progressFill: {
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.bluePrimary,
  },
  quizCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.lg,
    padding: 14,
    marginBottom: 20,
  },
  quizTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: colors.textPrimary,
  },
  quizBody: {
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 3,
    lineHeight: 19,
  },
  section: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.textSecondary,
    textTransform: "uppercase",
    letterSpacing: 0.4,
    marginBottom: 10,
    marginTop: 4,
  },
  scenarioRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    padding: 14,
    marginBottom: 10,
  },
  scenarioTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: colors.textPrimary,
  },
  scenarioTagline: {
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 3,
    lineHeight: 19,
  },
  articleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    padding: 14,
    marginBottom: 10,
  },
  articleCategory: {
    fontSize: 11,
    fontWeight: "700",
    color: colors.bluePrimary,
    textTransform: "uppercase",
    letterSpacing: 0.3,
    marginBottom: 3,
  },
  articleSubtitle: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 4,
  },
  error: { color: colors.danger, marginBottom: 12 },
  offlineNote: {
    fontSize: 13,
    color: colors.textMuted,
    lineHeight: 19,
    marginTop: 8,
  },
});
