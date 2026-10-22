import React from "react";
import { StatusBar } from "react-native";
import * as SplashScreen from "expo-splash-screen";
import { SafeAreaProvider } from "react-native-safe-area-context";
import NotificationListener from "./src/components/NotificationListener";
import { AuthProvider } from "./src/context/AuthContext";
import { LinkGateProvider } from "./src/context/LinkGateContext";
import { UpdateStatusProvider } from "./src/context/UpdateStatusContext";
import UpdateBanner from "./src/components/UpdateBanner";
import RootNavigator from "./src/navigation/RootNavigator";
import { colors } from "./src/theme/tokens";

/**
 * Le splash natif reste affiche jusqu'a ce que la navigation soit prete.
 *
 * Le masquer ici ouvrait une fenetre blanche entre le splash et le premier
 * ecran : l'utilisateur voyait un ecran vide pendant le chargement.
 */
SplashScreen.preventAutoHideAsync().catch(() => {
  // Already hidden or unavailable in Jest / bare tests.
});

export default function App() {
  return (
    <SafeAreaProvider>
      <StatusBar barStyle="dark-content" backgroundColor={colors.white} />
      <UpdateStatusProvider>
        <LinkGateProvider>
          <AuthProvider>
            <NotificationListener>
              <UpdateBanner />
              <RootNavigator />
            </NotificationListener>
          </AuthProvider>
        </LinkGateProvider>
      </UpdateStatusProvider>
    </SafeAreaProvider>
  );
}
