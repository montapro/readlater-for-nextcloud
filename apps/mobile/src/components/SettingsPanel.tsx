import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
} from "react-native";
import { useReadLater } from "../context/ReadLaterContext";
import { useTheme } from "../hooks/useTheme";
import type { ThemeType } from "../types";
import { normalizeBasePath } from "../utils/loginFlow";
import { Cloud, FolderTree, Wifi, LogOut, Save } from "lucide-react-native";

const THEME_OPTIONS: { value: ThemeType; label: string }[] = [
  { value: "system", label: "System" },
  { value: "dark", label: "Dark" },
  { value: "light", label: "Light" },
];

export function SettingsPanel() {
  const {
    config,
    isConfigured,
    loginStatus,
    connectToNextcloud,
    disconnect,
    setBasePath,
    testConnection,
    testingConnection,
    isUrlValid,
    theme,
    setTheme,
    loading,
  } = useReadLater();
  const { colors } = useTheme();

  const [instance, setInstance] = useState("");
  const [basePathInput, setBasePathInput] = useState(config.basePath);

  useEffect(() => {
    if (config.server) {
      setInstance(config.server.replace(/^https?:\/\//, ""));
    }
  }, [config.server]);

  useEffect(() => {
    setBasePathInput(config.basePath);
  }, [config.basePath]);

  const connecting = loginStatus !== "idle";
  const canConnect =
    !connecting && instance.trim().length > 0 && basePathInput.trim().length > 0;
  const isPathDirty =
    basePathInput.trim().length > 0 &&
    basePathInput !== config.basePath &&
    normalizeBasePath(basePathInput) !== config.basePath;

  const loginLabel: Record<typeof loginStatus, string> = {
    idle: "Connect to Nextcloud",
    connecting: "Starting…",
    waiting: "Waiting for approval…",
    finishing: "Finishing…",
  };

  const handleConnect = () => {
    if (!canConnect) return;
    connectToNextcloud(instance, basePathInput);
  };

  const handleSavePath = async () => {
    await setBasePath(basePathInput);
    setBasePathInput(normalizeBasePath(basePathInput));
  };

  return (
    <View style={[styles.form, { backgroundColor: colors.background }]}>
      <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>
        Nextcloud Connection
      </Text>

      {isConfigured ? (
        <>
          <View
            style={[
              styles.connectedCard,
              { backgroundColor: colors.card, borderColor: colors.border },
            ]}
          >
            <View style={styles.connectedInfo}>
              <Text
                style={[styles.connectedServer, { color: colors.text }]}
                numberOfLines={1}
              >
                {config.server.replace(/^https?:\/\//, "")}
              </Text>
              <Text
                style={[styles.connectedMeta, { color: colors.textSecondary }]}
                numberOfLines={1}
              >
                {config.username} · /files/{config.uid}
                {config.basePath}
              </Text>
            </View>
            <TouchableOpacity
              onPress={disconnect}
              accessibilityLabel="Disconnect"
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <LogOut color={colors.textSecondary} size={18} />
            </TouchableOpacity>
          </View>

          <Text style={[styles.label, { color: colors.textSecondary }]}>
            Storage folder
          </Text>
          <View style={styles.inputRow}>
            <FolderTree
              color={colors.textMuted}
              size={16}
              style={styles.inputIcon}
            />
            <TextInput
              style={[
                styles.input,
                styles.inputWithIcon,
                {
                  backgroundColor: colors.inputBg,
                  borderColor: colors.inputBorder,
                  color: colors.text,
                },
              ]}
              placeholder="Folder in Nextcloud, e.g. AppSync (or / for root)"
              placeholderTextColor={colors.textMuted}
              autoCapitalize="none"
              autoCorrect={false}
              value={basePathInput}
              onChangeText={setBasePathInput}
              returnKeyType="done"
              onSubmitEditing={() => {
                if (isPathDirty) void handleSavePath();
              }}
            />
          </View>
          <Text style={[styles.hint, { color: colors.textMuted }]}>
            The folder you set must already exist on your Nextcloud filesystem.
          </Text>

          <View style={styles.buttonRow}>
            <TouchableOpacity
              style={[
                styles.testButton,
                { borderColor: colors.border },
                (testingConnection || loading || !isUrlValid) && styles.disabled,
              ]}
              onPress={testConnection}
              disabled={testingConnection || loading || !isUrlValid}
            >
              <Wifi color={colors.primary} size={18} />
              <Text style={[styles.testText, { color: colors.primary }]}>
                {testingConnection ? "Testing…" : "Test"}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.saveButton,
                { backgroundColor: colors.primary },
                (!isPathDirty || loading) && styles.disabled,
              ]}
              onPress={handleSavePath}
              disabled={!isPathDirty || loading}
            >
              <Save color="#fff" size={18} />
              <Text style={styles.buttonText}>
                {loading ? "Saving…" : "Save"}
              </Text>
            </TouchableOpacity>
          </View>
        </>
      ) : (
        <>
          <View style={styles.inputRow}>
            <Cloud
              color={colors.textMuted}
              size={16}
              style={styles.inputIcon}
            />
            <TextInput
              style={[
                styles.input,
                styles.inputWithIcon,
                {
                  backgroundColor: colors.inputBg,
                  borderColor: colors.inputBorder,
                  color: colors.text,
                },
              ]}
              placeholder="cloud.example.com"
              placeholderTextColor={colors.textMuted}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
              value={instance}
              onChangeText={setInstance}
              returnKeyType="next"
            />
          </View>

          <View style={styles.inputRow}>
            <FolderTree
              color={colors.textMuted}
              size={16}
              style={styles.inputIcon}
            />
            <TextInput
              style={[
                styles.input,
                styles.inputWithIcon,
                {
                  backgroundColor: colors.inputBg,
                  borderColor: colors.inputBorder,
                  color: colors.text,
                },
              ]}
              placeholder="Folder in Nextcloud, e.g. AppSync (or / for root)"
              placeholderTextColor={colors.textMuted}
              autoCapitalize="none"
              autoCorrect={false}
              value={basePathInput}
              onChangeText={setBasePathInput}
              returnKeyType="done"
              onSubmitEditing={handleConnect}
            />
          </View>

          <TouchableOpacity
            style={[
              styles.connectButton,
              { backgroundColor: colors.primary },
              !canConnect && styles.disabled,
            ]}
            onPress={handleConnect}
            disabled={!canConnect}
          >
            {connecting ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Cloud color="#fff" size={18} />
            )}
            <Text style={styles.buttonText}>{loginLabel[loginStatus]}</Text>
          </TouchableOpacity>

          <Text style={[styles.hint, { color: colors.textMuted }]}>
            A Nextcloud tab opens where you sign in and grant access. No
            password is stored in the app.
          </Text>
        </>
      )}

      <View style={[styles.appearanceSection, { borderTopColor: colors.border }]}>
        <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>
          Appearance
        </Text>
        <View style={styles.appearanceOptions}>
          {THEME_OPTIONS.map((option) => {
            const active = theme === option.value;
            return (
              <TouchableOpacity
                key={option.value}
                onPress={() => setTheme(option.value)}
                style={[
                  styles.appearanceChip,
                  {
                    backgroundColor: active ? colors.primary : colors.inputBg,
                    borderColor: active ? colors.primary : colors.inputBorder,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.appearanceChipText,
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
  inputRow: {
    position: "relative",
    justifyContent: "center",
  },
  inputIcon: {
    position: "absolute",
    left: 12,
    zIndex: 1,
  },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    fontSize: 15,
  },
  inputWithIcon: {
    paddingLeft: 36,
  },
  hint: {
    fontSize: 11,
    fontWeight: "500",
  },
  connectedCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  connectedInfo: {
    flex: 1,
    marginRight: 8,
  },
  connectedServer: {
    fontSize: 15,
    fontWeight: "600",
  },
  connectedMeta: {
    fontSize: 12,
    marginTop: 2,
  },
  buttonRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 12,
  },
  connectButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    padding: 14,
    borderRadius: 8,
    gap: 8,
    marginTop: 8,
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
  disabled: {
    opacity: 0.5,
  },
  appearanceSection: {
    borderTopWidth: 1,
    paddingTop: 16,
    marginTop: 8,
  },
  appearanceOptions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  appearanceChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
  },
  appearanceChipText: {
    fontSize: 13,
    fontWeight: "600",
  },
});
