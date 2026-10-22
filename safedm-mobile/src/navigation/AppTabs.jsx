import React from "react";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { IconGlyph } from "../components/Icons";
import { useAuth } from "../context/AuthContext";
import AlertsScreen from "../screens/AlertsScreen";
import AnalysisResultScreen from "../screens/AnalysisResultScreen";
import AppsScreen from "../screens/AppsScreen";
import BatteryOptimizationScreen from "../screens/BatteryOptimizationScreen";
import CommunityScreen from "../screens/CommunityScreen";
import DiagnosticsScreen from "../screens/DiagnosticsScreen";
import DirectReportScreen from "../screens/DirectReportScreen";
import GuideArticleScreen from "../screens/GuideArticleScreen";
import GuideChecklistScreen from "../screens/GuideChecklistScreen";
import GuideQuizScreen from "../screens/GuideQuizScreen";
import GuideScenarioScreen from "../screens/GuideScenarioScreen";
import GuideScreen from "../screens/GuideScreen";
import HomeScreen from "../screens/HomeScreen";
import LinkGateScreen from "../screens/LinkGateScreen";
import LinkProtectionScreen from "../screens/LinkProtectionScreen";
import LoginScreen from "../screens/LoginScreen";
import ManualAnalysisScreen from "../screens/ManualAnalysisScreen";
import ModelDiagnosticsScreen from "../screens/ModelDiagnosticsScreen";
import AlertDetailScreen from "../screens/AlertDetailScreen";
import PermissionsScreen from "../screens/PermissionsScreen";
import PoliciesScreen from "../screens/PoliciesScreen";
import RegisterScreen from "../screens/RegisterScreen";
import ReportsScreen from "../screens/ReportsScreen";
import SettingsScreen from "../screens/SettingsScreen";
import { colors } from "../theme/tokens";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

function Tabs() {
  const insets = useSafeAreaInsets();
  const tabPad = Math.max(insets.bottom, 8);
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.bluePrimary,
        tabBarInactiveTintColor: colors.textSecondary,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.borderSubtle,
          height: 56 + tabPad,
          paddingBottom: tabPad,
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
            <IconGlyph name="home" color={color} size={22} />
          ),
        }}
      />
      <Tab.Screen
        name="Alerts"
        component={AlertsScreen}
        options={{
          title: "Alertes",
          tabBarIcon: ({ color }) => (
            <IconGlyph name="alerts" color={color} size={22} />
          ),
        }}
      />
      <Tab.Screen
        name="Reports"
        component={ReportsScreen}
        options={{
          title: "Signalements",
          tabBarIcon: ({ color }) => (
            <IconGlyph name="reports" color={color} size={22} />
          ),
        }}
      />
      {/* Le guide est une destination de premier plan : c'est la premiere
          reflexe qu'on cherche quand un message suspect arrive. Le laisser
          dans les Parametres le rendait invisible. */}
      <Tab.Screen
        name="Guide"
        component={GuideScreen}
        options={{
          title: "Guide",
          tabBarIcon: ({ color }) => (
            <IconGlyph name="guide" color={color} size={22} />
          ),
        }}
      />
      <Tab.Screen
        name="Settings"
        component={SettingsScreen}
        options={{
          title: "Paramètres",
          tabBarIcon: ({ color }) => (
            <IconGlyph name="settings" color={color} size={22} />
          ),
        }}
      />
    </Tab.Navigator>
  );
}

export default function AppStack() {
  const { needsSetup, policiesOk } = useAuth();
  const initialRouteName = !policiesOk
    ? "Policies"
    : needsSetup
      ? "Permissions"
      : "MainTabs";

  return (
    <Stack.Navigator
      initialRouteName={initialRouteName}
      screenOptions={{ headerShown: false }}
    >
      <Stack.Screen name="MainTabs" component={Tabs} />
      <Stack.Screen name="Policies" component={PoliciesScreen} />
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
        name="BatteryOptimization"
        component={BatteryOptimizationScreen}
        initialParams={{ onboarding: needsSetup }}
      />
      <Stack.Screen name="Diagnostics" component={DiagnosticsScreen} />
      <Stack.Screen name="ModelDiagnostics" component={ModelDiagnosticsScreen} />
      <Stack.Screen name="ManualAnalysis" component={ManualAnalysisScreen} />
      <Stack.Screen name="DirectReport" component={DirectReportScreen} />
      <Stack.Screen name="AnalysisResult" component={AnalysisResultScreen} />
      {/* Compte optionnel : l'application fonctionne sans, mais l'acceptation
          des documents et le signalement exigent une session valide. */}
      <Stack.Screen name="Login" component={LoginScreen} />
      <Stack.Screen name="Register" component={RegisterScreen} />
      <Stack.Screen name="LinkGate" component={LinkGateScreen} />
      <Stack.Screen name="LinkProtection" component={LinkProtectionScreen} />
      <Stack.Screen name="AlertDetail" component={AlertDetailScreen} />
      <Stack.Screen name="Community" component={CommunityScreen} />
      <Stack.Screen name="Guide" component={GuideScreen} />
      <Stack.Screen name="GuideArticle" component={GuideArticleScreen} />
      <Stack.Screen name="GuideScenario" component={GuideScenarioScreen} />
      <Stack.Screen name="GuideChecklist" component={GuideChecklistScreen} />
      <Stack.Screen name="GuideQuiz" component={GuideQuizScreen} />
    </Stack.Navigator>
  );
}
