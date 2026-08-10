import React from "react";
import { NavigationContainer } from "@react-navigation/native";
import { useAuth } from "../context/AuthContext";
import SplashView from "../components/SplashView";
import AppStack from "./AppTabs";
import AuthStack from "./AuthStack";

export default function RootNavigator() {
  const { bootstrapping, isAuthenticated } = useAuth();

  if (bootstrapping) {
    return <SplashView />;
  }

  return (
    <NavigationContainer>
      {isAuthenticated ? <AppStack /> : <AuthStack />}
    </NavigationContainer>
  );
}
