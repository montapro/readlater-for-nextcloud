import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { useReadLater } from "../context/ReadLaterContext";
import { Link2, Settings } from "lucide-react-native";

export function Header() {
  const { showSettings, setShowSettings } = useReadLater();

  return (
    <View style={styles.header}>
      <View style={styles.titleRow}>
        <View style={styles.logo}>
          <Link2 color="#fff" size={20} />
        </View>
        <Text style={styles.title}>ReadLater</Text>
      </View>
      <TouchableOpacity onPress={() => setShowSettings(!showSettings)}>
        <Settings color="#64748b" size={24} />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
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
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  title: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#0f172a",
  },
  logo: {
    backgroundColor: "#2563eb",
    padding: 6,
    borderRadius: 8,
  },
});
