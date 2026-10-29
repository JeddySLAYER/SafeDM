import React, { useCallback, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { IconBadge, IconGlyph } from "../components/Icons";
import Screen from "../components/Screen";
import ScreenHeader from "../components/ScreenHeader";
import { REFLEXES } from "../content/guideContent";
import { countChecked, getGuideProgress, setReflexChecked } from "../services/guideProgress";
import { colors, radii } from "../theme/tokens";

/**
 * Les reflexes, a cocher.
 *
 * Un reflexe qu'on lit une fois n'est pas un reflexe : on le coche, il reste
 * affiche, et la progression montre ce qui manque encore.
 */
export default function GuideChecklistScreen({ navigation }) {
  const [checked, setChecked] = useState({});
  const [open, setOpen] = useState({});

  const load = useCallback(async () => {
    const progress = await getGuideProgress();
    setChecked(progress.checked || {});
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const done = countChecked({ checked });
  const allDone = done === REFLEXES.length;

  async function toggle(reflexId) {
    const next = !checked[reflexId];
    setChecked((current) => {
      const updated = { ...current };
      if (next) updated[reflexId] = true;
      else delete updated[reflexId];
      return updated;
    });
    await setReflexChecked(reflexId, next);
  }

  return (
    <Screen scroll>
      <ScreenHeader title="Réflexes" onBack={() => navigation.goBack()} />

      <Text style={styles.lead}>
        Six habitudes valent mieux qu’un doute. Cochez celles que vous avez
        installées — la progression reste sur ce téléphone.
      </Text>

      <View style={styles.progressCard}>
        <View style={{ flex: 1 }}>
          <Text style={styles.progressTitle}>
            {allDone ? "Les six réflexes sont en place" : `${done} sur ${REFLEXES.length} réflexes`}
          </Text>
          <Text style={styles.progressBody}>
            {allDone
              ? "Ils sont en place. Ils ne servent que si on ne les saute pas."
              : "Marquez-les au fur et à mesure que vous les installez."}
          </Text>
        </View>
        <IconBadge name={allDone ? "shield" : "clipboard"} size={44} />
      </View>

      <View style={styles.progressTrack}>
        <View
          style={[
            styles.progressFill,
            { width: `${(done / REFLEXES.length) * 100}%` },
          ]}
        />
      </View>

      {REFLEXES.map((reflex) => {
        const isChecked = Boolean(checked[reflex.id]);
        const isOpen = Boolean(open[reflex.id]);
        return (
          <Pressable
            key={reflex.id}
            style={[styles.row, isChecked && styles.rowChecked]}
            onPress={() => toggle(reflex.id)}
            accessibilityRole="button"
            accessibilityState={{ checked: isChecked }}
            accessibilityLabel={reflex.title}
          >
            <View style={[styles.check, isChecked && styles.checkOn]}>
              {isChecked ? (
                <IconGlyph name="check" color={colors.white} size={16} />
              ) : null}
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.title, isChecked && styles.titleChecked]}>
                {reflex.title}
              </Text>
              {isOpen ? (
                <>
                  <Text style={styles.detail}>{reflex.detail}</Text>
                  <Text style={styles.example}>{reflex.example}</Text>
                </>
              ) : null}
            </View>
            <Pressable
              onPress={() =>
                setOpen((current) => ({
                  ...current,
                  [reflex.id]: !current[reflex.id],
                }))
              }
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel={
                isOpen ? "Masquer le détail" : "Voir pourquoi"
              }
            >
              <IconGlyph name="chevron" color={colors.textMuted} size={20} />
            </Pressable>
          </Pressable>
        );
      })}

      <Text style={styles.footnote}>
        Le détail s’ouvre avec la petite flèche : cocher un réflexe ne dit pas
        pourquoi il compte.
      </Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  lead: {
    fontSize: 14,
    color: colors.textSecondary,
    lineHeight: 20,
    marginBottom: 18,
  },
  progressCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: colors.blueSoft,
    borderRadius: radii.lg,
    padding: 16,
  },
  progressTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.textPrimary,
  },
  progressBody: {
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 4,
    lineHeight: 19,
  },
  progressTrack: {
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.border,
    marginTop: 12,
    marginBottom: 18,
    overflow: "hidden",
  },
  progressFill: {
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.bluePrimary,
  },
  row: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    padding: 14,
    marginBottom: 10,
  },
  rowChecked: {
    backgroundColor: colors.successSoft,
    borderColor: "#A9E5C3",
  },
  check: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 1.5,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 1,
  },
  checkOn: {
    backgroundColor: colors.success,
    borderColor: colors.success,
  },
  title: {
    fontSize: 15,
    fontWeight: "700",
    color: colors.textPrimary,
  },
  titleChecked: {
    color: colors.successText,
  },
  detail: {
    fontSize: 14,
    lineHeight: 21,
    color: colors.textSecondary,
    marginTop: 8,
  },
  example: {
    fontSize: 13,
    lineHeight: 19,
    color: colors.textMuted,
    fontStyle: "italic",
    marginTop: 8,
  },
  footnote: {
    fontSize: 12,
    color: colors.textMuted,
    lineHeight: 18,
    marginTop: 4,
  },
});
