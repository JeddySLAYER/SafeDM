import React, { useCallback, useMemo, useRef, useState } from "react";
import {
  Animated,
  Dimensions,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Button from "../components/Button";
import { IconBadge, IconGlyph } from "../components/Icons";
import Screen from "../components/Screen";
import ScreenHeader from "../components/ScreenHeader";
import { getScenario, SCENARIOS } from "../content/guideContent";
import { colors, radii } from "../theme/tokens";

const { width } = Dimensions.get("window");

function LessonCard({ item, index, total, onAction, navigation }) {
  if (item.type === "intro") {
    return (
      <View style={[styles.page, { width }]}>
        <View style={styles.introCard}>
          <IconBadge name={item.icon} size={64} />
          <Text style={styles.introTitle}>{item.title}</Text>
          <Text style={styles.introTagline}>{item.tagline}</Text>
          <Text style={styles.introBody}>{item.situation}</Text>
        </View>
        <Text style={styles.swipeHint}>Glisser pour continuer →</Text>
      </View>
    );
  }
  if (item.type === "flag") {
    return (
      <View style={[styles.page, { width }]}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionLabel}>À repérer</Text>
          <Text style={styles.sectionTitle}>Les signes qui alertent</Text>
        </View>
        <View style={styles.card}>
          <View style={styles.flagRow}>
            <View style={styles.flagDot} />
            <View style={{ flex: 1 }}>
              <Text style={styles.flagLabel}>{item.label}</Text>
              <Text style={styles.flagWhy}>{item.why}</Text>
            </View>
          </View>
        </View>
        <Text style={styles.counter}>
          {index + 1} / {total}
        </Text>
      </View>
    );
  }
  if (item.type === "steps") {
    return (
      <View style={[styles.page, { width }]}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionLabel}>À faire</Text>
          <Text style={styles.sectionTitle}>Les réflexes à appliquer</Text>
        </View>
        <View style={styles.card}>
          {(item.steps || []).map((step, i) => (
            <View key={i} style={styles.stepRow}>
              <View style={styles.stepBadge}>
                <Text style={styles.stepNum}>{i + 1}</Text>
              </View>
              <Text style={styles.stepText}>{step}</Text>
            </View>
          ))}
        </View>
        <Text style={styles.counter}>
          {index + 1} / {total}
        </Text>
      </View>
    );
  }
  if (item.type === "actions") {
    return (
      <View style={[styles.page, { width }]}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionLabel}>Agir</Text>
          <Text style={styles.sectionTitle}>Passer à l’action</Text>
        </View>
        <View style={styles.card}>
          <Text style={styles.actionsBody}>
            Vous savez maintenant repérer et réagir. Choisissez l’action qui vous
            aide le mieux.
          </Text>
        </View>
        {(item.actions || []).map((action) => (
          <Button
            key={action.action}
            label={action.label}
            variant={action.action === "report" ? "outline" : "primary"}
            onPress={() => onAction(action.action)}
            icon={
              <IconGlyph
                name={action.action === "report" ? "flag" : "shield"}
                color={action.action === "report" ? colors.bluePrimary : colors.white}
                size={16}
              />
            }
            style={{ marginBottom: 10, marginHorizontal: 16 }}
          />
        ))}
        {item.related && item.related.length > 0 ? (
          <>
            <Text style={[styles.sectionLabel, { marginTop: 16, marginHorizontal: 16 }]}>
              Situations liées
            </Text>
            {item.related.map((r) => (
              <Pressable
                key={r.id}
                style={[styles.relatedRow, { marginHorizontal: 16 }]}
                onPress={() => navigation.push("GuideLesson", { scenarioId: r.id })}
              >
                <IconBadge name={r.icon} size={36} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.relatedTitle}>{r.title}</Text>
                  <Text style={styles.relatedTagline}>{r.tagline}</Text>
                </View>
                <IconGlyph name="chevron" color={colors.textMuted} size={18} />
              </Pressable>
            ))}
          </>
        ) : null}
        <Text style={styles.counter}>
          {index + 1} / {total}
        </Text>
      </View>
    );
  }
  return <View style={[styles.page, { width }]} />;
}

export default function GuideLessonScreen({ navigation, route }) {
  const scenario = useMemo(
    () => getScenario(route?.params?.scenarioId),
    [route?.params?.scenarioId],
  );
  const insets = useSafeAreaInsets();
  const listRef = useRef(null);
  const [index, setIndex] = useState(0);

  const slides = useMemo(() => {
    if (!scenario) return [];
    const out = [
      {
        type: "intro",
        id: "intro",
        icon: scenario.icon,
        title: scenario.title,
        tagline: scenario.tagline,
        situation: scenario.situation,
      },
    ];
    (scenario.redFlags || []).forEach((flag, i) => {
      out.push({ type: "flag", id: `flag-${i}`, ...flag });
    });
    out.push({ type: "steps", id: "steps", steps: scenario.reflex || [] });
    const related = (scenario.related || [])
      .map((rid) => SCENARIOS.find((s) => s.id === rid))
      .filter(Boolean);
    out.push({ type: "actions", id: "actions", actions: scenario.actions || [], related });
    return out;
  }, [scenario]);

  const onAction = useCallback(
    (action) => {
      if (action === "analyze") {
        navigation.navigate("ManualAnalysis");
        return;
      }
      if (action === "report") {
        navigation.navigate("DirectReport");
      }
    },
    [navigation],
  );

  const onViewableItemsChanged = useRef(({ viewableItems }) => {
    if (viewableItems && viewableItems.length > 0) {
      const idx = viewableItems[0].index || 0;
      setIndex(idx);
    }
  }).current;

  if (!scenario) {
    return (
      <Screen scroll>
        <ScreenHeader title="Leçon" onBack={() => navigation.goBack()} />
        <Text style={styles.missing}>Cette situation n’existe pas.</Text>
      </Screen>
    );
  }

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + 4 }]}>
        <Pressable onPress={() => navigation.goBack()} style={styles.backBtn}>
          <IconGlyph name="chevron" color={colors.textPrimary} size={22} style={{ transform: [{ rotate: "180deg" }] }} />
        </Pressable>
        <View style={styles.progressBar}>
          <View style={[styles.progressFill, { width: `${((index + 1) / slides.length) * 100}%` }]} />
        </View>
        <Text style={styles.progressText}>
          {index + 1}/{slides.length}
        </Text>
      </View>
      <FlatList
        ref={listRef}
        data={slides}
        keyExtractor={(item) => item.id}
        renderItem={({ item, index: i }) => (
          <LessonCard item={item} index={i} total={slides.length} onAction={onAction} navigation={navigation} />
        )}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={{ itemVisiblePercentThreshold: 50 }}
        bounces={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
    paddingBottom: 12,
    backgroundColor: colors.background,
  },
  backBtn: { padding: 6 },
  progressBar: {
    flex: 1,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.border,
    overflow: "hidden",
  },
  progressFill: { height: 8, backgroundColor: colors.bluePrimary },
  progressText: { fontSize: 12, color: colors.textMuted, fontWeight: "600" },
  page: { flex: 1, paddingTop: 20, paddingBottom: 32 },
  introCard: {
    marginHorizontal: 16,
    backgroundColor: colors.blueSoft,
    borderRadius: radii.lg,
    padding: 28,
    alignItems: "center",
  },
  introTitle: {
    fontSize: 26,
    fontWeight: "800",
    color: colors.textPrimary,
    textAlign: "center",
    marginTop: 16,
  },
  introTagline: {
    fontSize: 16,
    color: colors.textSecondary,
    textAlign: "center",
    marginTop: 8,
  },
  introBody: {
    fontSize: 16,
    lineHeight: 26,
    color: colors.textPrimary,
    textAlign: "center",
    marginTop: 16,
  },
  swipeHint: {
    textAlign: "center",
    marginTop: 24,
    color: colors.textMuted,
    fontSize: 13,
  },
  sectionHeader: { marginHorizontal: 16, marginBottom: 16 },
  sectionLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.bluePrimary,
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  sectionTitle: {
    fontSize: 24,
    fontWeight: "800",
    color: colors.textPrimary,
    marginTop: 4,
  },
  card: {
    marginHorizontal: 16,
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 20,
    marginBottom: 16,
  },
  flagRow: { flexDirection: "row", gap: 12, alignItems: "flex-start" },
  flagDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.bluePrimary,
    marginTop: 6,
  },
  flagLabel: { fontSize: 18, fontWeight: "700", color: colors.textPrimary },
  flagWhy: { fontSize: 16, lineHeight: 26, color: colors.textSecondary, marginTop: 8 },
  stepRow: { flexDirection: "row", gap: 12, alignItems: "flex-start", marginBottom: 16 },
  stepBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.blueSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  stepNum: { fontSize: 15, fontWeight: "800", color: colors.blue600 },
  stepText: { flex: 1, fontSize: 16, lineHeight: 26, color: colors.textPrimary },
  actionsBody: { fontSize: 16, lineHeight: 26, color: colors.textPrimary },
  relatedRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.lg,
    padding: 14,
    marginBottom: 10,
  },
  relatedTitle: { fontSize: 15, fontWeight: "700", color: colors.textPrimary },
  relatedTagline: { fontSize: 13, color: colors.textSecondary, marginTop: 2 },
  counter: { textAlign: "center", color: colors.textMuted, marginTop: 8 },
  missing: { fontSize: 15, color: colors.textSecondary, margin: 16 },
});
