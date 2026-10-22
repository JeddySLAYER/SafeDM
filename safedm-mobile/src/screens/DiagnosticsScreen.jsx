import React, { useCallback, useState } from "react";
import { Platform, StyleSheet, Text, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { API_BASE_URL, APP_VERSION } from "../config";
import Button from "../components/Button";
import Screen from "../components/Screen";
import ScreenHeader from "../components/ScreenHeader";
import {
  getEnabledPackageNames,
  getPermissionState,
  isDefaultBrowser,
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
  const [batteryExempt, setBatteryExempt] = useState(false);
  const [packages, setPackages] = useState([]);
  const [consent, setConsent] = useState(false);
  const [apiOk, setApiOk] = useState(null);
  const [linksOn, setLinksOn] = useState(false);
  const [busy, setBusy] = useState(false);
  // L'arriere-plan n'existe que sur Android : l'exemption de batterie n'a pas
  // d'equivalent ailleurs, on ne compte donc pas un controle fantome.
  const android = Platform.OS === "android";
  const checks = [nls, packages.length > 0, apiOk === true, linksOn];
  const failedChecks = [
    !nls && "Autoriser l’accès aux notifications",
    !packages.length && "Choisir une application à surveiller",
    apiOk === false && "Vérifier la connexion au serveur",
    !linksOn && "Activer la protection des liens",
  ].filter(Boolean);
  if (android) {
    checks.push(batteryExempt);
    if (!batteryExempt) {
      failedChecks.push("Autoriser SafeDM à tourner en arrière-plan");
    }
  }
  const health =
    apiOk == null
      ? "Vérification en cours…"
      : failedChecks.length === 0
        ? "Protection opérationnelle"
        : `${checks.filter(Boolean).length}/${checks.length} contrôles réussis`;

  const refresh = useCallback(async () => {
    setBusy(true);
    try {
      const [perm, pkgs, cloud, links] = await Promise.all([
        getPermissionState(),
        getEnabledPackageNames(),
        getCloudConsent(),
        isDefaultBrowser(),
      ]);
      setNls(perm.notificationAccess);
      setBatteryExempt(perm.batteryExempt);
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
      <View
        accessible
        accessibilityRole="summary"
        accessibilityLabel={`État de la protection : ${health}`}
        style={[styles.summaryCard, failedChecks.length ? styles.summaryWarning : styles.summaryGood]}
      >
        <Text style={styles.summaryTitle}>{health}</Text>
        <Text style={styles.summaryBody}>
          {failedChecks.length
            ? "Quelques réglages limitent la protection. Voici quoi faire :"
            : "Les fonctions essentielles de SafeDM sont activées."}
        </Text>
        {failedChecks.map((action) => (
          <Text key={action} style={styles.action}>
            • {action}
          </Text>
        ))}
      </View>
      <View style={styles.card}>
        <Row label="Version" value={APP_VERSION} />
        <Row label="Accès notifications" value={nls ? "Actif" : "Inactif"} ok={nls} />
        <Row
          label="Apps surveillées"
          value={packages.length ? String(packages.length) : "Aucune"}
          ok={packages.length > 0}
        />
        {android ? (
          <Row
            label="Arrière-plan"
            value={
              batteryExempt ? "Autorisé par Android" : "Optimisé par le système"
            }
            ok={batteryExempt}
          />
        ) : null}
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
      {failedChecks.includes("Autoriser l’accès aux notifications") ? (
        <Button
          label="Ouvrir les permissions"
          onPress={() => navigation.navigate("Permissions")}
          style={{ marginTop: 16 }}
        />
      ) : null}
      {failedChecks.includes("Choisir une application à surveiller") ? (
        <Button
          label="Configurer les applications"
          onPress={() => navigation.navigate("Apps")}
          variant="outline"
          style={{ marginTop: 10 }}
        />
      ) : null}
      {failedChecks.includes("Activer la protection des liens") ? (
        <Button
          label="Configurer les liens"
          onPress={() => navigation.navigate("LinkProtection")}
          variant="outline"
          style={{ marginTop: 10 }}
        />
      ) : null}
      {failedChecks.includes("Autoriser SafeDM à tourner en arrière-plan") ? (
        <Button
          label="Configurer l'arrière-plan"
          onPress={() => navigation.navigate("BatteryOptimization")}
          variant="outline"
          style={{ marginTop: 10 }}
        />
      ) : null}
      <Button
        label="Actualiser"
        onPress={refresh}
        loading={busy}
        variant="ghost"
        style={{ marginTop: 10 }}
      />
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
  summaryCard: {
    borderRadius: 16,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 1,
  },
  summaryGood: {
    backgroundColor: "#ECFDF3",
    borderColor: "#ABEFC6",
  },
  summaryWarning: {
    backgroundColor: "#FFFAEB",
    borderColor: "#FEDF89",
  },
  summaryTitle: { ...typography.label, marginBottom: 4 },
  summaryBody: { ...typography.caption, marginBottom: 6 },
  action: { ...typography.caption, color: colors.textPrimary, marginTop: 2 },
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
