import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Modal,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { useReadLater } from "../context/ReadLaterContext";
import { useTheme } from "../hooks/useTheme";
import { Save, X } from "lucide-react-native";

export function AddLinkModal() {
  const { showAddModal, setShowAddModal, handleAddLink } = useReadLater();
  const { colors } = useTheme();
  const [url, setUrl] = useState("");
  const [title, setTitle] = useState("");

  const handleSave = async () => {
    const trimmedUrl = url.trim();
    if (!trimmedUrl) return;
    await handleAddLink(trimmedUrl, title.trim() || undefined);
    setUrl("");
    setTitle("");
  };

  const handleClose = () => {
    setShowAddModal(false);
    setUrl("");
    setTitle("");
  };

  return (
    <Modal
      visible={showAddModal}
      transparent
      animationType="slide"
      onRequestClose={handleClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.overlay}
      >
        <View style={[styles.dialog, { backgroundColor: colors.card }]}>
          {/* Header */}
          <View style={styles.dialogHeader}>
            <Text style={[styles.dialogTitle, { color: colors.text }]}>
              Save a Link
            </Text>
            <TouchableOpacity onPress={handleClose}>
              <X color={colors.textSecondary} size={22} />
            </TouchableOpacity>
          </View>

          {/* URL input */}
          <Text style={[styles.label, { color: colors.textSecondary }]}>URL *</Text>
          <TextInput
            style={[
              styles.input,
              {
                backgroundColor: colors.background,
                borderColor: colors.inputBorder,
                color: colors.text,
              },
            ]}
            placeholder="https://example.com/article"
            placeholderTextColor={colors.textMuted}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
            autoFocus
            value={url}
            onChangeText={setUrl}
          />

          {/* Title input */}
          <Text style={[styles.label, { color: colors.textSecondary }]}>Title</Text>
          <TextInput
            style={[
              styles.input,
              {
                backgroundColor: colors.background,
                borderColor: colors.inputBorder,
                color: colors.text,
              },
            ]}
            placeholder="Article title (optional)"
            placeholderTextColor={colors.textMuted}
            value={title}
            onChangeText={setTitle}
          />

          {/* Actions */}
          <View style={styles.actions}>
            <TouchableOpacity
              style={[styles.cancelButton, { borderColor: colors.border }]}
              onPress={handleClose}
            >
              <Text style={[styles.cancelText, { color: colors.textSecondary }]}>
                Cancel
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.saveButton,
                { backgroundColor: colors.primary, opacity: url.trim() ? 1 : 0.5 },
              ]}
              onPress={handleSave}
              disabled={!url.trim()}
            >
              <Save color="#fff" size={18} />
              <Text style={styles.saveText}>Save Link</Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  dialog: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 24,
    gap: 12,
  },
  dialogHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  dialogTitle: {
    fontSize: 18,
    fontWeight: "bold",
  },
  label: {
    fontSize: 12,
    fontWeight: "600",
    textTransform: "uppercase",
  },
  input: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 14,
    fontSize: 15,
  },
  actions: {
    flexDirection: "row",
    gap: 10,
    marginTop: 8,
  },
  cancelButton: {
    flex: 1,
    padding: 14,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: "center",
  },
  cancelText: {
    fontWeight: "600",
    fontSize: 15,
  },
  saveButton: {
    flex: 2,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    padding: 14,
    borderRadius: 10,
    gap: 8,
  },
  saveText: {
    color: "#fff",
    fontWeight: "bold",
    fontSize: 15,
  },
});
