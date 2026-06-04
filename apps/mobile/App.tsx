import React from "react";
import { StyleSheet, View, SafeAreaView } from "react-native";
import { StatusBar } from "expo-status-bar";
import {
  ReadLaterProvider,
  useReadLater,
} from "./src/context/ReadLaterContext";
import { useTheme } from "./src/hooks/useTheme";
import { Header } from "./src/components/Header";
import { SettingsPanel } from "./src/components/SettingsPanel";
import { LinkList } from "./src/components/LinkList";
import { BottomBar } from "./src/components/BottomBar";
import { StatusBanner } from "./src/components/StatusBanner";
import { AddLinkModal } from "./src/components/AddLinkModal";
import { ErrorBoundary } from "./src/components/ErrorBoundary";

function AppContent() {
  const { showSettings } = useReadLater();
  const { isDark, colors } = useTheme();

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar style={isDark ? "light" : "dark"} />

      <Header />

      <StatusBanner />

      <View style={{ flex: 1, backgroundColor: colors.background }}>
        {showSettings ? <SettingsPanel /> : <LinkList />}
      </View>

      {!showSettings && <BottomBar />}

      <AddLinkModal />
    </SafeAreaView>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <ReadLaterProvider>
        <AppContent />
      </ReadLaterProvider>
    </ErrorBoundary>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
