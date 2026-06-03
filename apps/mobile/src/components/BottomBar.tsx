import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { useReadLater } from "../context/ReadLaterContext";
import { useTheme } from "../hooks/useTheme";
import { RefreshCw } from "lucide-react-native";

export function BottomBar() {
  const { refreshLinks, loading } = useReadLater();
  const { colors } = useTheme();

  return (
    <View style={[styles.bottomBar, { backgroundColor: colors.card, borderTopColor: colors.border }]}>
      <TouchableOpacity
        style={[styles.refreshButton, { backgroundColor: colors.buttonBg }]}
        onPress={refreshLinks}
        disabled={loading}
      >
        <RefreshCw color={colors.primary} size={20} style={loading ? { transform: [{ rotate: "45deg" }] } : undefined} />
        <Text style={[styles.refreshText, { color: colors.primary }]}>
          {loading ? "Syncing..." : "Sync Now"}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  bottomBar: {
    padding: 15,
    borderTopWidth: 1,
  },
  refreshButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    padding: 12,
    borderRadius: 10,
  },
  refreshText: {
    fontWeight: "700",
  },
});
