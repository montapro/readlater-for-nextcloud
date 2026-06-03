import React from "react";
import { View, Text, TextInput, TouchableOpacity, StyleSheet } from "react-native";
import { useReadLater } from "../context/ReadLaterContext";
import { useTheme } from "../hooks/useTheme";
import { Save } from "lucide-react-native";

export function SettingsPanel() {
  const { config, updateConfig, saveSettings } = useReadLater();
  const { colors } = useTheme();

  return (
    <View style={[styles.form, { backgroundColor: colors.background }]}>
      <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>WebDAV Settings</Text>

      <TextInput
        style={[styles.input, { backgroundColor: colors.inputBg, borderColor: colors.inputBorder, color: colors.text }]}
        placeholder="Nextcloud URL"
        placeholderTextColor={colors.textMuted}
        autoCapitalize="none"
        value={config.url}
        onChangeText={(t) => updateConfig({ url: t })}
      />

      <TextInput
        style={[styles.input, { backgroundColor: colors.inputBg, borderColor: colors.inputBorder, color: colors.text }]}
        placeholder="Username"
        placeholderTextColor={colors.textMuted}
        autoCapitalize="none"
        value={config.username}
        onChangeText={(t) => updateConfig({ username: t })}
      />

      <TextInput
        style={[styles.input, { backgroundColor: colors.inputBg, borderColor: colors.inputBorder, color: colors.text }]}
        placeholder="App Password"
        placeholderTextColor={colors.textMuted}
        secureTextEntry
        value={config.password}
        onChangeText={(t) => updateConfig({ password: t })}
      />

      <TouchableOpacity style={[styles.button, { backgroundColor: colors.primary }]} onPress={saveSettings}>
        <Save color="#fff" size={20} />
        <Text style={styles.buttonText}>Save Configuration</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  form: {
    flex: 1,
    padding: 20,
    gap: 15,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: "600",
    textTransform: "uppercase",
    marginBottom: 5,
  },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
  },
  button: {
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
