import React, { useCallback, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { API_BASE_URL, APP_VERSION, FINGERPRINT_PUBLIC_KEY, MODEL_MANIFEST_PUBLIC_KEY } from "../config";
import Button from "../components/Button";
import Screen from "../components/Screen";
import ScreenHeader from "../components/ScreenHeader";
import { isFingerprintCryptoConfigured } from "../services/fingerprintEnvelope";
import {
  getEnabledPackageNames,
  isNotificationAccessEnabled,
} from "../services/notificationBridge";
import { getCloudConsent } from "../utils/storage";
import { colors, spacing, typography } from "../theme/tokens";

function Row({ label, value, ok }) {
  return (
    <View style={styles.row}>
      <Text style={styles.label}>{label}</Text>
      <Text style={[styles.value, ok === false && styles.bad, ok === true && styles.good]}>
        {value}
      </Text>
    </View>
  );
}

export default function DiagnosticsScreen({ navigation }) {
  const [nls, setNls] = useState(false);
  const [packages, setPackages] = useState([]);
  const [consent, setConsent] = useState(false);
  const [apiOk, setApiOk] = useState(null);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    setBusy(true);
    try {
      const [access, pkgs, cloud] = await Promise.all([
        isNotificationAccessEnabled(),
        getEnabledPackageNames(),
        getCloudConsent(),
      ]);
      setNls(access);
      setPackages(pkgs || []);
      setConsent(cloud);
      try {
        const res = await fetch(`${API_BASE_URL.replace(/\/+$/, "")}/health`, {
          method: "GET",
        });
        setApiOk(res.ok);
      } catch {
        setApiOk(false);
      }
    } finally {
      setBusy(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh]),
  );

  return (
    <Screen scroll style={styles.canvas}>
      <ScreenHeader title="Diagnostic" onBack={() => navigation.goBack()} />
      <Text style={styles.intro}>
        État de la protection locale — utile pour la démo et le support.
      </Text>
      <View style={styles.card}>
        <Row label="Version" value={APP_VERSION} />
        <Row label="Accès notifications" value={nls ? "Actif" : "Inactif"} ok={nls} />
        <Row
          label="Apps surveillées"
          value={packages.length ? String(packages.length) : "Aucune"}
          ok={packages.length > 0}
        />
        <Row label="Analyse cloud" value={consent ? "Opt-in" : "Locale seule"} />
        <Row
          label="API /health"
          value={apiOk == null ? "…" : apiOk ? "OK" : "Hors ligne"}
          ok={apiOk}
        />
        <Row
          label="Fingerprint crypto"
          value={isFingerprintCryptoConfigured() ? "Configurée" : "Clé absente"}
          ok={isFingerprintCryptoConfigured()}
        />
        <Row
          label="OTA modèle"
          value={MODEL_MANIFEST_PUBLIC_KEY ? "Clé présente" : "Désactivée"}
        />
        <Row label="API base" value={API_BASE_URL} />
        {!FINGERPRINT_PUBLIC_KEY ? (
          <Text style={styles.note}>
            Sans FINGERPRINT_PUBLIC_KEY, l’envoi chiffré de vecteurs / fingerprints
            reste indisponible (soft-fail).
          </Text>
        ) : null}
      </View>
      <Button label="Actualiser" onPress={refresh} loading={busy} style={{ marginTop: 16 }} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  canvas: { backgroundColor: colors.canvas },
  intro: { ...typography.caption, marginBottom: spacing.md },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: spacing.md,
  },
  row: {
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.borderSubtle,
  },
  label: { ...typography.caption, marginBottom: 4 },
  value: { ...typography.label, fontSize: 14 },
  good: { color: colors.success },
  bad: { color: colors.danger },
  note: { ...typography.caption, marginTop: spacing.md, color: colors.textSecondary },
});
