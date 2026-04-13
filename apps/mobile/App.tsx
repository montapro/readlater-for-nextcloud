import React, { useState, useEffect } from "react";
import { 
  StyleSheet, 
  Text, 
  View, 
  TextInput, 
  TouchableOpacity, 
  FlatList, 
  SafeAreaView, 
  ActivityIndicator,
  Alert
} from "react-native";
import { StatusBar } from "expo-status-bar";
import * as SecureStore from "expo-secure-store";
import * as Crypto from "expo-crypto";
import { LinkKeepClient, WebDAVConfig, Link } from "@linkkeep/core";
import { Settings, Save, RefreshCw, Link2, Trash2 } from "lucide-react-native";

// Polyfill for crypto.randomUUID (not in JS global on RN)
if (!global.crypto) {
  // @ts-ignore
  global.crypto = {};
}
if (!global.crypto.randomUUID) {
  // @ts-ignore
  global.crypto.randomUUID = () => Crypto.randomUUID();
}

export default function App() {
  const [config, setConfig] = useState<WebDAVConfig>({ url: "", username: "", password: "" });
  const [isConfigured, setIsConfigured] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [links, setLinks] = useState<Link[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    const url = await SecureStore.getItemAsync("webdav_url");
    const user = await SecureStore.getItemAsync("webdav_user");
    const pass = await SecureStore.getItemAsync("webdav_pass");

    if (url && user) {
      const loadedConfig = { url, username: user, password: pass || "" };
      setConfig(loadedConfig);
      setIsConfigured(true);
      fetchLinks(loadedConfig);
    } else {
      setShowSettings(true);
    }
  };

  const saveSettings = async () => {
    await SecureStore.setItemAsync("webdav_url", config.url);
    await SecureStore.setItemAsync("webdav_user", config.username);
    await SecureStore.setItemAsync("webdav_pass", config.password || "");
    setIsConfigured(true);
    setShowSettings(false);
    fetchLinks(config);
  };

  const fetchLinks = async (cfg: WebDAVConfig) => {
    setLoading(true);
    try {
      const client = new LinkKeepClient(cfg);
      const store = await client.fetchLinks();
      setLinks(store.links);
    } catch (error) {
      console.error(error);
      Alert.alert("Error", "Could not fetch links. Please check your settings.");
    } finally {
      setLoading(false);
    }
  };

  const renderItem = ({ item }: { item: Link }) => (
    <View style={styles.card}>
      <View style={styles.cardIcon}>
        <Link2 color="#2563eb" size={24} />
      </View>
      <View style={styles.cardContent}>
        <Text style={styles.cardTitle} numberOfLines={2}>{item.title}</Text>
        <Text style={styles.cardUrl} numberOfLines={1}>{item.url}</Text>
        <Text style={styles.cardDate}>{new Date(item.addedAt).toLocaleDateString()}</Text>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="auto" />
      
      {/* Header */}
      <View style={styles.header}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <View style={styles.logo}>
            <Link2 color="#fff" size={20} />
          </View>
          <Text style={styles.headerTitle}>LinkKeep Mobile</Text>
        </View>
        <TouchableOpacity onPress={() => setShowSettings(!showSettings)}>
          <Settings color="#64748b" size={24} />
        </TouchableOpacity>
      </View>

      <main style={{ flex: 1 }}>
        {showSettings ? (
          <View style={styles.settingsForm}>
            <Text style={styles.sectionTitle}>WebDAV Settings</Text>
            <TextInput 
              style={styles.input}
              placeholder="Nextcloud URL"
              value={config.url}
              onChangeText={(t) => setConfig({...config, url: t})}
            />
            <TextInput 
              style={styles.input}
              placeholder="Username"
              value={config.username}
              onChangeText={(t) => setConfig({...config, username: t})}
            />
            <TextInput 
              style={styles.input}
              placeholder="App Password"
              secureTextEntry
              value={config.password}
              onChangeText={(t) => setConfig({...config, password: t})}
            />
            <TouchableOpacity style={styles.button} onPress={saveSettings}>
              <Save color="#fff" size={20} />
              <Text style={styles.buttonText}>Save Configuration</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={{ flex: 1 }}>
            {loading ? (
              <ActivityIndicator size="large" color="#2563eb" style={{ marginTop: 40 }} />
            ) : (
              <FlatList
                data={links}
                keyExtractor={(item) => item.id}
                renderItem={renderItem}
                contentContainerStyle={styles.listContainer}
                refreshing={loading}
                onRefresh={() => fetchLinks(config)}
                ListEmptyComponent={
                  <Text style={styles.emptyText}>No links saved yet.</Text>
                }
              />
            )}
          </View>
        )}
      </main>

      {!showSettings && !loading && (
        <TouchableOpacity 
          style={styles.fab} 
          onPress={() => fetchLinks(config)}
        >
          <RefreshCw color="#fff" size={24} />
        </TouchableOpacity>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f8fafc",
  },
  header: {
    paddingHorizontal: 20,
    paddingVertical: 15,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#0f172a",
  },
  logo: {
    backgroundColor: "#2563eb",
    padding: 6,
    borderRadius: 8,
  },
  settingsForm: {
    padding: 20,
    gap: 15,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: "600",
    textTransform: "uppercase",
    color: "#64748b",
    marginBottom: 5,
  },
  input: {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
  },
  button: {
    backgroundColor: "#2563eb",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    padding: 14,
    borderRadius: 8,
    gap: 10,
    marginTop: 10,
  },
  buttonText: {
    color: "#fff",
    fontWeight: "bold",
    fontSize: 16,
  },
  listContainer: {
    padding: 20,
    gap: 15,
  },
  card: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 15,
    flexDirection: "row",
    gap: 15,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  cardIcon: {
    backgroundColor: "#eff6ff",
    padding: 10,
    borderRadius: 10,
    alignSelf: "flex-start",
  },
  cardContent: {
    flex: 1,
    gap: 4,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#1e293b",
  },
  cardUrl: {
    fontSize: 12,
    color: "#64748b",
  },
  cardDate: {
    fontSize: 10,
    color: "#94a3b8",
    marginTop: 5,
  },
  emptyText: {
    textAlign: "center",
    color: "#94a3b8",
    marginTop: 40,
  },
  fab: {
    position: "absolute",
    right: 20,
    bottom: 30,
    backgroundColor: "#2563eb",
    padding: 16,
    borderRadius: 30,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  }
});
