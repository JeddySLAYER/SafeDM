import React, { useCallback, useEffect, useMemo, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import Button from "../components/Button";
import { IconGlyph } from "../components/Icons";
import Screen from "../components/Screen";
import SettingRow from "../components/SettingRow";
import { useAuth } from "../context/AuthContext";
import {
  clearAllAlerts,
  getAlertsRetentionSummary,
} from "../services/alertsStore";
import {
  getCloudConsent,
  getHideSensitivePreview,
  setCloudConsent,
  setHideSensitivePreview,
} from "../utils/storage";
import { listLegalDocuments } from "../api/legal";
import { alertDialog, confirmDialog } from "../services/appDialog";
import { showPolicyConsent } from "../services/policyConsent";
import { APP_VERSION } from "../config";
import { colors, radii } from "../theme/tokens";

export default function SettingsScreen({ navigation }) {
  const { user, logout } = useAuth();
  const initials = useMemo(() => {
    const name = user?.username || "?";
    return name.slice(0, 2).toUpperCase();
  }, [user]);
  const retention = useMemo(() => getAlertsRetentionSummary(), []);

  const [cloudConsent, setConsent] = useState(false);
  const [consentLoaded, setConsentLoaded] = useState(false);
  const [hidePreview, setHidePreview] = useState(false);

  useEffect(() => {
    Promise.all([getCloudConsent(), getHideSensitivePreview()]).then(
      ([consent, hide]) => {
        setConsent(consent);
        setHidePreview(hide);
        setConsentLoaded(true);
      },
    );
  }, []);

  const toggleCloudConsent = useCallback(async (next) => {
    if (!next) {
      setConsent(false);
      await setCloudConsent(false);
      return;
    }
    let privacy = null;
    try {
      const docs = await listLegalDocuments();
      privacy = (docs || []).find((doc) => doc.slug === "privacy");
    } catch {
      privacy = null;
    }
    const accepted = await showPolicyConsent({
      title: privacy?.title || "Politique de confidentialité",
      body:
        privacy?.body ||
        "Le texte des messages pourra quitter le téléphone pour être vérifié. Sans accord, l'analyse reste sur l'appareil.",
      confirmLabel: "J'accepte",
      cancelLabel: "Rester sur le téléphone",
    });
    if (!accepted) {
      setConsent(false);
      return;
    }
    setConsent(true);
    await setCloudConsent(true);
  }, []);

  const toggleHidePreview = useCallback((next) => {
    setHidePreview(next);
    setHideSensitivePreview(next);
  }, []);

  const onClearAlerts = useCallback(async () => {
    const ok = await confirmDialog({
      title: "Effacer l'historique",
      message: "Supprimer toutes les alertes enregistrées sur cet appareil ?",
      confirmLabel: "Tout effacer",
      cancelLabel: "Annuler",
      destructive: true,
    });
    if (!ok) return;
    await clearAllAlerts();
    await alertDialog({
      title: "Historique effacé",
      message: "Les alertes locales ont été supprimées.",
    });
  }, []);

  return (
    <Screen scroll>
      <Text style={styles.title}>Paramètres</Text>

      <View style={styles.profileCard}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{initials}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.name}>{user?.username ?? "Compte"}</Text>
          <Text style={styles.email}>
            {user?.is_admin ? "Compte administrateur" : "Compte utilisateur"}
          </Text>
        </View>
      </View>

      <Text style={styles.section}>Analyse</Text>
      <SettingRow
        icon="globe"
        title="Vérification distante"
        subtitle={
          cloudConsent
            ? "Le texte peut quitter le téléphone"
            : "Analyse uniquement sur cet appareil"
        }
        switchValue={consentLoaded ? cloudConsent : false}
        onSwitchChange={toggleCloudConsent}
      />

      <Text style={styles.section}>Confidentialité</Text>
      <SettingRow
        icon="doc"
        title="Masquer les aperçus"
        subtitle="Cache le texte des alertes dans les listes et le détail"
        switchValue={consentLoaded ? hidePreview : false}
        onSwitchChange={toggleHidePreview}
      />
      <SettingRow
        icon="flag"
        title="Tout effacer l’historique"
        subtitle={`Rétention : ${retention.maxAgeDays} jours · max ${retention.maxAlerts} alertes`}
        onPress={onClearAlerts}
        showChevron
      />
      <Text style={styles.privacyNote}>
        Les textes d’alertes sont stockés localement sur l’appareil (pas un
        coffre chiffré). Effacez l’historique pour les supprimer.
      </Text>

      <Text style={styles.section}>Surveillance</Text>
      <SettingRow
        icon="whatsapp"
        title="Applications surveillées"
        onPress={() => navigation.navigate("Apps")}
        showChevron
      />
      <SettingRow
        icon="bell"
        title="Accès notifications"
        onPress={() => navigation.navigate("Permissions")}
        showChevron
      />
      <SettingRow
        icon="globe"
        title="Protection des liens"
        valueText="Configurer"
        onPress={() => navigation.navigate("LinkProtection")}
        showChevron
      />

      <Text style={styles.section}>Aide</Text>
      <SettingRow
        icon="guide"
        title="Guide de bonnes pratiques"
        onPress={() => navigation.navigate("Guide")}
        showChevron
      />
      <SettingRow
        icon="community"
        title="Menaces communautaires"
        onPress={() => navigation.navigate("Community")}
        showChevron
      />
      <SettingRow
        icon="flag"
        title="Signaler un message"
        onPress={() => navigation.navigate("DirectReport")}
        showChevron
      />

      <Text style={styles.section}>Système</Text>
      <SettingRow
        icon="shield"
        title="Diagnostic"
        subtitle="État de la protection sur cet appareil"
        onPress={() => navigation.navigate("Diagnostics")}
        showChevron
      />
      <SettingRow
        icon="bell"
        title="Batterie / arrière-plan"
        onPress={() => navigation.navigate("BatteryOptimization")}
        showChevron
      />

      <Text style={styles.section}>À propos</Text>
      <SettingRow
        icon="doc"
        title="Version de l’application"
        valueText={APP_VERSION}
      />
      <SettingRow icon="globe" title="Langue" valueText="Français" />

      <Button
        label="Se déconnecter"
        variant="dark"
        onPress={logout}
        icon={<IconGlyph name="logout" color={colors.white} size={16} />}
        style={{ marginTop: 20 }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: {
    fontSize: 28,
    fontWeight: "700",
    color: colors.textPrimary,
    marginBottom: 20,
  },
  profileCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    padding: 14,
    marginBottom: 22,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.bluePrimary,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { color: colors.white, fontWeight: "700", fontSize: 16 },
  name: { fontSize: 16, fontWeight: "700", color: colors.textPrimary },
  email: { fontSize: 13, color: colors.textSecondary, marginTop: 2 },
  section: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.textSecondary,
    marginBottom: 10,
    marginTop: 8,
  },
  privacyNote: {
    fontSize: 12,
    color: colors.textMuted,
    lineHeight: 18,
    marginBottom: 8,
    marginTop: -4,
  },
});
