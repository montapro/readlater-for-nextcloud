import React from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Platform,
} from "react-native";
import { useReadLater } from "../context/ReadLaterContext";
import { useTheme } from "../hooks/useTheme";
import type { ThemeType } from "../types";
import { Save, Wifi } from "lucide-react-native";

const THEME_OPTIONS: { value: ThemeType; label: string }[] = [
  { value: "system", label: "System" },
  { value: "dark", label: "Dark" },
  { value: "light", label: "Light" },
];

export function SettingsPanel() {
  const {
    config,
    updateConfig,
    saveSettings,
    testConnection,
    testingConnection,
    isUrlValid,
    theme,
    setTheme,
  } = useReadLater();
  const { colors } = useTheme();
  const hasUrl = config.url.trim().length > 0;

  return (
    <View style={[styles.form, { backgroundColor: colors.background }]}>
      <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>
        WebDAV Settings
      </Text>

      <Text style={[styles.label, { color: colors.textSecondary }]}>
        WebDAV URL
      </Text>
      <TextInput
        style={[
          styles.input,
          {
            backgroundColor: colors.inputBg,
            borderColor: colors.inputBorder,
            color: colors.text,
          },
          hasUrl && !isUrlValid && { borderColor: colors.destructive },
        ]}
        placeholder="https://your-cloud.com/remote.php/dav/files/user/"
        placeholderTextColor={colors.textMuted}
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="url"
        value={config.url}
        onChangeText={(t) => updateConfig({ url: t })}
      />
      {hasUrl && !isUrlValid && (
        <Text style={[styles.hint, { color: colors.destructive }]}>
          URL must start with https://
        </Text>
      )}
      {Platform.OS === "web" && hasUrl && (
        <Text style={[styles.hint, { color: colors.textMuted }]}>
          Web requests are proxied – the URL host must match NEXTCLOUD_ORIGIN
          in netlify.toml.
        </Text>
      )}

      <Text style={[styles.label, { color: colors.textSecondary }]}>
        Username
      </Text>
      <TextInput
        style={[
          styles.input,
          {
            backgroundColor: colors.inputBg,
            borderColor: colors.inputBorder,
            color: colors.text,
          },
        ]}
        placeholder="Username"
        placeholderTextColor={colors.textMuted}
        autoCapitalize="none"
        value={config.username}
        onChangeText={(t) => updateConfig({ username: t })}
      />

      <Text style={[styles.label, { color: colors.textSecondary }]}>
        App Password
      </Text>
      <TextInput
        style={[
          styles.input,
          {
            backgroundColor: colors.inputBg,
            borderColor: colors.inputBorder,
            color: colors.text,
          },
        ]}
        placeholder="App Password"
        placeholderTextColor={colors.textMuted}
        secureTextEntry
        value={config.password}
        onChangeText={(t) => updateConfig({ password: t })}
      />

      <View style={styles.buttonRow}>
        <TouchableOpacity
          style={[
            styles.testButton,
            {
              borderColor: colors.border,
              opacity: isUrlValid ? 1 : 0.5,
            },
          ]}
          onPress={testConnection}
          disabled={!isUrlValid || testingConnection}
        >
          <Wifi
            color={colors.primary}
            size={18}
          />
          <Text style={[styles.testText, { color: colors.primary }]}>
            {testingConnection ? "Testing..." : "Test"}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.saveButton, { backgroundColor: colors.primary }]}
          onPress={saveSettings}
        >
          <Save color="#fff" size={18} />
          <Text style={styles.buttonText}>Save</Text>
        </TouchableOpacity>
      </View>

      <View style={[styles.refreshSection, { borderTopColor: colors.border }]}>
        <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>
          Appearance
        </Text>
        <View style={styles.refreshOptions}>
          {THEME_OPTIONS.map((option) => {
            const active = theme === option.value;
            return (
              <TouchableOpacity
                key={option.value}
                onPress={() => setTheme(option.value)}
                style={[
                  styles.refreshChip,
                  {
                    backgroundColor: active ? colors.primary : colors.inputBg,
                    borderColor: active ? colors.primary : colors.inputBorder,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.refreshChipText,
                    { color: active ? "#fff" : colors.textSecondary },
                  ]}
                >
                  {option.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  form: {
    flex: 1,
    padding: 20,
    gap: 8,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: "600",
    textTransform: "uppercase",
    marginBottom: 5,
  },
  label: {
    fontSize: 12,
    fontWeight: "600",
    marginTop: 4,
  },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    fontSize: 15,
  },
  hint: {
    fontSize: 11,
    fontWeight: "500",
  },
  buttonRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 12,
  },
  testButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    padding: 14,
    borderRadius: 8,
    borderWidth: 1,
    gap: 6,
  },
  testText: {
    fontWeight: "600",
    fontSize: 14,
  },
  saveButton: {
    flex: 2,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    padding: 14,
    borderRadius: 8,
    gap: 6,
  },
  buttonText: {
    color: "#fff",
    fontWeight: "bold",
    fontSize: 14,
  },
  refreshSection: {
    borderTopWidth: 1,
    paddingTop: 16,
    marginTop: 8,
  },
  refreshOptions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  refreshChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
  },
  refreshChipText: {
    fontSize: 13,
    fontWeight: "600",
  },
});
