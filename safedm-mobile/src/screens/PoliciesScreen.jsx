import React, { useCallback, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { ApiError } from "../api/client";
import { acceptLegalDocuments, getLegalStatus, listLegalDocuments } from "../api/legal";
import Button from "../components/Button";
import Screen from "../components/Screen";
import { useAuth } from "../context/AuthContext";
import { colors, radii } from "../theme/tokens";

const FALLBACK = [
  {
    slug: "privacy",
    title: "Politique de confidentialité",
    version: 1,
    body: "SafeDM analyse d'abord sur le téléphone. Le texte d'un message ne part que si vous l'acceptez. Vous pouvez retirer cet accord dans Paramètres.",
  },
  {
    slug: "terms",
    title: "Conditions d'utilisation",
    version: 1,
    body: "SafeDM aide à repérer des messages suspects. Ce n'est pas une garantie. Vous choisissez les applications surveillées et vous pouvez arrêter à tout moment.",
  },
];

export default function PoliciesScreen({ navigation }) {
  const { completePolicies, needsSetup, isAuthenticated } = useAuth();
  const [documents, setDocuments] = useState(FALLBACK);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [expiredSession, setExpiredSession] = useState(false);

  const loadDocuments = useCallback(async () => {
    try {
      const status = await getLegalStatus();
      const pending = new Set(status.pending_slugs || []);
      const visible = (status.documents || []).filter((doc) => pending.has(doc.slug));
      return visible.length ? visible : status.documents || FALLBACK;
    } catch {
      try {
        const docs = await listLegalDocuments();
        if (docs?.length) return docs;
      } catch {
        /* hors ligne : on garde le texte de secours */
      }
      return FALLBACK;
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      (async () => {
        setLoading(true);
        const docs = await loadDocuments();
        if (active) {
          setDocuments(docs);
          setLoading(false);
        }
      })();
      return () => {
        active = false;
      };
    }, [loadDocuments]),
  );

  async function onAccept() {
    setSaving(true);
    setError("");
    setExpiredSession(false);
    try {
      // Sans compte, l'API /legal/accept renvoie 401 : l'acceptation est
      // alors enregistree sur l'appareil, et rejouee au serveur des qu'un
      // compte existe.
      if (isAuthenticated) {
        await acceptLegalDocuments(
          documents.map((doc) => ({ slug: doc.slug, version: doc.version })),
        );
      }
      await completePolicies(documents);
      navigation.reset({
        index: 0,
        routes: [
          needsSetup
            ? { name: "Permissions", params: { onboarding: true } }
            : { name: "MainTabs" },
        ],
      });
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.status === 401) {
          setExpiredSession(true);
          setError(
            "Votre session a expiré. Reconnectez-vous pour enregistrer votre accord.",
          );
          return;
        }
        if (err.status === 409) {
          setError(
            "La politique a été mise à jour. Relisez-la puis acceptez-la à nouveau.",
          );
          const docs = await loadDocuments();
          setDocuments(docs);
          return;
        }
        setError(`Enregistrement impossible : ${err.message}`);
        return;
      }
      setError(
        "Enregistrement impossible. Réessayez quand le téléphone a du réseau.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <Screen style={styles.canvas} contentStyle={styles.content}>
      <Text style={styles.title}>Avant de continuer</Text>
      <Text style={styles.lead}>
        Lisez ces règles. Elles s'appliquent à votre compte, y compris après la connexion.
      </Text>
      {loading ? (
        <ActivityIndicator color={colors.bluePrimary} style={{ marginTop: 24 }} />
      ) : (
        <ScrollView style={styles.scroll} contentContainerStyle={{ paddingBottom: 12 }}>
          {documents.map((doc) => (
            <View key={doc.slug} style={styles.card}>
              <Text style={styles.cardTitle}>{doc.title}</Text>
              <Text style={styles.cardBody}>{doc.body}</Text>
            </View>
          ))}
        </ScrollView>
      )}
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {expiredSession ? (
        <View style={styles.authBox}>
          <Text style={styles.authText}>
            Votre session a expiré. Reconnectez-vous pour enregistrer votre accord
            côté SafeDM.
          </Text>
          <Button
            label="Se connecter"
            variant="outline"
            onPress={() => navigation.navigate("Login")}
            style={{ marginTop: 10 }}
          />
          <Button
            label="Créer un compte"
            variant="ghost"
            onPress={() => navigation.navigate("Register")}
            style={{ marginTop: 6 }}
          />
        </View>
      ) : null}
      {!isAuthenticated && !expiredSession ? (
        <Text style={styles.note}>
          Sans compte, votre accord est enregistré sur ce téléphone uniquement. Il
          sera transmis à SafeDM si vous créez un compte plus tard.
        </Text>
      ) : null}
      <Button
        label="J'accepte"
        onPress={onAccept}
        loading={saving}
        disabled={loading}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  canvas: { backgroundColor: colors.canvas },
  content: { flex: 1 },
  title: { fontSize: 26, fontWeight: "700", color: colors.textPrimary },
  lead: { marginTop: 8, marginBottom: 12, color: colors.textSecondary, lineHeight: 20 },
  scroll: { flex: 1 },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    padding: 14,
    marginBottom: 10,
  },
  cardTitle: { fontWeight: "700", color: colors.textPrimary, marginBottom: 6 },
  cardBody: { color: colors.textSecondary, lineHeight: 21, fontSize: 14 },
  error: { color: colors.danger, marginBottom: 8 },
  authBox: {
    borderRadius: radii.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
    marginBottom: 10,
  },
  authText: {
    color: colors.textSecondary,
    fontSize: 13,
    lineHeight: 19,
  },
  note: {
    color: colors.textSecondary,
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 10,
  },
});
