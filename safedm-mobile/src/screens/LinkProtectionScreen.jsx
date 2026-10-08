import React, { useCallback, useState } from "react";
import { AppState, StyleSheet, Text, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import Button from "../components/Button";
import { IconBadge, IconGlyph } from "../components/Icons";
import Screen from "../components/Screen";
import ScreenHeader from "../components/ScreenHeader";
import SetupSteps from "../components/SetupSteps";
import { useAuth } from "../context/AuthContext";
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
export default function LinkProtectionScreen({ navigation, route }) {
  const onboarding = route?.params?.onboarding === true;
  const { completeSetup } = useAuth();
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
      await requestDefaultBrowserRole();
      await refresh();
    } catch {
      await openDefaultAppsSettings();
    } finally {
      setBusy(false);
    }
  }

  async function finishOnboarding() {
    await completeSetup();
    navigation.reset({ index: 0, routes: [{ name: "MainTabs" }] });
  }

  return (
    <Screen scroll style={{ backgroundColor: colors.canvas || "#F2F4F7" }}>
      {onboarding ? <SetupSteps step={3} /> : null}
      <ScreenHeader
        title="Protection des liens"
        onBack={
          onboarding
            ? undefined
            : () => navigation.goBack()
        }
      />

      <View style={styles.hero}>
        <IconBadge name="globe" size={56} />
        <Text style={styles.title}>
          {isDefault
            ? "Les liens passent par SafeDM"
            : "Vérifier un lien avant de l'ouvrir"}
        </Text>
        <Text style={styles.body}>
          {isDefault
            ? "Quand vous touchez un lien, SafeDM le contrôle d'abord, puis ouvre le navigateur s'il n'y a pas de risque."
            : "Aujourd'hui, un lien touché dans une autre application s'ouvre souvent directement dans le navigateur. Vous pouvez demander à Android de le montrer d'abord à SafeDM."}
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
            ? "SafeDM vérifie les liens"
            : "Le navigateur ouvre encore les liens"}
        </Text>
      </View>

      <Text style={styles.section}>
        {isDefault ? "Vous pouvez changer d'avis" : "Étape recommandée"}
      </Text>
      <Text style={styles.body}>
        {isDefault
          ? "Pour revenir au navigateur, modifiez le choix dans les réglages Android."
          : "Choisissez SafeDM quand Android demande quelle application ouvre les liens. Sinon, collez le lien sur l'accueil ou partagez-le vers SafeDM."}
      </Text>
      <Button
        label={isDefault ? "Modifier le choix" : "Vérifier les liens avant ouverture"}
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

      {onboarding ? (
        <Button
          label="Terminer et ouvrir SafeDM"
          onPress={finishOnboarding}
          style={{ marginTop: 20 }}
        />
      ) : null}
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
