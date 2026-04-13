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
import * as Linking from "expo-linking";
import { LinkKeepClient, WebDAVConfig, Link } from "@linkkeep/core";
import { Settings, Save, RefreshCw, Link2, Trash2, CheckCircle, ExternalLink } from "lucide-react-native";

// Polyfill for crypto.randomUUID
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

  const handleOpenLink = (url: string) => {
    Linking.openURL(url);
  };

  const handleToggleRead = async (id: string, isRead: boolean) => {
    try {
      const client = new LinkKeepClient(config);
      await client.updateLink(id, { isRead: !isRead });
      await fetchLinks(config);
    } catch (error) {
      Alert.alert("Error", "Failed to update link.");
    }
  };

  const handleDeleteLink = async (id: string) => {
    Alert.alert(
      "Delete Link",
      "Are you sure you want to remove this link?",
      [
        { text: "Cancel", style: "cancel" },
        { 
          text: "Delete", 
          style: "destructive", 
          onPress: async () => {
            try {
              const client = new LinkKeepClient(config);
              await client.deleteLink(id);
              await fetchLinks(config);
            } catch (error) {
              Alert.alert("Error", "Failed to delete link.");
            }
          }
        }
      ]
    );
  };

  const renderItem = ({ item }: { item: Link }) => (
    <View style={[styles.card, item.isRead && styles.cardRead]}>
      <View style={styles.cardHeader}>
        <View style={styles.cardIcon}>
          <Link2 color={item.isRead ? "#94a3b8" : "#2563eb"} size={20} />
        </View>
        <View style={styles.cardContent}>
          <Text style={[styles.cardTitle, item.isRead && styles.textRead]} numberOfLines={1}>{item.title}</Text>
          <Text style={styles.cardUrl} numberOfLines={1}>{item.url}</Text>
        </View>
      </View>
      
      <View style={styles.cardActions}>
        <TouchableOpacity 
          style={styles.actionButton} 
          onPress={() => handleOpenLink(item.url)}
        >
          <ExternalLink color="#64748b" size={18} />
          <Text style={styles.actionText}>Open</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={styles.actionButton} 
          onPress={() => handleToggleRead(item.id, item.isRead)}
        >
          <CheckCircle color={item.isRead ? "#10b981" : "#64748b"} size={18} />
          <Text style={[styles.actionText, item.isRead && { color: "#10b981" }]}>
            {item.isRead ? "Done" : "Read"}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={[styles.actionButton, { borderRightWidth: 0 }]} 
          onPress={() => handleDeleteLink(item.id)}
        >
          <Trash2 color="#ef4444" size={18} />
          <Text style={[styles.actionText, { color: "#ef4444" }]}>Delete</Text>
        </TouchableOpacity>
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
          <Text style={styles.headerTitle}>LinkKeep</Text>
        </View>
        <TouchableOpacity onPress={() => setShowSettings(!showSettings)}>
          <Settings color="#64748b" size={24} />
        </TouchableOpacity>
      </View>

      <View style={{ flex: 1 }}>
        {showSettings ? (
          <View style={styles.settingsForm}>
            <Text style={styles.sectionTitle}>WebDAV Settings</Text>
            <TextInput 
              style={styles.input}
              placeholder="Nextcloud URL"
              autoCapitalize="none"
              value={config.url}
              onChangeText={(t) => setConfig({...config, url: t})}
            />
            <TextInput 
              style={styles.input}
              placeholder="Username"
              autoCapitalize="none"
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
            {loading && links.length === 0 ? (
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
                  <View style={styles.emptyContainer}>
                    <Link2 color="#cbd5e1" size={48} />
                    <Text style={styles.emptyText}>Your reading list is empty.</Text>
                  </View>
                }
              />
            )}
          </View>
        )}
      </View>

      {!showSettings && (
        <View style={styles.bottomBar}>
           <TouchableOpacity 
            style={styles.refreshButton} 
            onPress={() => fetchLinks(config)}
            disabled={loading}
          >
            <RefreshCw color="#2563eb" size={20} style={loading && { transform: [{ rotate: '45deg' }] }} />
            <Text style={styles.refreshText}>{loading ? "Syncing..." : "Sync Now"}</Text>
          </TouchableOpacity>
        </View>
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
    padding: 15,
    gap: 12,
  },
  card: {
    backgroundColor: "#fff",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    overflow: "hidden",
  },
  cardRead: {
    backgroundColor: "#f1f5f9",
    borderColor: "#cbd5e1",
    opacity: 0.8,
  },
  cardHeader: {
    padding: 15,
    flexDirection: "row",
    gap: 12,
    alignItems: "center",
  },
  cardIcon: {
    backgroundColor: "#eff6ff",
    padding: 8,
    borderRadius: 8,
  },
  cardContent: {
    flex: 1,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#1e293b",
  },
  textRead: {
    textDecorationLine: "line-through",
    color: "#64748b",
  },
  cardUrl: {
    fontSize: 12,
    color: "#64748b",
    marginTop: 2,
  },
  cardActions: {
    flexDirection: "row",
    borderTopWidth: 1,
    borderTopColor: "#f1f5f9",
    backgroundColor: "#fafafa",
  },
  actionButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
    gap: 6,
    borderRightWidth: 1,
    borderRightColor: "#f1f5f9",
  },
  actionText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#64748b",
  },
  emptyContainer: {
    alignItems: "center",
    justifyContent: "center",
    marginTop: 80,
    gap: 15,
  },
  emptyText: {
    color: "#94a3b8",
    fontSize: 16,
  },
  bottomBar: {
    padding: 15,
    backgroundColor: "#fff",
    borderTopWidth: 1,
    borderTopColor: "#e2e8f0",
  },
  refreshButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    padding: 12,
    backgroundColor: "#eff6ff",
    borderRadius: 10,
  },
  refreshText: {
    color: "#2563eb",
    fontWeight: "700",
  }
});
