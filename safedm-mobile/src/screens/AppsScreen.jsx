import React, { useCallback, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { ApiError } from "../api/client";
import * as usersApi from "../api/users";
import Button from "../components/Button";
import Screen from "../components/Screen";
import SettingRow from "../components/SettingRow";
import { syncMonitoredPackages } from "../services/notificationBridge";
import { colors } from "../theme/tokens";

function iconFor(name) {
  if (name === "WhatsApp") return "whatsapp";
  if (name === "SMS") return "sms";
  return "email";
}

export default function AppsScreen({ navigation, route }) {
  const onboarding = route?.params?.onboarding === true;
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [apps, prefs] = await Promise.all([
        usersApi.listApplications(),
        usersApi.getMonitoring(),
      ]);
      const byId = new Map((prefs || []).map((p) => [p.application_id, p]));
      setItems(
        (apps || []).map((app) => ({
          application_id: app.id,
          enabled: byId.has(app.id) ? Boolean(byId.get(app.id).enabled) : false,
          name: app.name,
          package_name: app.package_name,
        })),
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

  function toggle(id, enabled) {
    setItems((prev) =>
      prev.map((item) =>
        item.application_id === id ? { ...item, enabled } : item,
      ),
    );
  }

  async function save() {
    setSaving(true);
    setError("");
    try {
      const payload = items.map(({ application_id, enabled }) => ({
        application_id,
        enabled,
      }));
      await usersApi.updateMonitoring(payload);
      await syncMonitoredPackages(
        items.filter((i) => i.enabled).map((i) => i.package_name),
      );
      if (onboarding) {
        navigation.replace("Permissions", { onboarding: true });
      } else {
        navigation.goBack?.();
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Enregistrement impossible.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Screen scroll>
      <Text style={styles.title}>Choisir les applications</Text>
      <Text style={styles.subtitle}>
        Sélectionnez les applications dont vous souhaitez analyser les
        notifications.
      </Text>

      {loading ? (
        <ActivityIndicator color={colors.bluePrimary} style={{ marginTop: 24 }} />
      ) : (
        <View>
          {items.map((item) => (
            <SettingRow
              key={item.application_id}
              icon={iconFor(item.name)}
              title={item.name}
              subtitle={item.package_name}
              switchValue={item.enabled}
              onSwitchChange={(value) => toggle(item.application_id, value)}
            />
          ))}
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
    marginBottom: 20,
  },
  error: { color: "#F04438", marginTop: 12 },
});
