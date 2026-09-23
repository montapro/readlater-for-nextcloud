import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Modal,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from "react-native";
import { useReadLater } from "../context/ReadLaterContext";
import { useTheme } from "../hooks/useTheme";
import { Save, X, CloudDownload } from "lucide-react-native";
import { fetchPageMetadata } from "../utils/metadata";

function normalizeUrl(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return trimmed;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

export function AddLinkModal() {
  const {
    showAddModal,
    setShowAddModal,
    handleAddLink,
    editingLink,
    setEditingLink,
    handleUpdateLink,
  } = useReadLater();
  const { colors } = useTheme();
  const [url, setUrl] = useState("");
  const [title, setTitle] = useState("");
  const [isFetching, setIsFetching] = useState(false);
  const [saveError, setSaveError] = useState("");

  const isEditing = editingLink !== null;

  // Pre-fill the form when opening for editing, reset otherwise
  useEffect(() => {
    if (editingLink) {
      setUrl(editingLink.url);
      setTitle(editingLink.title);
    } else {
      setUrl("");
      setTitle("");
    }
    setSaveError("");
    setIsFetching(false);
  }, [editingLink, showAddModal]);

  const handleFetch = async () => {
    const trimmedUrl = normalizeUrl(url);
    if (!trimmedUrl || isFetching) return;
    setIsFetching(true);
    try {
      const meta = await fetchPageMetadata(trimmedUrl);
      if (meta.title) {
        setTitle(meta.title);
      }
    } finally {
      setIsFetching(false);
    }
  };

  const handleSave = async () => {
    const trimmedUrl = normalizeUrl(url);
    if (!trimmedUrl) return;
    setSaveError("");
    const result = editingLink
      ? await handleUpdateLink(editingLink.id, {
          url: trimmedUrl,
          title: title.trim() || trimmedUrl,
        })
      : await handleAddLink(trimmedUrl, title.trim() || undefined);
    if (result.ok) {
      setUrl("");
      setTitle("");
      setEditingLink(null);
    } else {
      setSaveError("Invalid URL");
    }
  };

  const handleClose = () => {
    setShowAddModal(false);
    setUrl("");
    setTitle("");
    setSaveError("");
    setEditingLink(null);
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
              {isEditing ? "Edit Link" : "Save a Link"}
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
            clearButtonMode="while-editing"
            value={url}
            onChangeText={(t) => {
              setUrl(t);
              setSaveError("");
            }}
          />
          {saveError ? (
            <Text style={[styles.errorHint, { color: colors.destructive }]}>
              {saveError}
            </Text>
          ) : null}

          {/* Title input */}
          <Text style={[styles.label, { color: colors.textSecondary }]}>Title</Text>
          <View style={styles.titleRow}>
            <TextInput
              style={[
                styles.input,
                {
                  flex: 1,
                  backgroundColor: colors.background,
                  borderColor: colors.inputBorder,
                  color: colors.text,
                },
              ]}
              placeholder="Article title (optional)"
              placeholderTextColor={colors.textMuted}
              clearButtonMode="while-editing"
              value={title}
              onChangeText={setTitle}
            />
            <TouchableOpacity
              style={[
                styles.fetchButton,
                {
                  backgroundColor: colors.inputBg,
                  borderColor: colors.inputBorder,
                  opacity: url.trim() && !isFetching ? 1 : 0.4,
                },
              ]}
              onPress={handleFetch}
              disabled={!url.trim() || isFetching}
            >
              {isFetching ? (
                <ActivityIndicator size="small" color={colors.primary} />
              ) : (
                <CloudDownload color={colors.primary} size={20} />
              )}
            </TouchableOpacity>
          </View>

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
              <Text style={styles.saveText}>
                {isEditing ? "Update Link" : "Save Link"}
              </Text>
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
  errorHint: {
    fontSize: 12,
    fontWeight: "500",
    marginTop: -4,
  },
  titleRow: {
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
  },
  fetchButton: {
    width: 48,
    height: 48,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
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
