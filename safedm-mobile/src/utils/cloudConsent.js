import { Alert } from "react-native";
import { getCloudConsent } from "./storage";

/**
 * Returns whether the user allows sending message content to the SafeDM API.
 * Settings opt-in wins; otherwise an explicit one-shot prompt is shown.
 */
export async function ensureContentUploadConsent({
  title = "Envoyer le contenu ?",
  message = "Le texte sera transmis à l’API SafeDM pour analyse. Vous pouvez activer l’analyse cloud en permanence dans Paramètres.",
} = {}) {
  if (await getCloudConsent()) {
    return true;
  }

  return new Promise((resolve) => {
    Alert.alert(title, message, [
      { text: "Refuser", style: "cancel", onPress: () => resolve(false) },
      { text: "Autoriser une fois", onPress: () => resolve(true) },
    ]);
  });
}
