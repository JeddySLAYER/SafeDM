import React, { useEffect } from "react";
import { StatusBar } from "react-native";
import * as SplashScreen from "expo-splash-screen";
import { SafeAreaProvider } from "react-native-safe-area-context";
import NotificationListener from "./src/components/NotificationListener";
import { AuthProvider } from "./src/context/AuthContext";
import { LinkGateProvider } from "./src/context/LinkGateContext";
import RootNavigator from "./src/navigation/RootNavigator";
import { colors } from "./src/theme/tokens";

SplashScreen.preventAutoHideAsync().catch(() => {
  // Already hidden or unavailable in Jest / bare tests.
});

export default function App() {
  useEffect(() => {
    let cancelled = false;

    async function bootstrap() {
      if (!cancelled) {
        SplashScreen.hideAsync().catch(() => {});
      }
    }

    bootstrap();
    return () => {
      cancelled = true;
    };
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
