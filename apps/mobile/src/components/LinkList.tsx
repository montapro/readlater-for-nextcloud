import React from "react";
import { View, Text, FlatList, ActivityIndicator, StyleSheet } from "react-native";
import { useReadLater } from "../context/ReadLaterContext";
import { useTheme } from "../hooks/useTheme";
import { LinkCard } from "./LinkCard";
import { Link2 } from "lucide-react-native";

export function LinkList() {
  const { links, loading, refreshLinks } = useReadLater();
  const { colors } = useTheme();

  if (loading && links.length === 0) {
    return <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 40 }} />;
  }

  return (
    <FlatList
      data={links}
      keyExtractor={(item) => item.id}
      renderItem={({ item }) => <LinkCard link={item} />}
      contentContainerStyle={[styles.listContainer, { backgroundColor: colors.background }]}
      refreshing={loading}
      onRefresh={refreshLinks}
      ListEmptyComponent={
        <View style={styles.emptyContainer}>
          <Link2 color={colors.textMuted} size={48} />
          <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
            Your reading list is empty.
          </Text>
        </View>
      }
    />
  );
}

const styles = StyleSheet.create({
  listContainer: {
    padding: 15,
    gap: 12,
    flexGrow: 1,
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
