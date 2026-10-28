import React, { useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Button from "../components/Button";
import { IconBadge, IconGlyph } from "../components/Icons";
import Screen from "../components/Screen";
import ScreenHeader from "../components/ScreenHeader";
import { getScenario, SCENARIOS } from "../content/guideContent";
import { colors, radii } from "../theme/tokens";

/**
 * Une situation, lue comme une procedure.
 *
 * Les signes ne sont pas une simple liste : l'utilisateur les touche un par
 * un pour comprendre pourquoi ils sont suspects. C'est ce qui fait la
 * difference entre « j'ai lu » et « j'ai compris ».
 */
export default function GuideScenarioScreen({ navigation, route }) {
  const scenario = useMemo(
    () => getScenario(route?.params?.scenarioId),
    [route?.params?.scenarioId],
  );
  const [revealed, setRevealed] = useState({});

  if (!scenario) {
    return (
      <Screen scroll>
        <ScreenHeader title="Situation" onBack={() => navigation.goBack()} />
        <Text style={styles.missing}>Cette situation n’existe pas.</Text>
      </Screen>
    );
  }

  const related = (scenario.related || [])
    .map((id) => SCENARIOS.find((item) => item.id === id))
    .filter(Boolean);

  function onAction(action) {
    if (action === "analyze") {
      navigation.navigate("ManualAnalysis");
      return;
    }
    if (action === "report") {
      navigation.navigate("DirectReport");
    }
  }

  return (
    <Screen scroll>
      <ScreenHeader title="Situation" onBack={() => navigation.goBack()} />

      <View style={styles.hero}>
        <IconBadge name={scenario.icon} size={56} />
        <Text style={styles.title}>{scenario.title}</Text>
        <Text style={styles.tagline}>{scenario.tagline}</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>La situation</Text>
        <Text style={styles.body}>{scenario.situation}</Text>
      </View>

      <Text style={styles.section}>Les signes qui doivent alerter</Text>
      {(scenario.redFlags || []).map((flag, index) => {
        const isOpen = Boolean(revealed[index]);
        return (
          <Pressable
            key={flag.label}
            style={[styles.flag, isOpen && styles.flagOpen]}
            onPress={() =>
              setRevealed((current) => ({ ...current, [index]: !current[index] }))
            }
            accessibilityRole="button"
            accessibilityState={{ expanded: isOpen }}
            accessibilityLabel={flag.label}
          >
            <View style={styles.flagHead}>
              <View style={[styles.flagDot, isOpen && styles.flagDotOpen]} />
              <Text style={styles.flagLabel}>{flag.label}</Text>
              <View style={isOpen ? styles.chevronOpen : undefined}>
                <IconGlyph name="chevron" color={colors.textMuted} size={20} />
              </View>
            </View>
            {isOpen ? <Text style={styles.flagWhy}>{flag.why}</Text> : null}
          </Pressable>
        );
      })}

      <Text style={styles.section}>Ce qu’il faut faire</Text>
      <View style={styles.card}>
        {(scenario.reflex || []).map((step, index) => (
          <View key={step} style={styles.stepRow}>
            <View style={styles.stepBadge}>
              <Text style={styles.stepNum}>{index + 1}</Text>
            </View>
            <Text style={styles.stepText}>{step}</Text>
          </View>
        ))}
      </View>

      {(scenario.actions || []).length > 0 ? (
        <>
          <Text style={styles.section}>Agir maintenant</Text>
          {scenario.actions.map((action) => (
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
              style={{ marginBottom: 10 }}
            />
          ))}
        </>
      ) : null}

      {related.length > 0 ? (
        <>
          <Text style={styles.section}>Situations liées</Text>
          {related.map((item) => (
            <Pressable
              key={item.id}
              style={styles.relatedRow}
              onPress={() =>
                navigation.push("GuideLesson", { scenarioId: item.id })
              }
              accessibilityRole="button"
            >
              <IconBadge name={item.icon} size={34} />
              <View style={{ flex: 1 }}>
                <Text style={styles.relatedTitle}>{item.title}</Text>
                <Text style={styles.relatedTagline}>{item.tagline}</Text>
              </View>
              <IconGlyph name="chevron" color={colors.textMuted} size={20} />
            </Pressable>
          ))}
        </>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: {
    alignItems: "center",
    backgroundColor: colors.blueSoft,
    borderRadius: radii.lg,
    padding: 20,
    marginBottom: 16,
  },
  title: {
    fontSize: 22,
    fontWeight: "700",
    color: colors.textPrimary,
    textAlign: "center",
    marginTop: 12,
  },
  tagline: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: "center",
    marginTop: 6,
    lineHeight: 20,
  },
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    padding: 16,
    marginBottom: 12,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: colors.textPrimary,
    marginBottom: 8,
  },
  body: {
    fontSize: 15,
    lineHeight: 23,
    color: colors.textPrimary,
  },
  section: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.textSecondary,
    textTransform: "uppercase",
    letterSpacing: 0.4,
    marginBottom: 10,
    marginTop: 8,
  },
  flag: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    paddingHorizontal: 14,
    paddingVertical: 13,
    marginBottom: 8,
  },
  flagOpen: {
    borderColor: colors.blue200,
    backgroundColor: colors.blueSoft,
  },
  flagHead: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  flagDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.border,
  },
  flagDotOpen: {
    backgroundColor: colors.bluePrimary,
  },
  flagLabel: {
    flex: 1,
    fontSize: 15,
    fontWeight: "600",
    color: colors.textPrimary,
  },
  chevronOpen: {
    transform: [{ rotate: "90deg" }],
  },
  flagWhy: {
    fontSize: 14,
    lineHeight: 21,
    color: colors.textSecondary,
    marginTop: 10,
  },
  stepRow: {
    flexDirection: "row",
    gap: 12,
    alignItems: "flex-start",
  },
  stepBadge: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: colors.blueSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  stepNum: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.blue600,
  },
  stepText: {
    flex: 1,
    fontSize: 15,
    lineHeight: 22,
    color: colors.textPrimary,
    marginBottom: 12,
  },
  relatedRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    padding: 12,
    marginBottom: 8,
  },
  relatedTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.textPrimary,
  },
  relatedTagline: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
  },
  missing: {
    fontSize: 15,
    color: colors.textSecondary,
    lineHeight: 22,
  },
});
