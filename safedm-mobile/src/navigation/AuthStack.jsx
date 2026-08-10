import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { useAuth } from "../context/AuthContext";
import LoginScreen from "../screens/LoginScreen";
import RegisterScreen from "../screens/RegisterScreen";
import WelcomeScreen from "../screens/WelcomeScreen";
import { colors } from "../theme/tokens";

const Stack = createNativeStackNavigator();

export default function AuthStack() {
  const { onboardingDone } = useAuth();

  return (
    <Stack.Navigator
      initialRouteName={onboardingDone ? "Login" : "Welcome"}
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.section },
      }}
    >
      <Stack.Screen name="Welcome" component={WelcomeScreen} />
      <Stack.Screen name="Login" component={LoginScreen} />
      <Stack.Screen name="Register" component={RegisterScreen} />
    </Stack.Navigator>
  );
}
