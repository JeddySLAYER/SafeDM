import React, { useCallback, useState } from "react";
import { AppState, StyleSheet, Text, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import Button from "../components/Button";
import { IconBadge } from "../components/Icons";
import Screen from "../components/Screen";
import { useAuth } from "../context/AuthContext";
import {
  isNotificationAccessEnabled,
  openNotificationListenerSettings,
} from "../services/notificationBridge";
import { colors, radii } from "../theme/tokens";

export default function PermissionsScreen({ navigation, route }) {
  const onboarding = route?.params?.onboarding === true;
  const { completeSetup } = useAuth();
  const [enabled, setEnabled] = useState(false);

  const refresh = useCallback(async () => {
    setEnabled(await isNotificationAccessEnabled());
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

  async function continueNext() {
    if (onboarding) {
      await completeSetup();
      navigation.reset({ index: 0, routes: [{ name: "MainTabs" }] });
      return;
    }
    navigation.goBack();
  }

  return (
    <Screen contentStyle={styles.content}>
      <View style={styles.hero}>
        <View style={styles.circle}>
          <IconBadge name="bell" size={72} />
          <View style={styles.shield}>
            <IconBadge name="shield" size={36} />
          </View>
        </View>
        <Text style={styles.title}>Activez l’accès aux notifications</Text>
        <Text style={styles.body}>
          SafeDM lit localement les notifications des apps choisies pour
          détecter les messages suspects. Aucun message n’est modifié ni bloqué.
        </Text>
        <Text style={styles.status}>
          Statut :{" "}
          <Text style={{ color: enabled ? colors.bluePrimary : colors.textSecondary, fontWeight: "700" }}>
            {enabled ? "Autorisé" : "Non autorisé"}
          </Text>
        </Text>
      </View>

      <Button
        label="Autoriser l’accès"
        onPress={() => openNotificationListenerSettings()}
      />
      <Button
        label={enabled || onboarding ? (enabled ? "Continuer" : "Plus tard") : "Retour"}
        variant="outline"
        onPress={continueNext}
        style={{ marginTop: 12 }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { justifyContent: "space-between" },
  hero: { flex: 1, justifyContent: "center", alignItems: "center" },
  circle: {
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: colors.blueSoft,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 28,
  },
  shield: {
    position: "absolute",
    right: 8,
    bottom: 8,
    borderRadius: radii.pill,
    backgroundColor: colors.white,
  },
  title: {
    fontSize: 24,
    fontWeight: "700",
    color: colors.textPrimary,
    textAlign: "center",
    marginBottom: 12,
  },
  body: {
    fontSize: 15,
    lineHeight: 22,
    color: colors.textSecondary,
    textAlign: "center",
    marginBottom: 16,
  },
  status: { fontSize: 14, color: colors.textSecondary },
});
