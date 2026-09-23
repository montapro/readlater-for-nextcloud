export type FilterType = "all" | "read" | "unread";
export type SortType = "newest" | "oldest" | "alpha";
export type RefreshInterval = "1min" | "5min" | "15min" | "60min" | "manual";

export interface StatusMessage {
  text: string;
  type: "info" | "success" | "error";
  visible: boolean;
}
