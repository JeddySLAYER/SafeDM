import React, { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { ApiError } from "../api/client";
import BrandMark from "../components/BrandMark";
import Button from "../components/Button";
import Screen from "../components/Screen";
import TextField from "../components/TextField";
import { useAuth } from "../context/AuthContext";
import { colors } from "../theme/tokens";

export default function LoginScreen({ navigation }) {
  const { login } = useAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit() {
    setError("");
    if (username.trim().length < 3 || password.length < 1) {
      setError("Identifiant et mot de passe requis.");
      return;
    }
    setLoading(true);
    try {
      await login(username.trim(), password);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Connexion impossible.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Screen scroll contentStyle={styles.content}>
      <BrandMark size={40} centered />
      <Text style={styles.title}>Se connecter</Text>
      <Text style={styles.subtitle}>Accédez à votre espace de protection</Text>

      <TextField
        label="Identifiant"
        leftIcon="user"
        value={username}
        onChangeText={setUsername}
        placeholder="Votre Identifiant"
        autoComplete="username"
      />
      <TextField
        label="Mot de passe"
        leftIcon="lock"
        value={password}
        onChangeText={setPassword}
        placeholder="Entrez votre mot de passe"
        secureTextEntry
        autoComplete="password"
      />

      <Pressable style={styles.forgotWrap} onPress={() => {}}>
        <Text style={styles.forgot}>Mot de passe oublié ?</Text>
      </Pressable>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <Button label="Se connecter" onPress={onSubmit} loading={loading} />

      <View style={styles.dividerRow}>
        <View style={styles.line} />
        <Text style={styles.or}>ou</Text>
        <View style={styles.line} />
      </View>

      <Pressable onPress={() => navigation.navigate("Register")}>
        <Text style={styles.footer}>
          Pas encore de compte ?{" "}
          <Text style={styles.link}>Créer un compte</Text>
        </Text>
      </Pressable>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingTop: 28 },
  title: {
    marginTop: 36,
    fontSize: 28,
    fontWeight: "700",
    color: colors.textPrimary,
    textAlign: "center",
  },
  subtitle: {
    marginTop: 8,
    marginBottom: 28,
    fontSize: 15,
    color: colors.textSecondary,
    textAlign: "center",
  },
  forgotWrap: { alignSelf: "flex-end", marginBottom: 20, marginTop: -4 },
  forgot: { color: colors.bluePrimary, fontWeight: "600", fontSize: 13 },
  error: { color: "#F04438", marginBottom: 12 },
  dividerRow: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: 22,
    gap: 12,
  },
  line: { flex: 1, height: 1, backgroundColor: colors.border },
  or: { color: colors.textMuted, fontSize: 13 },
  footer: { textAlign: "center", color: colors.textSecondary, fontSize: 14 },
  link: { color: colors.bluePrimary, fontWeight: "700" },
});
