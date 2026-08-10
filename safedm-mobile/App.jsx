import React from "react";
import { StatusBar } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import NotificationListener from "./src/components/NotificationListener";
import { AuthProvider } from "./src/context/AuthContext";
import RootNavigator from "./src/navigation/RootNavigator";
import { colors } from "./src/theme/tokens";

function App() {
  return (
    <SafeAreaProvider>
      <StatusBar barStyle="dark-content" backgroundColor={colors.white} />
      <AuthProvider>
        <NotificationListener>
          <RootNavigator />
        </NotificationListener>
      </AuthProvider>
    </SafeAreaProvider>
  );
}

export default App;
