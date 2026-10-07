import React, { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import BrandMark from "../components/BrandMark";
import Button from "../components/Button";
import Screen from "../components/Screen";
import { useAuth } from "../context/AuthContext";
import { colors, spacing, typography } from "../theme/tokens";

const SLIDES = [
  {
    title: "Protégez vos messages",
    body: "SafeDM lit localement les notifications WhatsApp, SMS et e-mails pour repérer les messages suspects — sans les bloquer ni les modifier.",
  },
  {
    title: "D’abord sur l’appareil",
    body: "L’analyse locale tourne sur votre téléphone. L’enrichissement cloud (serveur SafeDM) n’est activé que si vous l’autorisez dans Paramètres.",
  },
  {
    title: "Vous gardez le contrôle",
    body: "Choisissez les apps à surveiller. Les alertes restent 7 jours sur l’appareil (historique local). Un signalement volontaire envoie le contenu au serveur.",
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
      <BrandMark size={40} />
      <View style={styles.hero}>
        <Text style={styles.title}>{slide.title}</Text>
        <Text style={styles.body}>{slide.body}</Text>
      </View>
      <View style={styles.dots}>
        {SLIDES.map((item, i) => (
          <View
            key={item.title}
            style={[styles.dot, i === index && styles.dotActive]}
          />
        ))}
      </View>
      <View style={styles.footer}>
        <Button
          label={isLast ? "Commencer" : "Suivant"}
          onPress={() => (isLast ? finish() : setIndex((v) => v + 1))}
        />
        <Button label="Passer" variant="ghost" onPress={finish} style={styles.ghost} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  canvas: { backgroundColor: colors.canvas },
  content: { justifyContent: "space-between" },
  hero: { flex: 1, justifyContent: "center", paddingVertical: spacing.lg },
  title: { ...typography.title, marginBottom: spacing.md },
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
  footer: { gap: 4 },
  ghost: { marginTop: 4 },
});
