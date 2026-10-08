import { confirmDialog } from "../services/appDialog";
import { getCloudConsent } from "./storage";

/**
 * Returns whether the user allows sending message content to the SafeDM API.
 * Settings opt-in wins; otherwise an explicit one-shot prompt is shown.
 */
export async function ensureContentUploadConsent({
  title = "Envoyer le contenu ?",
  message = "Le texte quitte le téléphone uniquement pour cette vérification. Vous pouvez l'autoriser en permanence dans Paramètres.",
} = {}) {
  if (await getCloudConsent()) {
    return true;
  }

  return confirmDialog({
    title,
    message,
    confirmLabel: "Autoriser une fois",
    cancelLabel: "Refuser",
  });
}
