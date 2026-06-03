import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { Link as LinkType } from "@readlater/core";
import { useReadLater } from "../context/ReadLaterContext";
import { useTheme } from "../hooks/useTheme";
import { Link2, ExternalLink, CheckCircle, Trash2 } from "lucide-react-native";

interface Props {
  link: LinkType;
}

export function LinkCard({ link }: Props) {
  const { handleOpenLink, handleToggleRead, handleDeleteLink } = useReadLater();
  const { colors } = useTheme();

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: link.isRead ? colors.cardRead : colors.card,
          borderColor: link.isRead ? colors.border : colors.border,
          opacity: link.isRead ? 0.8 : 1,
        },
      ]}
    >
      <View style={styles.cardHeader}>
        <View style={[styles.cardIcon, { backgroundColor: colors.iconBg }]}>
          <Link2 color={link.isRead ? colors.textMuted : colors.primary} size={20} />
        </View>
        <View style={styles.cardContent}>
          <Text
            style={[
              styles.cardTitle,
              { color: colors.text },
              link.isRead && { textDecorationLine: "line-through", color: colors.textSecondary },
            ]}
            numberOfLines={1}
          >
            {link.title}
          </Text>
          <Text style={[styles.cardUrl, { color: colors.textSecondary }]} numberOfLines={1}>
            {link.url}
          </Text>
          {link.description && (
            <Text style={[styles.description, { color: colors.textSecondary }]} numberOfLines={2}>
              {link.description}
            </Text>
          )}
          {link.tags.length > 0 && (
            <View style={styles.tagsRow}>
              {link.tags.map((tag) => (
                <View key={tag} style={[styles.tag, { backgroundColor: colors.primary + "20" }]}>
                  <Text style={[styles.tagText, { color: colors.primary }]}>{tag}</Text>
                </View>
              ))}
            </View>
          )}
        </View>
      </View>

      <View style={[styles.cardActions, { backgroundColor: colors.cardActionsBg, borderTopColor: colors.border }]}>
        <TouchableOpacity style={[styles.actionButton, { borderRightColor: colors.border }]} onPress={() => handleOpenLink(link.url)}>
          <ExternalLink color={colors.textSecondary} size={18} />
          <Text style={[styles.actionText, { color: colors.textSecondary }]}>Open</Text>
        </TouchableOpacity>

        <TouchableOpacity style={[styles.actionButton, { borderRightColor: colors.border }]} onPress={() => handleToggleRead(link.id, link.isRead)}>
          <CheckCircle color={link.isRead ? colors.success : colors.textSecondary} size={18} />
          <Text style={[styles.actionText, link.isRead && { color: colors.success }, !link.isRead && { color: colors.textSecondary }]}>
            {link.isRead ? "Done" : "Read"}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity style={[styles.actionButton, { borderRightWidth: 0 }]} onPress={() => handleDeleteLink(link.id)}>
          <Trash2 color={colors.destructive} size={18} />
          <Text style={[styles.actionText, { color: colors.destructive }]}>Delete</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 12,
    borderWidth: 1,
    overflow: "hidden",
  },
  cardHeader: {
    padding: 15,
    flexDirection: "row",
    gap: 12,
    alignItems: "flex-start",
  },
  cardIcon: {
    padding: 8,
    borderRadius: 8,
    marginTop: 2,
  },
  cardContent: {
    flex: 1,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: "600",
  },
  cardUrl: {
    fontSize: 12,
    marginTop: 2,
  },
  description: {
    fontSize: 12,
    marginTop: 4,
    lineHeight: 16,
  },
  tagsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 4,
    marginTop: 6,
  },
  tag: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  tagText: {
    fontSize: 10,
    fontWeight: "600",
  },
  cardActions: {
    flexDirection: "row",
    borderTopWidth: 1,
  },
  actionButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
    gap: 6,
    borderRightWidth: 1,
  },
  actionText: {
    fontSize: 12,
    fontWeight: "600",
  },
});
