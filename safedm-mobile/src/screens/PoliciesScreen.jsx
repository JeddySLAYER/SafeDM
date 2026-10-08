import React, { useCallback, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
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
  const { completePolicies, needsSetup } = useAuth();
  const [documents, setDocuments] = useState(FALLBACK);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useFocusEffect(
    useCallback(() => {
      let active = true;
      (async () => {
        setLoading(true);
        try {
          const status = await getLegalStatus();
          const pending = new Set(status.pending_slugs || []);
          const visible = (status.documents || []).filter((doc) => pending.has(doc.slug));
          if (active) setDocuments(visible.length ? visible : status.documents || FALLBACK);
        } catch {
          try {
            const docs = await listLegalDocuments();
            if (active && docs?.length) setDocuments(docs);
          } catch {
            if (active) setDocuments(FALLBACK);
          }
        } finally {
          if (active) setLoading(false);
        }
      })();
      return () => {
        active = false;
      };
    }, []),
  );

  async function onAccept() {
    setSaving(true);
    setError("");
    try {
      await acceptLegalDocuments(
        documents.map((doc) => ({ slug: doc.slug, version: doc.version })),
      );
      await completePolicies();
      navigation.reset({
        index: 0,
        routes: [
          needsSetup
            ? { name: "Apps", params: { onboarding: true } }
            : { name: "MainTabs" },
        ],
      });
    } catch {
      setError("Enregistrement impossible. Réessayez quand le téléphone a du réseau.");
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
});
