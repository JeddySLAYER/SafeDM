import React, { useEffect, useRef, useState } from "react";
import { Text, View } from "react-native";
import { NavigationContainer, createNavigationContainerRef } from "@react-navigation/native";
import * as ExpoLinking from "expo-linking";
import * as SplashScreen from "expo-splash-screen";
import { useAuth } from "../context/AuthContext";
import { useLinkGate } from "../context/LinkGateContext";
import {
  getLaunchUrl,
  subscribeToLinkIntents,
} from "../services/notificationBridge";
import AppDialogHost from "../components/AppDialogHost";
import PolicyConsentHost from "../components/PolicyConsentHost";
import OfflineBanner from "../components/OfflineBanner";
import SplashView from "../components/SplashView";
import { isIgnorableLaunchUrl } from "../utils/launchUrl";
import { confirmDialog } from "../services/appDialog";
import { offerModelUpdate } from "../services/modelUpdate";
import {
  consumeLaunchNotificationPayload,
  NOTIFICATION_TYPES,
  notify,
  subscribeToNotificationTaps,
} from "../services/notifications";
import useIncomingShare from "../hooks/useIncomingShare";
import AppStack from "./AppTabs";
// import AuthStack from "./AuthStack"; // Compte non requis pour le mode hors ligne

export const navigationRef = createNavigationContainerRef();

function ShareListener() {
  useIncomingShare();
  return null;
}

/**
 * Ouvre l'element concerne quand l'utilisateur touche une notification.
 *
 * Deux cas : une alerte (on va au detail de l'alerte locale) ou un lien bloque
 * (on rouvre la verification). Une notification sans cible connue ne fait
 * rien — mieux vaut un tap sans effet qu'une navigation au hasard.
 */
function handleNotificationTap(payload) {
  if (!payload || !navigationRef.isReady()) return;
  if (payload.alertId) {
    navigationRef.navigate("AlertDetail", { alertId: payload.alertId });
    return;
  }
  if (payload.url) {
    navigationRef.navigate("LinkGate", { url: payload.url });
  }
}

function NotificationTapBridge() {
  useEffect(() => {
    const sub = subscribeToNotificationTaps((payload) => {
      handleNotificationTap(payload);
    });
    // Demarrage a froid : l'application a ete ouverte en touchant la
    // notification, le payload a ete garde par le module natif.
    consumeLaunchNotificationPayload().then((payload) => {
      if (payload) handleNotificationTap(payload);
    });
    return () => {
      sub?.remove?.();
    };
  }, []);

  return null;
}

function extractHttpUrl(url) {
  if (!url) return null;
  const value = String(url).trim();
  if (/^https?:\/\//i.test(value)) return value;
  if (/^www\./i.test(value)) return `https://${value}`;
  try {
    const parsed = ExpoLinking.parse(value);
    const nested = parsed?.queryParams?.url;
    if (nested && /^https?:\/\//i.test(String(nested))) {
      return String(nested);
    }
  } catch {
    /* ignore */
  }
  // Texte partagé contenant une URL
  const match = value.match(/https?:\/\/[^\s<>"']+/i);
  return match ? match[0] : null;
}

function routeToGate(httpUrl, isAuthenticated, queueUrl) {
  if (!httpUrl || isIgnorableLaunchUrl(httpUrl)) return;
  if (!isAuthenticated) {
    queueUrl(httpUrl);
    return;
  }
  if (navigationRef.isReady()) {
    navigationRef.navigate("LinkGate", { url: httpUrl });
  } else {
    queueUrl(httpUrl);
  }
}

function LinkIntentBridge() {
  const { isAuthenticated } = useAuth();
  const { queueUrl, pendingUrl, consumeUrl } = useLinkGate();

  useEffect(() => {
    function handle(url) {
      routeToGate(extractHttpUrl(url), isAuthenticated, queueUrl);
    }

    // 1) Intent natif VIEW / SEND (fiable même si Chrome est installé)
    getLaunchUrl().then((url) => {
      if (url) handle(url);
    });

    // 2) Deep links expo / safedm://
    ExpoLinking.getInitialURL().then((url) => {
      if (url) handle(url);
    });
    const expoSub = ExpoLinking.addEventListener("url", ({ url }) => handle(url));

    // 3) App déjà ouverte + nouveau lien
    const nativeSub = subscribeToLinkIntents((url) => handle(url));

    return () => {
      expoSub.remove();
      nativeSub?.remove?.();
    };
  }, [isAuthenticated, queueUrl]);

  useEffect(() => {
    if (!isAuthenticated || !pendingUrl) return;
    if (!navigationRef.isReady()) return;
    const url = consumeUrl();
    if (url) {
      requestAnimationFrame(() => {
        if (navigationRef.isReady()) {
          navigationRef.navigate("LinkGate", { url });
        }
      });
    }
  }, [isAuthenticated, pendingUrl, consumeUrl]);

  return null;
}

function ModelUpdateBridge() {
  const { token } = useAuth();
  const [status, setStatus] = useState("");

  useEffect(() => {
    if (!token) return undefined;
    let cancelled = false;
    offerModelUpdate({
      ask: () =>
        confirmDialog({
          title: "Mise à jour du modèle",
          message: "Une mise à jour est prête. Le téléphone peut l’installer maintenant.",
          confirmLabel: "Mettre à jour",
          cancelLabel: "Plus tard",
        }),
      onStart: () => {
        if (!cancelled) setStatus("Mise à jour du modèle en cours");
      },
    })
      .then((result) => {
        if (cancelled) return;
        if (result?.updated) {
          notify(NOTIFICATION_TYPES.MODEL_UPDATED, {
            title: "Modèle mis à jour",
            body: "Un nouveau modèle local est actif sur ce téléphone.",
            data: { id: `model-${result.version || Date.now()}` },
          });
        }
        setStatus(result?.updated ? "" : "");
      })
      .catch(() => {
        if (!cancelled) setStatus("");
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  if (!status) return null;
  return (
    <View style={{ backgroundColor: "#1769d4", paddingVertical: 8, paddingHorizontal: 16 }}>
      <Text style={{ color: "#fff", fontWeight: "700" }}>{status}</Text>
    </View>
  );
}

export default function RootNavigator() {
  const { bootstrapping, isAuthenticated, policiesOk } = useAuth();
  // Un accord peut devenir caduc apres coup (session expiree, politique mise a
  // jour). On garde la trace de l'etat initial pour ne pas relancer l'ecran
  // d'acceptation qui sert de route de depart.
  const policiesRef = useRef(policiesOk);

  useEffect(() => {
    if (bootstrapping) return;
    if (policiesRef.current && !policiesOk) {
      if (navigationRef.isReady()) {
        navigationRef.navigate("Policies");
      }
    }
    policiesRef.current = policiesOk;
  }, [bootstrapping, policiesOk]);

  // Le splash natif reste en place tant que l'application n'est pas
  // prete a afficher son premier ecran : pas de fenetre blanche intermediaire.
  useEffect(() => {
    if (!bootstrapping) {
      SplashScreen.hideAsync().catch(() => {});
    }
  }, [bootstrapping]);

  if (bootstrapping) {
    return <SplashView />;
  }

  // Compte non obligatoire : accueil et analyses locales restent accessibles.
  // Auth reste proposé mais n'est plus bloquant pour les fonctions basiques.
  return (
    <View style={{ flex: 1 }}>
      <OfflineBanner />
      <ModelUpdateBridge />
      <AppDialogHost />
      <PolicyConsentHost />
      <NavigationContainer ref={navigationRef}>
        <ShareListener />
        <LinkIntentBridge />
        <NotificationTapBridge />
        {isAuthenticated ? <AppStack /> : <AppStack />}
      </NavigationContainer>
    </View>
  );
}
