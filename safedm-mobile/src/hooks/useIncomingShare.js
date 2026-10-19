import { useEffect, useRef } from "react";
import * as Linking from "expo-linking";
import { useNavigation } from "@react-navigation/native";
import {
  getLaunchShare,
  subscribeToShareIntents,
} from "../services/notificationBridge";

const URL_ONLY = /^(https?:\/\/\S+|www\.\S+)$/i;

function extractSharedText(url) {
  if (!url) return "";
  try {
    const parsed = Linking.parse(url);
    const q = parsed.queryParams || {};
    return q.text || q.content || q.message || "";
  } catch {
    return "";
  }
}

export default function useIncomingShare() {
  const navigation = useNavigation();
  const handledRef = useRef(false);

  useEffect(() => {
    function openAnalysis(text) {
      const value = String(text || "").trim();
      // Un lien seul reste géré par le flux Link Gate.
      if (!value || URL_ONLY.test(value) || handledRef.current) return;
      handledRef.current = true;
      navigation.navigate("ManualAnalysis", {
        initialContent: value.slice(0, 2000),
      });
    }

    // 1) Texte partagé au lancement (ACTION_SEND, Android natif)
    getLaunchShare().then((text) => {
      if (text) openAnalysis(text);
    });

    // 2) Liens safedm://…?text=… (fallback inter-app)
    Linking.getInitialURL()
      .then((url) => openAnalysis(extractSharedText(url)))
      .catch(() => {});

    const linkSub = Linking.addEventListener("url", ({ url }) => {
      openAnalysis(extractSharedText(url));
    });

    // 3) App déjà ouverte + nouveau partage natif
    const shareSub = subscribeToShareIntents((text) => openAnalysis(text));

    return () => {
      linkSub?.remove?.();
      shareSub?.remove?.();
    };
  }, [navigation]);
}
