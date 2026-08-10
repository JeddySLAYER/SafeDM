import React from "react";
import { SafeAreaView, StatusBar, StyleSheet, Text, View } from "react-native";
import SafeDMLogo from "./src/components/SafeDMLogo";
import { colors } from "./src/theme/tokens";

function App() {
  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.white} />
      <View style={styles.container}>
        <View style={styles.brandRow}>
          <SafeDMLogo size={48} />
          <Text style={styles.brandText}>
            <Text style={styles.brandSafe}>Safe</Text>
            <Text style={styles.brandDm}>DM</Text>
          </Text>
        </View>
        <Text style={styles.title}>Application mobile</Text>
        <Text style={styles.subtitle}>
          Projet initialisé (Sprint 0) en JavaScript. Auth, NotificationListener
          et analyse arriveront aux sprints 5–7.
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.section,
  },
  container: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 48,
  },
  brandRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 32,
  },
  brandText: {
    fontSize: 28,
    fontWeight: "700",
  },
  brandSafe: {
    color: colors.textPrimary,
  },
  brandDm: {
    color: colors.bluePrimary,
  },
  title: {
    fontSize: 22,
    fontWeight: "600",
    color: colors.textPrimary,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    lineHeight: 24,
    color: colors.textSecondary,
  },
});

export default App;
