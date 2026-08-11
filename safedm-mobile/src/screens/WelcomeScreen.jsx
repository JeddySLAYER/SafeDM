import React, { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import BrandMark from "../components/BrandMark";
import Button from "../components/Button";
import Screen from "../components/Screen";
import { useAuth } from "../context/AuthContext";
import { colors } from "../theme/tokens";

const SLIDES = [
  {
    title: "Protégez vos messages",
    body: "SafeDM détecte les messages suspects WhatsApp, SMS et e-mails avant qu’ils ne deviennent un risque.",
  },
  {
    title: "Analyse côté serveur",
    body: "Gemini et VirusTotal restent sur le backend. Aucune clé API n’est stockée sur votre téléphone.",
  },
  {
    title: "Vous gardez le contrôle",
    body: "Choisissez les apps à surveiller. Les messages ne sont stockés que si vous les signalez.",
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
    <Screen contentStyle={styles.content}>
      <BrandMark size={48} />
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
      <Button label={isLast ? "Commencer" : "Suivant"} onPress={() => (isLast ? finish() : setIndex((v) => v + 1))} />
      <Button label="Passer" variant="ghost" onPress={finish} style={styles.ghost} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { justifyContent: "space-between" },
  hero: { flex: 1, justifyContent: "center", paddingVertical: 24 },
  title: {
    fontSize: 28,
    fontWeight: "700",
    color: colors.textPrimary,
    marginBottom: 12,
  },
  body: { fontSize: 16, lineHeight: 24, color: colors.textSecondary },
  dots: { flexDirection: "row", gap: 8, marginBottom: 20 },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.border,
  },
  dotActive: { backgroundColor: colors.bluePrimary, width: 20 },
  ghost: { marginTop: 4 },
});
