import React, { useCallback, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { APP_VERSION } from "../config";
import Button from "../components/Button";
import Screen from "../components/Screen";
import ScreenHeader from "../components/ScreenHeader";
import {
  getEnabledPackageNames,
  isDefaultBrowser,
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
  const [linksOn, setLinksOn] = useState(false);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    setBusy(true);
    try {
      const [access, pkgs, cloud, links] = await Promise.all([
        isNotificationAccessEnabled(),
        getEnabledPackageNames(),
        getCloudConsent(),
        isDefaultBrowser(),
      ]);
      setNls(access);
      setPackages(pkgs || []);
      setConsent(cloud);
      setLinksOn(Boolean(links));
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
        Ce qui est actif sur cet appareil.
      </Text>
      <View style={styles.card}>
        <Row label="Version" value={APP_VERSION} />
        <Row label="Accès notifications" value={nls ? "Actif" : "Inactif"} ok={nls} />
        <Row
          label="Apps surveillées"
          value={packages.length ? String(packages.length) : "Aucune"}
          ok={packages.length > 0}
        />
        <Row
          label="Analyse"
          value={consent ? "Aussi à distance" : "Sur le téléphone"}
        />
        <Row
          label="Vérification distante"
          value={apiOk == null ? "…" : apiOk ? "Disponible" : "Indisponible"}
          ok={apiOk}
        />
        <Row
          label="Liens"
          value={linksOn ? "Vérifiés par SafeDM" : "Ouverts par le navigateur"}
          ok={linksOn}
        />
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
