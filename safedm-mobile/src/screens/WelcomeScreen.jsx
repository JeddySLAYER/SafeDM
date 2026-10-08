import React, { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import BrandMark from "../components/BrandMark";
import Button from "../components/Button";
import OnboardingArt from "../components/OnboardingArt";
import Screen from "../components/Screen";
import { useAuth } from "../context/AuthContext";
import { colors, spacing, typography } from "../theme/tokens";

const SLIDES = [
  {
    art: "phone",
    title: "Vos messages, sur votre téléphone",
    body: "SafeDM lit les notifications des applications que vous choisissez. Rien n'est modifié, rien n'est bloqué.",
  },
  {
    art: "message",
    title: "Un contrôle avant le doute",
    body: "Collez un SMS, un message ou un e-mail. Le premier avis est calculé ici, sans envoyer le texte.",
  },
  {
    art: "link",
    title: "Les liens aussi",
    body: "Un lien inattendu peut être vérifié avant ouverture. Vous décidez ensuite.",
  },
];

export default function WelcomeScreen({ navigation }) {
  const { completeOnboarding } = useAuth();
  const [index, setIndex] = useState(0);
  const slide = SLIDES[index];
  const isLast = index === SLIDES.length - 1;

  async function finish() {
    await completeOnboarding();
    navigation.replace("Login");
  }

  return (
    <Screen contentStyle={styles.content} style={styles.canvas}>
      <BrandMark size={32} compact />
      <View style={styles.hero}>
        <OnboardingArt name={slide.art} />
        <Text style={styles.title}>{slide.title}</Text>
        <Text style={styles.body}>{slide.body}</Text>
      </View>
      <View style={styles.dots}>
        {SLIDES.map((item, i) => (
          <View key={item.title} style={[styles.dot, i === index && styles.dotActive]} />
        ))}
      </View>
      <Button
        label={isLast ? "Continuer" : "Suivant"}
        onPress={() => (isLast ? finish() : setIndex((value) => value + 1))}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  canvas: { backgroundColor: colors.canvas },
  content: { justifyContent: "space-between" },
  hero: { flex: 1, justifyContent: "center", alignItems: "flex-start" },
  title: { ...typography.title, marginTop: spacing.md, marginBottom: spacing.sm },
  body: { ...typography.subtitle, fontSize: 16, lineHeight: 24 },
  dots: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 8,
    marginBottom: spacing.lg,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.border,
  },
  dotActive: { backgroundColor: colors.bluePrimary, width: 20 },
});
