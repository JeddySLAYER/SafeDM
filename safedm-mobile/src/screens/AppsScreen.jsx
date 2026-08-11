import React, { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { ApiError } from "../api/client";
import * as usersApi from "../api/users";
import Button from "../components/Button";
import { IconGlyph } from "../components/Icons";
import Screen from "../components/Screen";
import SettingRow from "../components/SettingRow";
import {
  listInstalledApps,
  syncMonitoredPackages,
} from "../services/notificationBridge";
import { colors, monitoredPackages, radii } from "../theme/tokens";

const RECOMMENDED = [
  {
    key: "whatsapp",
    name: "WhatsApp",
    package_name: monitoredPackages.WhatsApp[0],
    icon: "whatsapp",
  },
  {
    key: "sms",
    name: "SMS",
    package_name: monitoredPackages.SMS[0],
    icon: "sms",
  },
  {
    key: "email",
    name: "Email",
    package_name: monitoredPackages.Email[0],
    icon: "email",
  },
];

function iconFor(name, packageName = "") {
  const n = (name || "").toLowerCase();
  const p = (packageName || "").toLowerCase();
  if (n.includes("whatsapp") || p.includes("whatsapp")) return "whatsapp";
  if (
    n.includes("sms") ||
    n.includes("message") ||
    p.includes("messaging") ||
    p.includes("mms")
  ) {
    return "sms";
  }
  if (
    n.includes("mail") ||
    n.includes("gmail") ||
    n.includes("outlook") ||
    p.includes("gm") ||
    p.includes("outlook") ||
    p.includes("mail")
  ) {
    return "email";
  }
  return "bell";
}

export default function AppsScreen({ navigation, route }) {
  const onboarding = route?.params?.onboarding === true;
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [customPackage, setCustomPackage] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [catalog, prefs, installed] = await Promise.all([
        usersApi.listApplications().catch(() => []),
        usersApi.getMonitoring().catch(() => []),
        listInstalledApps(),
      ]);

      const enabledByPackage = new Map();
      const idByPackage = new Map();
      (prefs || []).forEach((p) => {
        const pkg = p.application?.package_name;
        if (!pkg) return;
        enabledByPackage.set(pkg, Boolean(p.enabled));
        idByPackage.set(pkg, p.application_id);
      });

      const byPackage = new Map();

      // Catalogue seed / déjà connus côté API
      (catalog || []).forEach((app) => {
        byPackage.set(app.package_name, {
          application_id: app.id,
          name: app.name,
          package_name: app.package_name,
          enabled: enabledByPackage.has(app.package_name)
            ? enabledByPackage.get(app.package_name)
            : false,
          recommended: RECOMMENDED.some((r) => r.package_name === app.package_name),
        });
      });

      // Apps installées sur l’appareil
      (installed || []).forEach((app) => {
        const existing = byPackage.get(app.packageName);
        if (existing) {
          byPackage.set(app.packageName, {
            ...existing,
            name: app.name || existing.name,
            enabled: enabledByPackage.has(app.packageName)
              ? enabledByPackage.get(app.packageName)
              : existing.enabled,
          });
        } else {
          byPackage.set(app.packageName, {
            application_id: idByPackage.get(app.packageName) || null,
            name: app.name,
            package_name: app.packageName,
            enabled: enabledByPackage.has(app.packageName)
              ? enabledByPackage.get(app.packageName)
              : false,
            recommended: RECOMMENDED.some(
              (r) => r.package_name === app.packageName,
            ),
          });
        }
      });

      // Prefs orphelines (app désinstallée mais encore suivie)
      (prefs || []).forEach((p) => {
        const pkg = p.application?.package_name;
        if (!pkg || byPackage.has(pkg)) return;
        byPackage.set(pkg, {
          application_id: p.application_id,
          name: p.application?.name || pkg,
          package_name: pkg,
          enabled: Boolean(p.enabled),
          recommended: false,
        });
      });

      // Garantir les 3 recommandés même hors appareil (émulateur, etc.)
      RECOMMENDED.forEach((rec) => {
        if (!byPackage.has(rec.package_name)) {
          byPackage.set(rec.package_name, {
            application_id: idByPackage.get(rec.package_name) || null,
            name: rec.name,
            package_name: rec.package_name,
            enabled: enabledByPackage.has(rec.package_name)
              ? enabledByPackage.get(rec.package_name)
              : false,
            recommended: true,
          });
        } else {
          byPackage.set(rec.package_name, {
            ...byPackage.get(rec.package_name),
            recommended: true,
          });
        }
      });

      setItems(
        [...byPackage.values()].sort((a, b) => {
          if (a.recommended !== b.recommended) return a.recommended ? -1 : 1;
          if (a.enabled !== b.enabled) return a.enabled ? -1 : 1;
          return a.name.localeCompare(b.name, "fr");
        }),
      );
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Chargement impossible.");
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  function toggle(packageName, enabled) {
    setItems((prev) =>
      prev.map((item) =>
        item.package_name === packageName ? { ...item, enabled } : item,
      ),
    );
  }

  function addCustomPackage() {
    const pkg = customPackage.trim();
    if (!pkg || !/^[a-zA-Z][\w.]*$/.test(pkg)) {
      setError("Package Android invalide (ex. com.exemple.app).");
      return;
    }
    setError("");
    setItems((prev) => {
      if (prev.some((i) => i.package_name === pkg)) {
        return prev.map((i) =>
          i.package_name === pkg ? { ...i, enabled: true } : i,
        );
      }
      return [
        {
          application_id: null,
          name: pkg.split(".").pop() || pkg,
          package_name: pkg,
          enabled: true,
          recommended: false,
        },
        ...prev,
      ];
    });
    setCustomPackage("");
  }

  async function save() {
    setSaving(true);
    setError("");
    try {
      const enabledItems = items.filter((i) => i.enabled);
      const disabledKnown = items.filter(
        (i) => !i.enabled && i.application_id != null,
      );

      let preferences = [
        ...enabledItems.map((i) =>
          i.application_id
            ? { application_id: i.application_id, enabled: true }
            : {
                package_name: i.package_name,
                name: i.name,
                enabled: true,
              },
        ),
        ...disabledKnown.map((i) => ({
          application_id: i.application_id,
          enabled: false,
        })),
      ];

      // Tout désactivé : désactiver les prefs déjà connues côté serveur
      if (preferences.length === 0) {
        const existing = await usersApi.getMonitoring().catch(() => []);
        preferences = (existing || []).map((p) => ({
          application_id: p.application_id,
          enabled: false,
        }));
      }

      if (preferences.length > 0) {
        await usersApi.updateMonitoring(preferences);
      }
      await syncMonitoredPackages(enabledItems.map((i) => i.package_name));

      if (onboarding) {
        navigation.replace("Permissions", { onboarding: true });
      } else {
        navigation.goBack?.();
      }
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : "Enregistrement impossible.",
      );
    } finally {
      setSaving(false);
    }
  }

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter(
      (i) =>
        i.name.toLowerCase().includes(q) ||
        i.package_name.toLowerCase().includes(q),
    );
  }, [items, query]);

  const recommended = filtered.filter((i) => i.recommended);
  const others = filtered.filter((i) => !i.recommended);
  const enabledCount = items.filter((i) => i.enabled).length;

  return (
    <Screen scroll>
      <Text style={styles.title}>Applications surveillées</Text>
      <Text style={styles.subtitle}>
        Choisissez n’importe quelle application installée. SafeDM analysera ses
        notifications (sans bloquer vos messages).
      </Text>

      <View style={styles.searchBox}>
        <IconGlyph name="search" color={colors.textMuted} size={18} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Rechercher une application…"
          placeholderTextColor={colors.textMuted}
          style={styles.searchInput}
          autoCapitalize="none"
          autoCorrect={false}
        />
      </View>

      <Text style={styles.meta}>
        {enabledCount} application{enabledCount > 1 ? "s" : ""} sélectionnée
        {enabledCount > 1 ? "s" : ""}
      </Text>

      {loading ? (
        <ActivityIndicator color={colors.bluePrimary} style={{ marginTop: 24 }} />
      ) : (
        <View>
          {recommended.length > 0 ? (
            <>
              <Text style={styles.section}>Recommandées</Text>
              {recommended.map((item) => (
                <SettingRow
                  key={item.package_name}
                  icon={iconFor(item.name, item.package_name)}
                  title={item.name}
                  subtitle={item.package_name}
                  switchValue={item.enabled}
                  onSwitchChange={(value) => toggle(item.package_name, value)}
                />
              ))}
            </>
          ) : null}

          <Text style={styles.section}>Toutes les applications</Text>
          {others.length === 0 ? (
            <View style={styles.empty}>
              <Text style={styles.emptyText}>
                {query
                  ? "Aucun résultat pour cette recherche."
                  : "Liste des apps indisponible (rebuild Android requis) — utilisez l’ajout manuel ci-dessous."}
              </Text>
            </View>
          ) : (
            others.map((item) => (
              <SettingRow
                key={item.package_name}
                icon={iconFor(item.name, item.package_name)}
                title={item.name}
                subtitle={item.package_name}
                switchValue={item.enabled}
                onSwitchChange={(value) => toggle(item.package_name, value)}
              />
            ))
          )}

          <Text style={styles.section}>Ajouter manuellement</Text>
          <Text style={styles.hint}>
            Nom de package Android (ex. org.telegram.messenger).
          </Text>
          <View style={styles.manualRow}>
            <TextInput
              value={customPackage}
              onChangeText={setCustomPackage}
              placeholder="com.exemple.app"
              placeholderTextColor={colors.textMuted}
              style={styles.manualInput}
              autoCapitalize="none"
              autoCorrect={false}
            />
            <Button
              label="Ajouter"
              variant="outline"
              onPress={addCustomPackage}
              style={styles.manualBtn}
            />
          </View>
        </View>
      )}

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <Button
        label={onboarding ? "Continuer" : "Enregistrer"}
        onPress={save}
        loading={saving}
        disabled={loading}
        style={{ marginTop: 16 }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: {
    fontSize: 26,
    fontWeight: "700",
    color: colors.textPrimary,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 15,
    lineHeight: 22,
    color: colors.textSecondary,
    marginBottom: 16,
  },
  searchBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    paddingHorizontal: 14,
    backgroundColor: colors.white,
    marginBottom: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: colors.textPrimary,
    paddingVertical: 12,
  },
  meta: {
    fontSize: 13,
    color: colors.textMuted,
    marginBottom: 12,
    fontWeight: "600",
  },
  section: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.textSecondary,
    marginTop: 8,
    marginBottom: 10,
  },
  hint: {
    fontSize: 12,
    color: colors.textMuted,
    marginBottom: 8,
  },
  manualRow: {
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
    marginBottom: 8,
  },
  manualInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 14,
    color: colors.textPrimary,
    backgroundColor: colors.white,
  },
  manualBtn: {
    minHeight: 48,
    paddingHorizontal: 14,
  },
  empty: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    padding: 14,
    marginBottom: 12,
  },
  emptyText: { color: colors.textSecondary, lineHeight: 20, fontSize: 13 },
  error: { color: "#F04438", marginTop: 12 },
});
