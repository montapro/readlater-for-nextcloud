export type FilterType = "all" | "read" | "unread";
export type SortType = "newest" | "oldest" | "alpha";
export type ThemeType = "system" | "light" | "dark";
export type StatusType = "success" | "error" | "info" | null;

export interface StatusMessage {
  message: string;
  type: StatusType;
}
