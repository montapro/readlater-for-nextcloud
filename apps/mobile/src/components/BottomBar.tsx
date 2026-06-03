import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { useReadLater } from "../context/ReadLaterContext";
import { RefreshCw } from "lucide-react-native";

export function BottomBar() {
  const { refreshLinks, loading } = useReadLater();

  return (
    <View style={styles.bottomBar}>
      <TouchableOpacity
        style={styles.refreshButton}
        onPress={refreshLinks}
        disabled={loading}
      >
        <RefreshCw color="#2563eb" size={20} />
        <Text style={styles.refreshText}>
          {loading ? "Syncing..." : "Sync Now"}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
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
  },
});
