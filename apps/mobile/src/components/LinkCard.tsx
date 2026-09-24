import React, { useState } from "react";
import { View, Text, Image, TouchableOpacity, StyleSheet } from "react-native";
import { Link as LinkType } from "@readlater/core";
import { useReadLater } from "../context/ReadLaterContext";
import { useTheme } from "../hooks/useTheme";
import { Link2, ExternalLink, CheckCircle, Trash2, Pencil } from "lucide-react-native";
import { formatDate } from "../utils";

interface Props {
  link: LinkType;
}

export function LinkCard({ link }: Props) {
  const {
    handleOpenLink,
    handleToggleRead,
    handleDeleteLink,
    setEditingLink,
    setShowAddModal,
    getIconSource,
  } = useReadLater();
  const { colors } = useTheme();
  const [faviconFailed, setFaviconFailed] = useState(false);

  const iconSource = getIconSource(link);
  let imageSource: { uri: string; headers?: Record<string, string> } | null =
    null;
  if (iconSource) {
    imageSource = { uri: iconSource.uri, headers: iconSource.headers };
  } else if (link.faviconData) {
    imageSource = { uri: link.faviconData };
  }
  const showFavicon = imageSource !== null && !faviconFailed;

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: link.isRead ? colors.cardRead : colors.card,
          borderColor: colors.border,
          opacity: link.isRead ? 0.8 : 1,
        },
      ]}
    >
      <View style={styles.cardHeader}>
        <View style={styles.cardIcon}>
          {showFavicon && imageSource ? (
            <Image
              source={imageSource}
              style={styles.favicon}
              onError={() => setFaviconFailed(true)}
            />
          ) : (
            <Link2 color={link.isRead ? colors.textMuted : colors.primary} size={20} />
          )}
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
          <Text style={[styles.date, { color: colors.textMuted }]}>{formatDate(link.addedAt)}</Text>
        </View>
      </View>

      <View style={[styles.cardActions, { backgroundColor: colors.cardActionsBg, borderTopColor: colors.border }]}>
        <TouchableOpacity style={[styles.actionButton, { borderRightColor: colors.border }]} onPress={() => handleDeleteLink(link.id)}>
          <Trash2 color={colors.textSecondary} size={18} />
        </TouchableOpacity>

        <TouchableOpacity style={[styles.actionButton, { borderRightColor: colors.border }]} onPress={() => { setEditingLink(link); setShowAddModal(true); }}>
          <Pencil color={colors.textSecondary} size={18} />
        </TouchableOpacity>

        <TouchableOpacity style={[styles.actionButton, { borderRightColor: colors.border }]} onPress={() => handleToggleRead(link.id, link.isRead)}>
          <CheckCircle color={link.isRead ? colors.success : colors.textSecondary} size={18} />
        </TouchableOpacity>

        <TouchableOpacity style={[styles.actionButton, { borderRightWidth: 0 }]} onPress={() => handleOpenLink(link.url)}>
          <ExternalLink color={colors.textSecondary} size={18} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderTopWidth: 1,
    borderBottomWidth: 1,
    overflow: "hidden",
  },
  cardHeader: {
    padding: 15,
    flexDirection: "row",
    gap: 12,
    alignItems: "flex-start",
  },
  cardIcon: {
    backgroundColor: "#ffffff",
    borderRadius: 6,
    marginTop: 2,
  },
  favicon: {
    width: 20,
    height: 20,
    borderRadius: 3,
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
  date: {
    fontSize: 11,
    marginTop: 4,
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
});
