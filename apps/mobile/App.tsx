import React from "react";
import { StyleSheet, View, SafeAreaView } from "react-native";
import { StatusBar } from "expo-status-bar";
import {
  ReadLaterProvider,
  useReadLater,
} from "./src/context/ReadLaterContext";
import { Header } from "./src/components/Header";
import { SettingsPanel } from "./src/components/SettingsPanel";
import { LinkList } from "./src/components/LinkList";
import { BottomBar } from "./src/components/BottomBar";

/**
 * Main app content – rendered inside ReadLaterProvider.
 */
function AppContent() {
  const { showSettings } = useReadLater();

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="auto" />

      <Header />

      <View style={{ flex: 1 }}>
        {showSettings ? <SettingsPanel /> : <LinkList />}
      </View>

      {!showSettings && <BottomBar />}
    </SafeAreaView>
  );
}

/**
 * Root App component.
 */
export default function App() {
  return (
    <ReadLaterProvider>
      <AppContent />
    </ReadLaterProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f8fafc",
  },
});
