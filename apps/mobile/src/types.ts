export type FilterType = "all" | "read" | "unread";
export type SortType = "newest" | "oldest" | "alpha";
export type ThemeType = "system" | "light" | "dark";

export interface StatusMessage {
  text: string;
  type: "info" | "success" | "error";
  visible: boolean;
}
