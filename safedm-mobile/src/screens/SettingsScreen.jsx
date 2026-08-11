import React, { useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";
import Button from "../components/Button";
import { IconGlyph } from "../components/Icons";
import Screen from "../components/Screen";
import SettingRow from "../components/SettingRow";
import { useAuth } from "../context/AuthContext";
import { appVersion, colors, radii } from "../theme/tokens";

export default function SettingsScreen({ navigation }) {
  const { user, logout } = useAuth();
  const initials = useMemo(() => {
    const name = user?.username || "?";
    return name.slice(0, 2).toUpperCase();
  }, [user]);

  return (
    <Screen scroll>
      <Text style={styles.title}>Paramètres</Text>

      <View style={styles.profileCard}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{initials}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.name}>{user?.username ?? "—"}</Text>
          <Text style={styles.email}>
            {user?.is_admin ? "Compte administrateur" : "Compte utilisateur"}
          </Text>
        </View>
      </View>

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

      <Text style={styles.section}>À propos</Text>
      <SettingRow
        icon="doc"
        title="Version de l’application"
        valueText={appVersion}
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
});
