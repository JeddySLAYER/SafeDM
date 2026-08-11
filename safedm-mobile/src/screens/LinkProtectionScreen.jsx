import React, { useCallback, useState } from "react";
import { AppState, StyleSheet, Text, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import Button from "../components/Button";
import { IconBadge, IconGlyph } from "../components/Icons";
import Screen from "../components/Screen";
import ScreenHeader from "../components/ScreenHeader";
import {
  isDefaultBrowser,
  openDefaultAppsSettings,
  requestDefaultBrowserRole,
} from "../services/notificationBridge";
import { colors, radii } from "../theme/tokens";

/**
 * Explique pourquoi Chrome « mange » les clics, et active SafeDM
 * comme filtre (rôle navigateur) ou via Partager.
 */
export default function LinkProtectionScreen({ navigation }) {
  const [isDefault, setIsDefault] = useState(false);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    setIsDefault(await isDefaultBrowser());
  }, []);

  useFocusEffect(
    useCallback(() => {
      refresh();
      const sub = AppState.addEventListener("change", (state) => {
        if (state === "active") refresh();
      });
      return () => sub.remove();
    }, [refresh]),
  );

  async function activate() {
    setBusy(true);
    try {
      const ok = await requestDefaultBrowserRole();
      await refresh();
      if (!ok) {
        // Rôle indisponible / refusé → écran apps par défaut déjà ouvert côté natif
        await openDefaultAppsSettings();
      }
    } catch {
      await openDefaultAppsSettings();
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen scroll>
      <ScreenHeader
        title="Protection des liens"
        onBack={() => navigation.goBack()}
      />

      <View style={styles.hero}>
        <IconBadge name="globe" size={56} />
        <Text style={styles.title}>Pourquoi ça ne marchait pas ?</Text>
        <Text style={styles.body}>
          Sur Android, Chrome (ou un autre navigateur) est souvent l’app par
          défaut pour les liens. Dans ce cas, SafeDM n’est jamais appelé — le
          lien s’ouvre directement dans le navigateur.
        </Text>
      </View>

      <View
        style={[
          styles.status,
          isDefault ? styles.statusOn : styles.statusOff,
        ]}
      >
        <View
          style={[
            styles.dot,
            { backgroundColor: isDefault ? colors.bluePrimary : colors.textMuted },
          ]}
        />
        <Text style={styles.statusText}>
          {isDefault
            ? "SafeDM est le filtre de liens actif"
            : "Navigateur du téléphone encore prioritaire"}
        </Text>
      </View>

      <Text style={styles.section}>Solution recommandée</Text>
      <Text style={styles.body}>
        Définir SafeDM comme appli qui ouvre les liens. SafeDM analyse d’abord,
        puis ouvre Chrome/Firefox seulement si c’est sûr (jamais de boucle).
      </Text>
      <Button
        label={isDefault ? "Modifier le choix système" : "Activer le filtre SafeDM"}
        onPress={activate}
        loading={busy}
        icon={<IconGlyph name="shield" color={colors.white} size={16} />}
        style={{ marginTop: 12 }}
      />
      <Button
        label="Ouvrir les apps par défaut"
        variant="outline"
        onPress={openDefaultAppsSettings}
        style={{ marginTop: 10 }}
      />

      <Text style={styles.section}>Sans changer le navigateur</Text>
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Partager vers SafeDM</Text>
        <Text style={styles.body}>
          Dans Chrome / WhatsApp : Partager → SafeDM. Le lien est analysé avant
          ouverture.
        </Text>
      </View>
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Depuis SafeDM</Text>
        <Text style={styles.body}>
          Collez une URL sur l’accueil, ou touchez un lien dans un résultat
          d’analyse.
        </Text>
      </View>

      <Button
        label="Tester avec un lien"
        variant="ghost"
        onPress={() =>
          navigation.navigate("LinkGate", { url: "https://example.com" })
        }
        style={{ marginTop: 8 }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { alignItems: "flex-start", marginBottom: 16, gap: 10 },
  title: {
    fontSize: 22,
    fontWeight: "700",
    color: colors.textPrimary,
  },
  body: {
    fontSize: 14,
    lineHeight: 21,
    color: colors.textSecondary,
  },
  status: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 14,
    borderRadius: radii.md,
    marginBottom: 20,
  },
  statusOn: { backgroundColor: colors.blueSoft },
  statusOff: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  dot: { width: 10, height: 10, borderRadius: 5 },
  statusText: { flex: 1, fontWeight: "700", color: colors.textPrimary },
  section: {
    fontSize: 15,
    fontWeight: "700",
    color: colors.textPrimary,
    marginTop: 8,
    marginBottom: 8,
  },
  card: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    padding: 14,
    marginBottom: 10,
    backgroundColor: colors.white,
  },
  cardTitle: {
    fontWeight: "700",
    color: colors.textPrimary,
    marginBottom: 6,
  },
});
