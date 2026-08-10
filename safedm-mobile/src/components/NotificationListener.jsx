import React, { useEffect } from "react";
import { addAlertFromNotification } from "../services/alertsStore";
import { subscribeToNotifications } from "../services/notificationBridge";

/** Écoute le NLS Android et alimente l’historique local 7 jours. */
export default function NotificationListener({ children }) {
  useEffect(() => {
    const sub = subscribeToNotifications((event) => {
      addAlertFromNotification(event).catch(() => {});
    });
    return () => sub?.remove?.();
  }, []);

  return children;
}
