import React from "react";
import { StyleSheet, Text, View } from "react-native";
import Button from "./Button";
import { IconBadge } from "./Icons";
import { colors, radii } from "../theme/tokens";

/**
 * Invite a se connecter, affichee la ou une session est necessaire.
 *
 * Avant, ces ecrans montraient « votre session a expire » : un cul-de-sac,
 * sans action possible depuis le lieu meme ou l'utilisateur se trouve. La
 * regle est simple — si une action exige un compte, on propose de creer un
 * compte la ou l'action est demandee.
 *
 * `prefer` decide de l'action mise en avant : un visiteur qui n'a jamais eu de
 * compte doit trouver « Creer un compte » en premier, pas « Se connecter ».
 */
export default function AuthPrompt({
  navigation,
  icon = "user",
  title,
  body,
  prefer = "login",
  primaryLabel,
  secondaryLabel,
  onPrimary,
  onSecondary,
  note,
  children,
}) {
  const registerFirst = prefer === "register";
  const loginRoute = "Login";
  const registerRoute = "Register";

  const primary = primaryLabel ?? (registerFirst ? "Créer un compte" : "Se connecter");
  const secondary =
    secondaryLabel ?? (registerFirst ? "J'ai déjà un compte" : "Créer un compte");

  function handlePrimary() {
    if (onPrimary) {
      onPrimary();
      return;
    }
    navigation?.navigate?.(registerFirst ? registerRoute : loginRoute);
  }

  function handleSecondary() {
    if (onSecondary) {
      onSecondary();
      return;
    }
    navigation?.navigate?.(registerFirst ? loginRoute : registerRoute);
  }

  return (
    <View style={styles.card}>
      <IconBadge name={icon} size={52} />
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.body}>{body}</Text>

      <Button label={primary} onPress={handlePrimary} style={{ marginTop: 18 }} />
      <Button
        label={secondary}
        variant="outline"
        onPress={handleSecondary}
        style={{ marginTop: 10 }}
      />

      {children}

      {note ? <Text style={styles.note}>{note}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.lg,
    padding: 20,
    alignItems: "center",
  },
  title: {
    fontSize: 19,
    fontWeight: "700",
    color: colors.textPrimary,
    textAlign: "center",
    marginTop: 12,
  },
  body: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: "center",
    marginTop: 8,
    lineHeight: 21,
  },
  note: {
    fontSize: 12,
    color: colors.textMuted,
    textAlign: "center",
    lineHeight: 18,
    marginTop: 14,
  },
});
