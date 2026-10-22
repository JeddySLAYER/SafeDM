import React, { useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Button from "../components/Button";
import { IconGlyph } from "../components/Icons";
import Screen from "../components/Screen";
import ScreenHeader from "../components/ScreenHeader";
import { QUIZ } from "../content/guideContent";
import { setQuizResult } from "../services/guideProgress";
import { colors, radii } from "../theme/tokens";

/**
 * Petit quiz de validation.
 *
 * Chaque reponse est corrigee immediatement et expliquee : l'objectif n'est
 * pas de noter, c'est de faire changer d'avis quand la mauvaise reponse
 * paraissait evidente.
 */
export default function GuideQuizScreen({ navigation }) {
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState({});
  const [finished, setFinished] = useState(false);

  const question = QUIZ[index];
  const chosen = answers[index];
  const answered = chosen !== undefined;

  const score = useMemo(
    () =>
      QUIZ.reduce(
        (total, q, i) =>
          total + (answers[i] && q.choices.find((c) => c.id === answers[i])?.correct ? 1 : 0),
        0,
      ),
    [answers],
  );

  async function onChoose(choiceId) {
    if (answered) return;
    setAnswers((current) => ({ ...current, [index]: choiceId }));
  }

  async function onNext() {
    if (index < QUIZ.length - 1) {
      setIndex((current) => current + 1);
      return;
    }
    const finalScore = QUIZ.reduce(
      (total, q, i) =>
        total +
        (answers[i] && q.choices.find((c) => c.id === answers[i])?.correct ? 1 : 0),
      0,
    );
    await setQuizResult(finalScore, QUIZ.length);
    setFinished(true);
  }

  function onRestart() {
    setAnswers({});
    setIndex(0);
    setFinished(false);
  }

  if (finished) {
    return (
      <Screen scroll>
        <ScreenHeader title="Résultat" onBack={() => navigation.goBack()} />
        <View style={styles.resultCard}>
          <Text style={styles.resultScore}>
            {score} / {QUIZ.length}
          </Text>
          <Text style={styles.resultTitle}>
            {score === QUIZ.length
              ? "Les réflexes sont bien en place."
              : score >= QUIZ.length - 1
                ? "Presque. Relisez les points ci-dessous."
                : "Il y a des réflexes à retravailler."}
          </Text>
          <Text style={styles.resultBody}>
            Un score imparfait est normal : ce qui compte, c’est que vous
            sachiez quoi faire la prochaine fois.
          </Text>
        </View>

        <Text style={styles.section}>Vos réponses</Text>
        {QUIZ.map((q, i) => {
          const picked = q.choices.find((c) => c.id === answers[i]);
          return (
            <View key={q.id} style={styles.reviewRow}>
              <IconGlyph
                name={picked?.correct ? "check" : "warning"}
                color={picked?.correct ? colors.success : colors.danger}
                size={18}
              />
              <Text style={styles.reviewText}>{q.question}</Text>
            </View>
          );
        })}

        <Button label="Recommencer" onPress={onRestart} style={{ marginTop: 16 }} />
        <Button
          label="Retour au guide"
          variant="outline"
          onPress={() => navigation.goBack()}
          style={{ marginTop: 10 }}
        />
      </Screen>
    );
  }

  return (
    <Screen scroll>
      <ScreenHeader title="Test des réflexes" onBack={() => navigation.goBack()} />

      <View style={styles.progressRow}>
        <Text style={styles.progressLabel}>
          Question {index + 1} sur {QUIZ.length}
        </Text>
        <View style={styles.track}>
          <View
            style={[
              styles.fill,
              { width: `${((index + (answered ? 1 : 0)) / QUIZ.length) * 100}%` },
            ]}
          />
        </View>
      </View>

      <Text style={styles.question}>{question.question}</Text>

      {question.choices.map((choice) => {
        const isChosen = chosen === choice.id;
        const reveal = answered;
        const isCorrect = choice.correct;
        const style = !reveal
          ? styles.choice
          : isCorrect
            ? [styles.choice, styles.choiceCorrect]
            : isChosen
              ? [styles.choice, styles.choiceWrong]
              : styles.choice;
        return (
          <Pressable
            key={choice.id}
            style={style}
            onPress={() => onChoose(choice.id)}
            accessibilityRole="button"
            accessibilityState={{ selected: isChosen }}
            accessibilityLabel={choice.label}
          >
            <View style={styles.choiceHead}>
              <Text style={styles.choiceLabel}>{choice.label}</Text>
              {reveal && isCorrect ? (
                <IconGlyph name="check" color={colors.successText} size={18} />
              ) : null}
              {reveal && isChosen && !isCorrect ? (
                <IconGlyph name="warning" color={colors.dangerText} size={18} />
              ) : null}
            </View>
            {reveal && (isCorrect || isChosen) ? (
              <Text style={styles.choiceWhy}>{choice.why}</Text>
            ) : null}
          </Pressable>
        );
      })}

      <Button
        label={index === QUIZ.length - 1 ? "Voir mon résultat" : "Question suivante"}
        onPress={onNext}
        disabled={!answered}
        style={{ marginTop: 16 }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  progressRow: {
    marginBottom: 20,
  },
  progressLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.textSecondary,
    marginBottom: 8,
  },
  track: {
    height: 5,
    borderRadius: 3,
    backgroundColor: colors.border,
    overflow: "hidden",
  },
  fill: {
    height: 5,
    borderRadius: 3,
    backgroundColor: colors.bluePrimary,
  },
  question: {
    fontSize: 20,
    fontWeight: "700",
    lineHeight: 28,
    color: colors.textPrimary,
    marginBottom: 20,
  },
  choice: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    padding: 14,
    marginBottom: 10,
  },
  choiceCorrect: {
    backgroundColor: colors.successSoft,
    borderColor: colors.success,
  },
  choiceWrong: {
    backgroundColor: colors.dangerSoft,
    borderColor: colors.danger,
  },
  choiceHead: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  choiceLabel: {
    flex: 1,
    fontSize: 15,
    lineHeight: 22,
    color: colors.textPrimary,
  },
  choiceWhy: {
    fontSize: 13,
    lineHeight: 20,
    color: colors.textSecondary,
    marginTop: 10,
  },
  resultCard: {
    backgroundColor: colors.blueSoft,
    borderRadius: radii.lg,
    padding: 20,
    alignItems: "center",
    marginBottom: 20,
  },
  resultScore: {
    fontSize: 40,
    fontWeight: "700",
    color: colors.blue600,
  },
  resultTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: colors.textPrimary,
    textAlign: "center",
    marginTop: 6,
  },
  resultBody: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: "center",
    marginTop: 8,
    lineHeight: 20,
  },
  section: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.textSecondary,
    textTransform: "uppercase",
    letterSpacing: 0.4,
    marginBottom: 10,
  },
  reviewRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    padding: 12,
    marginBottom: 8,
  },
  reviewText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
    color: colors.textPrimary,
  },
});
