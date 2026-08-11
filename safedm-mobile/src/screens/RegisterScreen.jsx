import React, { useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { ApiError } from "../api/client";
import BrandMark from "../components/BrandMark";
import Button from "../components/Button";
import { IconGlyph } from "../components/Icons";
import Screen from "../components/Screen";
import TextField from "../components/TextField";
import { useAuth } from "../context/AuthContext";
import { colors } from "../theme/tokens";

function strengthOf(password) {
  let score = 0;
  if (password.length >= 8) score += 1;
  if (password.length >= 12 || /[A-Z]/.test(password)) score += 1;
  if (/[0-9]/.test(password) || /[^a-zA-Z0-9]/.test(password)) score += 1;
  return Math.min(score, 3);
}

export default function RegisterScreen({ navigation }) {
  const { register } = useAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [accepted, setAccepted] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const strength = useMemo(() => strengthOf(password), [password]);

  async function onSubmit() {
    setError("");
    const name = username.trim();
    if (!/^[a-zA-Z0-9_]{3,64}$/.test(name)) {
      setError("Username : 3–64 caractères (lettres, chiffres, _).");
      return;
    }
    if (password.length < 8) {
      setError("Mot de passe : 8 caractères minimum.");
      return;
    }
    if (password !== confirm) {
      setError("Les mots de passe ne correspondent pas.");
      return;
    }
    if (!accepted) {
      setError("Acceptez les conditions pour continuer.");
      return;
    }
    setLoading(true);
    try {
      await register(name, password);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Inscription impossible.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Screen scroll>
      <BrandMark size={48} centered />
      <Text style={styles.title}>Créer mon compte</Text>
      <Text style={styles.subtitle}>Protégez vos conversations dès maintenant</Text>

      <TextField
        label="Identifiant"
        leftIcon="user"
        value={username}
        onChangeText={setUsername}
        placeholder="Choisir un identifiant"
      />
      <TextField
        label="Mot de passe"
        leftIcon="lock"
        value={password}
        onChangeText={setPassword}
        placeholder="Min. 8 caractères"
        secureTextEntry
      />

      <View style={styles.strengthRow}>
        {[0, 1, 2].map((i) => (
          <View
            key={i}
            style={[
              styles.strengthBar,
              i < strength ? styles.strengthOn : styles.strengthOff,
            ]}
          />
        ))}
      </View>
      <Text style={styles.strengthHint}>
        {password.length === 0
          ? "8 caractères minimum"
          : password.length < 8
            ? "Trop court"
            : "8 caractères minimum — bonne longueur"}
      </Text>

      <TextField
        label="Confirmer le mot de passe"
        leftIcon="lock"
        value={confirm}
        onChangeText={setConfirm}
        placeholder="Confirmez votre mot de passe"
        secureTextEntry
      />

      <Pressable style={styles.checkRow} onPress={() => setAccepted((v) => !v)}>
        <View style={[styles.checkbox, accepted && styles.checkboxOn]}>
          {accepted ? (
            <IconGlyph name="check" color={colors.white} size={14} strokeWidth={3} />
          ) : null}
        </View>
        <Text style={styles.checkLabel}>
          J’accepte les conditions d’utilisation et la politique de confidentialité
        </Text>
      </Pressable>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <Button label="Créer mon compte" onPress={onSubmit} loading={loading} />

      <Pressable onPress={() => navigation.navigate("Login")} style={styles.footerWrap}>
        <Text style={styles.footer}>
          Vous avez déjà un compte ?{" "}
          <Text style={styles.link}>Se connecter</Text>
        </Text>
      </Pressable>
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: {
    fontSize: 28,
    fontWeight: "700",
    color: colors.textPrimary,
    marginTop: 20,
  },
  subtitle: {
    fontSize: 15,
    color: colors.textSecondary,
    marginTop: 8,
    marginBottom: 24,
  },
  strengthRow: { flexDirection: "row", gap: 6, marginTop: -4 },
  strengthBar: { flex: 1, height: 4, borderRadius: 2 },
  strengthOn: { backgroundColor: colors.bluePrimary },
  strengthOff: { backgroundColor: colors.border },
  strengthHint: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 8,
    marginBottom: 12,
  },
  checkRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    marginBottom: 20,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 1,
  },
  checkboxOn: {
    backgroundColor: colors.bluePrimary,
    borderColor: colors.bluePrimary,
  },
  checkLabel: { flex: 1, fontSize: 13, lineHeight: 18, color: colors.textSecondary },
  error: { color: "#F04438", marginBottom: 12 },
  footerWrap: { marginTop: 20 },
  footer: { textAlign: "center", color: colors.textSecondary, fontSize: 14 },
  link: { color: colors.bluePrimary, fontWeight: "700" },
});
