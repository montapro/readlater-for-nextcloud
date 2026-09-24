import React, { useState } from "react";
import { View, Text, TouchableOpacity, Modal, StyleSheet } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import { ChevronDown, Check } from "lucide-react-native";
import { useReadLater } from "../context/ReadLaterContext";
import { useTheme } from "../hooks/useTheme";
import type { FilterType, SortType } from "../types";

const FILTERS: FilterType[] = ["unread", "read", "all"];
const SORTS: SortType[] = ["newest", "oldest", "alpha"];

const FILTER_LABELS: Record<FilterType, string> = {
  unread: "Unread",
  read: "Read",
  all: "All",
};

const SORT_LABELS: Record<SortType, string> = {
  newest: "Newest",
  oldest: "Oldest",
  alpha: "A-Z",
};

interface OptionRowProps {
  label: string;
  selected: boolean;
  onPress: () => void;
}

function OptionRow({ label, selected, onPress }: OptionRowProps) {
  const { colors } = useTheme();
  return (
    <TouchableOpacity style={styles.optionRow} onPress={onPress}>
      <Text style={[styles.optionLabel, { color: colors.text }]}>{label}</Text>
      {selected && <Check color={colors.primary} size={18} />}
    </TouchableOpacity>
  );
}

export function FilterSortMenu() {
  const { links, filter, setFilter, sortBy, setSortBy } = useReadLater();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [visible, setVisible] = useState(false);
  const [draftFilter, setDraftFilter] = useState<FilterType>(filter);
  const [draftSort, setDraftSort] = useState<SortType>(sortBy);

  const counts: Record<FilterType, number> = {
    unread: links.filter((l) => !l.isRead).length,
    read: links.filter((l) => l.isRead).length,
    all: links.length,
  };

  const open = () => {
    setDraftFilter(filter);
    setDraftSort(sortBy);
    setVisible(true);
  };

  const close = () => setVisible(false);

  const save = () => {
    Haptics.selectionAsync().catch(() => {});
    setFilter(draftFilter);
    setSortBy(draftSort);
    setVisible(false);
  };

  const pickFilter = (value: FilterType) => {
    Haptics.selectionAsync().catch(() => {});
    setDraftFilter(value);
  };

  const pickSort = (value: SortType) => {
    Haptics.selectionAsync().catch(() => {});
    setDraftSort(value);
  };

  return (
    <>
      <TouchableOpacity style={styles.trigger} onPress={open}>
        <Text style={[styles.triggerText, { color: colors.primary }]}>
          {FILTER_LABELS[filter].toUpperCase()}
        </Text>
        <Text style={[styles.pipe, { color: colors.textMuted }]}>|</Text>
        <Text style={[styles.triggerText, { color: colors.primary }]}>
          {SORT_LABELS[sortBy].toUpperCase()}
        </Text>
        <ChevronDown color={colors.primary} size={14} />
      </TouchableOpacity>

      <Modal
        visible={visible}
        transparent
        animationType="slide"
        onRequestClose={close}
      >
        <View style={styles.overlay}>
          <TouchableOpacity
            style={styles.backdrop}
            activeOpacity={1}
            onPress={close}
          />
          <View
            style={[
              styles.sheet,
              {
                backgroundColor: colors.card,
                paddingBottom: Math.max(insets.bottom, 12),
              },
            ]}
          >
            <Text style={[styles.heading, { color: colors.textMuted }]}>
              Filter
            </Text>
            {FILTERS.map((value) => (
              <OptionRow
                key={value}
                label={`${FILTER_LABELS[value]} (${counts[value]})`}
                selected={draftFilter === value}
                onPress={() => pickFilter(value)}
              />
            ))}

            <View style={[styles.divider, { backgroundColor: colors.border }]} />

            <Text style={[styles.heading, { color: colors.textMuted }]}>
              Sort
            </Text>
            {SORTS.map((value) => (
              <OptionRow
                key={value}
                label={SORT_LABELS[value]}
                selected={draftSort === value}
                onPress={() => pickSort(value)}
              />
            ))}

            <View style={[styles.divider, { backgroundColor: colors.border }]} />

            <View style={styles.actions}>
              <TouchableOpacity
                style={[styles.cancelButton, { borderColor: colors.border }]}
                onPress={close}
              >
                <Text style={[styles.cancelText, { color: colors.textSecondary }]}>
                  Cancel
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.saveButton, { backgroundColor: colors.primary }]}
                onPress={save}
              >
                <Text style={styles.saveText}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  trigger: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  triggerText: {
    fontSize: 12,
    fontWeight: "700",
  },
  pipe: {
    fontSize: 12,
    fontWeight: "600",
  },
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  backdrop: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  sheet: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 20,
    paddingTop: 18,
  },
  heading: {
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
    marginBottom: 2,
  },
  optionRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    minHeight: 44,
    paddingVertical: 4,
  },
  optionLabel: {
    fontSize: 15,
    fontWeight: "500",
  },
  divider: {
    height: 1,
    marginVertical: 10,
  },
  actions: {
    flexDirection: "row",
    gap: 10,
    marginTop: 6,
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
    padding: 14,
    borderRadius: 10,
    alignItems: "center",
  },
  saveText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 15,
  },
});
