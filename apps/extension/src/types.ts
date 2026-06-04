export type FilterType = "all" | "read" | "unread";
export type SortType = "newest" | "oldest" | "alpha";
export type ThemeType = "system" | "light" | "dark";
export type StatusType = "success" | "error" | "info";

export interface StatusMessage {
  text: string;
  type: StatusType;
  visible: boolean;
}
