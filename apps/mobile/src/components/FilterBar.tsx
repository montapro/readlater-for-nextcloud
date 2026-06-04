import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { useReadLater } from "../context/ReadLaterContext";
import type { FilterType, SortType } from "../types";
import { useTheme } from "../hooks/useTheme";
import { Plus } from "lucide-react-native";

const filters: FilterType[] = ["all", "unread", "read"];
const sortOptions: { value: SortType; label: string }[] = [
  { value: "newest", label: "Newest" },
  { value: "oldest", label: "Oldest" },
  { value: "alpha", label: "A-Z" },
];

export function FilterBar() {
  const { filter, setFilter, sortBy, setSortBy, setShowAddModal } = useReadLater();
  const { colors } = useTheme();

  return (
    <View style={[styles.container, { backgroundColor: colors.background, borderBottomColor: colors.border }]}>
      {/* First row: Add button */}
      <TouchableOpacity
        style={[styles.addButton, { backgroundColor: colors.buttonBg }]}
        onPress={() => setShowAddModal(true)}
      >
        <Plus color={colors.primary} size={18} />
        <Text style={[styles.addText, { color: colors.primary }]}>Add Link</Text>
      </TouchableOpacity>

      {/* Second row: Filter buttons + Sort */}
      <View style={styles.row}>
        <View style={styles.filterRow}>
          {filters.map((f) => (
            <TouchableOpacity
              key={f}
              onPress={() => setFilter(f)}
              style={[
                styles.filterChip,
                {
                  backgroundColor: filter === f ? colors.primary : colors.card,
                  borderColor: filter === f ? colors.primary : colors.border,
                },
              ]}
            >
              <Text
                style={[
                  styles.filterText,
                  { color: filter === f ? "#fff" : colors.textSecondary },
                ]}
              >
                {f}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={[styles.sortWrapper, { borderLeftColor: colors.border }]}>
          <TouchableOpacity
            onPress={() => {
              const idx = sortOptions.findIndex((o) => o.value === sortBy);
              setSortBy(sortOptions[(idx + 1) % sortOptions.length].value);
            }}
          >
            <Text style={[styles.sortText, { color: colors.primary }]}>
              {sortOptions.find((o) => o.value === sortBy)?.label}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 15,
    paddingVertical: 10,
    borderBottomWidth: 1,
    gap: 8,
  },
  addButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 10,
    borderRadius: 8,
  },
  addText: {
    fontWeight: "700",
    fontSize: 14,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  filterRow: {
    flexDirection: "row",
    gap: 6,
    flex: 1,
  },
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 16,
    borderWidth: 1,
  },
  filterText: {
    fontSize: 12,
    fontWeight: "700",
    textTransform: "capitalize",
  },
  sortWrapper: {
    borderLeftWidth: 1,
    paddingLeft: 10,
  },
  sortText: {
    fontSize: 12,
    fontWeight: "700",
  },
});
