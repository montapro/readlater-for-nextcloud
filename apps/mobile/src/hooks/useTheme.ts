import { useColorScheme } from "react-native";

export interface AppColors {
  background: string;
  card: string;
  cardRead: string;
  border: string;
  text: string;
  textSecondary: string;
  textMuted: string;
  primary: string;
  destructive: string;
  success: string;
  headerBg: string;
  headerBorder: string;
  inputBg: string;
  inputBorder: string;
  cardActionsBg: string;
  buttonBg: string;
  iconBg: string;
}

const light: AppColors = {
  background: "#f8fafc",
  card: "#ffffff",
  cardRead: "#f1f5f9",
  border: "#e2e8f0",
  text: "#0f172a",
  textSecondary: "#64748b",
  textMuted: "#94a3b8",
  primary: "#2563eb",
  destructive: "#ef4444",
  success: "#10b981",
  headerBg: "#ffffff",
  headerBorder: "#e2e8f0",
  inputBg: "#ffffff",
  inputBorder: "#cbd5e1",
  cardActionsBg: "#fafafa",
  buttonBg: "#eff6ff",
  iconBg: "#eff6ff",
};

const dark: AppColors = {
  background: "#0f172a",
  card: "#1e293b",
  cardRead: "#1a2332",
  border: "#334155",
  text: "#f1f5f9",
  textSecondary: "#94a3b8",
  textMuted: "#64748b",
  primary: "#3b82f6",
  destructive: "#ef4444",
  success: "#10b981",
  headerBg: "#1e293b",
  headerBorder: "#334155",
  inputBg: "#1e293b",
  inputBorder: "#475569",
  cardActionsBg: "#1a2332",
  buttonBg: "#1e3a5f",
  iconBg: "#1e3a5f",
};

export function useTheme() {
  const scheme = useColorScheme();
  const isDark = scheme === "dark";
  return { isDark, colors: isDark ? dark : light };
}
