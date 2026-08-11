import React, { useEffect } from "react";
import { NavigationContainer, createNavigationContainerRef } from "@react-navigation/native";
import * as ExpoLinking from "expo-linking";
import { useAuth } from "../context/AuthContext";
import { useLinkGate } from "../context/LinkGateContext";
import {
  getLaunchUrl,
  subscribeToLinkIntents,
} from "../services/notificationBridge";
import SplashView from "../components/SplashView";
import AppStack from "./AppTabs";
import AuthStack from "./AuthStack";

export const navigationRef = createNavigationContainerRef();

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
  if (!httpUrl) return;
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

export default function RootNavigator() {
  const { bootstrapping, isAuthenticated } = useAuth();

  if (bootstrapping) {
    return <SplashView />;
  }

  return (
    <NavigationContainer ref={navigationRef}>
      <LinkIntentBridge />
      {isAuthenticated ? <AppStack /> : <AuthStack />}
    </NavigationContainer>
  );
}
