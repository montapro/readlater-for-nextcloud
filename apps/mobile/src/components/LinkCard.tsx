import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { Link as LinkType } from "@readlater/core";
import { useReadLater } from "../context/ReadLaterContext";
import { Link2, ExternalLink, CheckCircle, Trash2 } from "lucide-react-native";

interface Props {
  link: LinkType;
}

export function LinkCard({ link }: Props) {
  const { handleOpenLink, handleToggleRead, handleDeleteLink } =
    useReadLater();

  return (
    <View style={[styles.card, link.isRead && styles.cardRead]}>
      <View style={styles.cardHeader}>
        <View style={styles.cardIcon}>
          <Link2 color={link.isRead ? "#94a3b8" : "#2563eb"} size={20} />
        </View>
        <View style={styles.cardContent}>
          <Text
            style={[styles.cardTitle, link.isRead && styles.textRead]}
            numberOfLines={1}
          >
            {link.title}
          </Text>
          <Text style={styles.cardUrl} numberOfLines={1}>
            {link.url}
          </Text>
        </View>
      </View>

      <View style={styles.cardActions}>
        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => handleOpenLink(link.url)}
        >
          <ExternalLink color="#64748b" size={18} />
          <Text style={styles.actionText}>Open</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => handleToggleRead(link.id, link.isRead)}
        >
          <CheckCircle
            color={link.isRead ? "#10b981" : "#64748b"}
            size={18}
          />
          <Text style={[styles.actionText, link.isRead && { color: "#10b981" }]}>
            {link.isRead ? "Done" : "Read"}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.actionButton, { borderRightWidth: 0 }]}
          onPress={() => handleDeleteLink(link.id)}
        >
          <Trash2 color="#ef4444" size={18} />
          <Text style={[styles.actionText, { color: "#ef4444" }]}>Delete</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#fff",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    overflow: "hidden",
  },
  cardRead: {
    backgroundColor: "#f1f5f9",
    borderColor: "#cbd5e1",
    opacity: 0.8,
  },
  cardHeader: {
    padding: 15,
    flexDirection: "row",
    gap: 12,
    alignItems: "center",
  },
  cardIcon: {
    backgroundColor: "#eff6ff",
    padding: 8,
    borderRadius: 8,
  },
  cardContent: {
    flex: 1,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#1e293b",
  },
  textRead: {
    textDecorationLine: "line-through",
    color: "#64748b",
  },
  cardUrl: {
    fontSize: 12,
    color: "#64748b",
    marginTop: 2,
  },
  cardActions: {
    flexDirection: "row",
    borderTopWidth: 1,
    borderTopColor: "#f1f5f9",
    backgroundColor: "#fafafa",
  },
  actionButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
    gap: 6,
    borderRightWidth: 1,
    borderRightColor: "#f1f5f9",
  },
  actionText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#64748b",
  },
});
