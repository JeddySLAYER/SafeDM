import React, { useEffect } from "react";
import { StatusBar } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import NotificationListener from "./src/components/NotificationListener";
import { AuthProvider } from "./src/context/AuthContext";
import { LinkGateProvider } from "./src/context/LinkGateContext";
import RootNavigator from "./src/navigation/RootNavigator";
import { colors } from "./src/theme/tokens";
import { updateModelFromManifest } from "./src/services/modelUpdate";

export default function App() {
  useEffect(() => {
    updateModelFromManifest().catch((error) => {
      // The bundled model keeps the app fully functional when offline.
      if (__DEV__ && process.env.NODE_ENV !== "test") {
        console.warn("Model update unavailable; bundled model retained", error?.message);
      }
    });
  }, []);

  return (
    <SafeAreaProvider>
      <StatusBar barStyle="dark-content" backgroundColor={colors.white} />
      <LinkGateProvider>
        <AuthProvider>
          <NotificationListener>
            <RootNavigator />
          </NotificationListener>
        </AuthProvider>
      </LinkGateProvider>
    </SafeAreaProvider>
  );
}
