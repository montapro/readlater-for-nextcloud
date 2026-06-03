import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { useReadLater } from "../context/ReadLaterContext";
import { useTheme } from "../hooks/useTheme";
import { Link2, Settings } from "lucide-react-native";

export function Header() {
  const { showSettings, setShowSettings } = useReadLater();
  const { colors } = useTheme();

  return (
    <View style={[styles.header, { backgroundColor: colors.headerBg, borderBottomColor: colors.headerBorder }]}>
      <View style={styles.titleRow}>
        <View style={[styles.logo, { backgroundColor: colors.primary }]}>
          <Link2 color="#fff" size={20} />
        </View>
        <Text style={[styles.title, { color: colors.text }]}>ReadLater</Text>
      </View>
      <TouchableOpacity onPress={() => setShowSettings(!showSettings)}>
        <Settings color={colors.textSecondary} size={24} />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: 20,
    paddingVertical: 15,
    borderBottomWidth: 1,
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
  },
  logo: {
    padding: 6,
    borderRadius: 8,
  },
});
