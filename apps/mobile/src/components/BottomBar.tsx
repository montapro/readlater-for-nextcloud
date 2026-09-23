import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { useReadLater } from "../context/ReadLaterContext";
import { useTheme } from "../hooks/useTheme";
import { Home, Plus, RefreshCw, Settings } from "lucide-react-native";

export function BottomBar() {
  const {
    showSettings,
    setShowSettings,
    refreshLinks,
    loading,
    unreadCount,
    setShowAddModal,
  } = useReadLater();
  const { colors } = useTheme();

  const activeColor = (active: boolean) =>
    active ? colors.primary : colors.textMuted;

  return (
    <View
      style={[
        styles.bottomBar,
        { backgroundColor: colors.card, borderTopColor: colors.border },
      ]}
    >
      <TouchableOpacity
        style={[
          styles.tabButton,
          !showSettings && { backgroundColor: colors.tabActiveBg },
        ]}
        onPress={() => setShowSettings(false)}
      >
        <View>
          <Home color={activeColor(!showSettings)} size={24} />
          {unreadCount > 0 && (
            <View style={[styles.badge, { backgroundColor: colors.primary }]}>
              <Text style={styles.badgeText}>
                {unreadCount > 99 ? "99+" : unreadCount}
              </Text>
            </View>
          )}
        </View>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.tabButton}
        onPress={() => setShowAddModal(true)}
      >
        <View style={[styles.addCircle, { backgroundColor: colors.primary }]}>
          <Plus color="#fff" size={22} />
        </View>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.tabButton}
        onPress={refreshLinks}
        disabled={loading}
      >
        <RefreshCw color={colors.textSecondary} size={24} />
      </TouchableOpacity>

      <TouchableOpacity
        style={[
          styles.tabButton,
          showSettings && { backgroundColor: colors.tabActiveBg },
        ]}
        onPress={() => setShowSettings(true)}
      >
        <Settings color={activeColor(showSettings)} size={24} />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  bottomBar: {
    flexDirection: "row",
    borderTopWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 8,
    gap: 6,
  },
  tabButton: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
    borderRadius: 10,
  },
  addCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
  },
  badge: {
    position: "absolute",
    top: -6,
    right: -10,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    paddingHorizontal: 4,
    alignItems: "center",
    justifyContent: "center",
  },
  badgeText: {
    color: "#fff",
    fontSize: 10,
    fontWeight: "700",
  },
});
