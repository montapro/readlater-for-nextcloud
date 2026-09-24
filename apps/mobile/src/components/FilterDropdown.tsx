import React from "react";
import { TouchableOpacity, Text, StyleSheet, ActionSheetIOS, Platform } from "react-native";
import { useReadLater } from "../context/ReadLaterContext";
import { useTheme } from "../hooks/useTheme";
import type { FilterType } from "../types";
import { ChevronDown } from "lucide-react-native";

const ORDER: FilterType[] = ["unread", "read", "all"];

export function FilterDropdown() {
  const { links, filter, setFilter } = useReadLater();
  const { colors } = useTheme();

  const unreadCount = links.filter((l) => !l.isRead).length;
  const readCount = links.length - unreadCount;
  const allCount = links.length;

  const labels: Record<FilterType, string> = {
    unread: `Unread (${unreadCount})`,
    read: `Read (${readCount})`,
    all: `All (${allCount})`,
  };

  const handlePress = () => {
    if (Platform.OS !== "ios") return;
    const options = ORDER.map((f) => labels[f]);
    ActionSheetIOS.showActionSheetWithOptions(
      {
        options: [...options, "Cancel"],
        cancelButtonIndex: options.length,
      },
      (index) => {
        if (index >= 0 && index < ORDER.length) {
          setFilter(ORDER[index]);
        }
      }
    );
  };

  return (
    <TouchableOpacity style={styles.button} onPress={handlePress}>
      <Text style={[styles.label, { color: colors.primary }]}>
        {labels[filter]}
      </Text>
      <ChevronDown color={colors.primary} size={14} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  label: {
    fontSize: 12,
    fontWeight: "700",
    textTransform: "uppercase",
  },
});
