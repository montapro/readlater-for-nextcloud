import React, { useMemo } from "react";
import { View, Text, FlatList, ActivityIndicator, StyleSheet, TouchableOpacity } from "react-native";
import { useReadLater } from "../context/ReadLaterContext";
import { useTheme } from "../hooks/useTheme";
import { LinkCard } from "./LinkCard";
import { FilterDropdown } from "./FilterDropdown";
import { CheckCheck, Trash2, Link2, RefreshCw } from "lucide-react-native";
import * as Haptics from "expo-haptics";

export function LinkList() {
  const { links, filter, sortBy, loading, refreshLinks, handleMarkAllRead, handleDeleteAll } = useReadLater();
  const { colors } = useTheme();

  const handleRefresh = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    return refreshLinks();
  };

  const processedLinks = useMemo(() => {
    let result = [...links];
    if (filter === "read") result = result.filter((l) => l.isRead);
    if (filter === "unread") result = result.filter((l) => !l.isRead);
    result.sort((a, b) => {
      if (sortBy === "newest") return new Date(b.addedAt).getTime() - new Date(a.addedAt).getTime();
      if (sortBy === "oldest") return new Date(a.addedAt).getTime() - new Date(b.addedAt).getTime();
      if (sortBy === "alpha") return a.title.localeCompare(b.title);
      return 0;
    });
    return result;
  }, [links, filter, sortBy]);

  if (loading && links.length === 0) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 40 }} />
      </View>
    );
  }

  const hasUnreadValue = links.some((l) => !l.isRead);

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <View
        style={[
          styles.listHeader,
          { borderBottomColor: colors.border, backgroundColor: colors.background },
        ]}
      >
        <FilterDropdown />
        <View style={styles.batchActions}>
          <TouchableOpacity
            onPress={handleMarkAllRead}
            disabled={!hasUnreadValue}
            style={{ opacity: hasUnreadValue ? 1 : 0.3 }}
          >
            <CheckCheck color={colors.textSecondary} size={20} />
          </TouchableOpacity>
          <TouchableOpacity onPress={handleDeleteAll}>
            <Trash2 color={colors.textSecondary} size={20} />
          </TouchableOpacity>
          <TouchableOpacity onPress={handleRefresh} disabled={loading}>
            <RefreshCw color={colors.textSecondary} size={20} />
          </TouchableOpacity>
        </View>
      </View>

      <FlatList
        data={processedLinks}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <LinkCard link={item} />}
        contentContainerStyle={styles.listContainer}
        refreshing={loading}
        onRefresh={handleRefresh}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Link2 color={colors.textMuted} size={48} />
            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
              {filter === "all"
                ? "Your reading list is empty."
                : "No matching links found."}
            </Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  listContainer: {
    paddingTop: 0,
    paddingBottom: 6,
    gap: 6,
    flexGrow: 1,
  },
  listHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 15,
    paddingTop: 10,
    paddingBottom: 8,
    borderBottomWidth: 1,
  },
  batchActions: {
    flexDirection: "row",
    gap: 16,
  },
  emptyContainer: {
    alignItems: "center",
    justifyContent: "center",
    marginTop: 80,
    gap: 15,
  },
  emptyText: {
    fontSize: 16,
  },
});
