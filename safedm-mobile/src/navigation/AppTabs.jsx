import React from "react";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { IconGlyph } from "../components/Icons";
import { useAuth } from "../context/AuthContext";
import AlertsScreen from "../screens/AlertsScreen";
import AnalysisResultScreen from "../screens/AnalysisResultScreen";
import AppsScreen from "../screens/AppsScreen";
import CommunityScreen from "../screens/CommunityScreen";
import DirectReportScreen from "../screens/DirectReportScreen";
import GuideArticleScreen from "../screens/GuideArticleScreen";
import GuideScreen from "../screens/GuideScreen";
import HomeScreen from "../screens/HomeScreen";
import LinkGateScreen from "../screens/LinkGateScreen";
import LinkProtectionScreen from "../screens/LinkProtectionScreen";
import ManualAnalysisScreen from "../screens/ManualAnalysisScreen";
import AlertDetailScreen from "../screens/AlertDetailScreen";
import PermissionsScreen from "../screens/PermissionsScreen";
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
      <Stack.Screen name="ManualAnalysis" component={ManualAnalysisScreen} />
      <Stack.Screen name="DirectReport" component={DirectReportScreen} />
      <Stack.Screen name="AnalysisResult" component={AnalysisResultScreen} />
      <Stack.Screen name="LinkGate" component={LinkGateScreen} />
      <Stack.Screen name="LinkProtection" component={LinkProtectionScreen} />
      <Stack.Screen name="AlertDetail" component={AlertDetailScreen} />
      <Stack.Screen name="Community" component={CommunityScreen} />
      <Stack.Screen name="Guide" component={GuideScreen} />
      <Stack.Screen name="GuideArticle" component={GuideArticleScreen} />
    </Stack.Navigator>
  );
}
