import React from "react";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { IconGlyph } from "../components/Icons";
import { useAuth } from "../context/AuthContext";
import AlertsScreen from "../screens/AlertsScreen";
import AppsScreen from "../screens/AppsScreen";
import HomeScreen from "../screens/HomeScreen";
import PermissionsScreen from "../screens/PermissionsScreen";
import PlaceholderScreen from "../screens/PlaceholderScreen";
import ReportsScreen from "../screens/ReportsScreen";
import SettingsScreen from "../screens/SettingsScreen";
import { colors } from "../theme/tokens";

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

function Tabs() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.bluePrimary,
        tabBarInactiveTintColor: colors.textSecondary,
        tabBarStyle: {
          backgroundColor: colors.white,
          borderTopColor: colors.border,
          height: 62,
          paddingBottom: 8,
          paddingTop: 8,
        },
        tabBarLabelStyle: { fontSize: 11, fontWeight: "600" },
      }}
    >
      <Tab.Screen
        name="Home"
        component={HomeScreen}
        options={{
          title: "Accueil",
          tabBarIcon: ({ color }) => (
            <IconGlyph name="home" color={color} size={18} />
          ),
        }}
      />
      <Tab.Screen
        name="Alerts"
        component={AlertsScreen}
        options={{
          title: "Alertes",
          tabBarIcon: ({ color }) => (
            <IconGlyph name="alerts" color={color} size={18} />
          ),
        }}
      />
      <Tab.Screen
        name="Reports"
        component={ReportsScreen}
        options={{
          title: "Signalements",
          tabBarIcon: ({ color }) => (
            <IconGlyph name="reports" color={color} size={18} />
          ),
        }}
      />
      <Tab.Screen
        name="Settings"
        component={SettingsScreen}
        options={{
          title: "Paramètres",
          tabBarIcon: ({ color }) => (
            <IconGlyph name="settings" color={color} size={18} />
          ),
        }}
      />
    </Tab.Navigator>
  );
}

export default function AppStack() {
  const { needsSetup } = useAuth();

  return (
    <Stack.Navigator
      initialRouteName={needsSetup ? "Apps" : "MainTabs"}
      screenOptions={{ headerShown: false }}
    >
      <Stack.Screen name="MainTabs" component={Tabs} />
      <Stack.Screen
        name="Apps"
        component={AppsScreen}
        initialParams={{ onboarding: needsSetup }}
      />
      <Stack.Screen
        name="Permissions"
        component={PermissionsScreen}
        initialParams={{ onboarding: needsSetup }}
      />
      <Stack.Screen
        name="ManualAnalysis"
        component={PlaceholderScreen}
        initialParams={{
          title: "Analyse manuelle",
          body: "Écran prévu Sprint 7 — collage d’un message et appel POST /analysis.",
        }}
      />
      <Stack.Screen
        name="Community"
        component={PlaceholderScreen}
        initialParams={{
          title: "Menaces communautaires",
          body: "Écran prévu Sprint 7 — GET /threats/community.",
        }}
      />
      <Stack.Screen
        name="Guide"
        component={PlaceholderScreen}
        initialParams={{
          title: "Guide",
          body: "Écran prévu Sprint 7 — GET /guide/categories.",
        }}
      />
    </Stack.Navigator>
  );
}
