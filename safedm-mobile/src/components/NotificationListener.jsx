import React, { useEffect } from "react";
import { addAlertFromNotification } from "../services/alertsStore";
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
      const pending = await flushPendingNotifications();
      if (cancelled) return;
      for (const event of pending) {
        await ingest(event);
      }
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
