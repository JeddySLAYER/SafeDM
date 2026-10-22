import React, { useEffect } from "react";
import { addAlertFromNotification, listAlerts } from "../services/alertsStore";
import {
  ensureNotificationChannels,
  maybePostDailyDigest,
} from "../services/notifications";
import {
  flushPendingNotifications,
  subscribeToNotifications,
} from "../services/notificationBridge";

async function ingest(event) {
  if (!event) return;
  try {
    await addAlertFromNotification(event);
  } catch {
    /* ignore */
  }
}

/** Écoute le NLS Android et alimente l’historique local 7 jours. */
export default function NotificationListener({ children }) {
  useEffect(() => {
    let cancelled = false;

    (async () => {
      // Canaux/systeme : sans eux, aucune notification ne peut etre affichee,
      // et l'utilisateur n'a rien a regler.
      await ensureNotificationChannels();

      const pending = await flushPendingNotifications();
      if (cancelled) return;
      for (const event of pending) {
        await ingest(event);
      }

      // Resume quotidien : emis a l'ouverture, pas en arriere-plan (il n'y a
      // pas de tache planifiee dans cette version).
      const alerts = await listAlerts();
      if (!cancelled) await maybePostDailyDigest(alerts);
    })();

    const sub = subscribeToNotifications((event) => {
      ingest(event);
    });

    return () => {
      cancelled = true;
      sub?.remove?.();
    };
  }, []);

  return children;
}
