import React from "react";
import { View, Text, TextInput, TouchableOpacity, StyleSheet } from "react-native";
import { useReadLater } from "../context/ReadLaterContext";
import { Save } from "lucide-react-native";

export function SettingsPanel() {
  const { config, updateConfig, saveSettings } = useReadLater();

  return (
    <View style={styles.form}>
      <Text style={styles.sectionTitle}>WebDAV Settings</Text>

      <TextInput
        style={styles.input}
        placeholder="Nextcloud URL"
        autoCapitalize="none"
        value={config.url}
        onChangeText={(t) => updateConfig({ url: t })}
      />

      <TextInput
        style={styles.input}
        placeholder="Username"
        autoCapitalize="none"
        value={config.username}
        onChangeText={(t) => updateConfig({ username: t })}
      />

      <TextInput
        style={styles.input}
        placeholder="App Password"
        secureTextEntry
        value={config.password}
        onChangeText={(t) => updateConfig({ password: t })}
      />

      <TouchableOpacity style={styles.button} onPress={saveSettings}>
        <Save color="#fff" size={20} />
        <Text style={styles.buttonText}>Save Configuration</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  form: {
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
});
