import React from "react";
import { View, Text, FlatList, ActivityIndicator, StyleSheet } from "react-native";
import { useReadLater } from "../context/ReadLaterContext";
import { LinkCard } from "./LinkCard";
import { Link2 } from "lucide-react-native";

export function LinkList() {
  const { links, loading, refreshLinks } = useReadLater();

  if (loading && links.length === 0) {
    return (
      <ActivityIndicator
        size="large"
        color="#2563eb"
        style={{ marginTop: 40 }}
      />
    );
  }

  return (
    <FlatList
      data={links}
      keyExtractor={(item) => item.id}
      renderItem={({ item }) => <LinkCard link={item} />}
      contentContainerStyle={styles.listContainer}
      refreshing={loading}
      onRefresh={refreshLinks}
      ListEmptyComponent={
        <View style={styles.emptyContainer}>
          <Link2 color="#cbd5e1" size={48} />
          <Text style={styles.emptyText}>Your reading list is empty.</Text>
        </View>
      }
    />
  );
}

const styles = StyleSheet.create({
  listContainer: {
    padding: 15,
    gap: 12,
  },
  emptyContainer: {
    alignItems: "center",
    justifyContent: "center",
    marginTop: 80,
    gap: 15,
  },
  emptyText: {
    color: "#94a3b8",
    fontSize: 16,
  },
});
