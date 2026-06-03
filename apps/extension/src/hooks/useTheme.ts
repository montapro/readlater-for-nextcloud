import { useState, useEffect } from "react";
import browser from "webextension-polyfill";
import type { ThemeType } from "../types";

export function useTheme() {
  const [theme, setTheme] = useState<ThemeType>("system");

  // Load saved preference on mount
  useEffect(() => {
    browser.storage.local.get("pref_theme").then((result) => {
      if (result.pref_theme) {
        setTheme(result.pref_theme as ThemeType);
      }
    });
  }, []);

  // Apply theme whenever it changes
  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");

    const apply = () => {
      const prefersDark = mq.matches;
      const isDark =
        theme === "dark" || (theme === "system" && prefersDark);
      document.documentElement.classList.toggle("dark", isDark);
    };

    // Apply immediately
    apply();

    // Persist preference
    browser.storage.local.set({ pref_theme: theme });

    // Listen for system theme changes only when in "system" mode
    if (theme === "system") {
      mq.addEventListener("change", apply);
      return () => mq.removeEventListener("change", apply);
    }
  }, [theme]);

  return { theme, setTheme };
}
