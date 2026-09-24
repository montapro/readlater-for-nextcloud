import { StyleSheet } from "react-native";

export const styles = StyleSheet.create({
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
    padding: 2,
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
