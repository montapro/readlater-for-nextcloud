import { Alert, Platform } from "react-native";
import * as SecureStore from "expo-secure-store";
import { fetchPageMetadata, type PageMetadata } from "./metadata";

export interface ConfirmOptions {
  label: string;
  destructive?: boolean;
}

export function confirmDialog(
  title: string,
  message: string,
  options: ConfirmOptions
): Promise<boolean> {
  if (Platform.OS === "web") {
    return Promise.resolve(window.confirm(`${title}\n${message}`));
  }
  return new Promise((resolve) => {
    Alert.alert(title, message, [
      { text: "Cancel", style: "cancel", onPress: () => resolve(false) },
      {
        text: options.label,
        style: options.destructive ? "destructive" : "default",
        onPress: () => resolve(true),
      },
    ]);
  });
}

export function toProxyUrl(url: string): string {
  if (Platform.OS !== "web") return url;
  try {
    const parsed = new URL(url);
    return `${window.location.origin}/dav${parsed.pathname}${parsed.search}`;
  } catch {
    return url;
  }
}

export async function loadPageMetadata(url: string): Promise<PageMetadata> {
  if (Platform.OS !== "web") return fetchPageMetadata(url);
  try {
    const response = await fetch(
      `/api/meta?url=${encodeURIComponent(url)}`
    );
    if (!response.ok) return {};
    return (await response.json()) as PageMetadata;
  } catch {
    return {};
  }
}

const STORAGE_PREFIX = "readlater_";

export async function storageGet(key: string): Promise<string | null> {
  if (Platform.OS === "web") {
    try {
      return window.localStorage.getItem(STORAGE_PREFIX + key);
    } catch {
      return null;
    }
  }
  return SecureStore.getItemAsync(key);
}

export async function storageSet(key: string, value: string): Promise<void> {
  if (Platform.OS === "web") {
    try {
      window.localStorage.setItem(STORAGE_PREFIX + key, value);
    } catch {
      return;
    }
    return;
  }
  await SecureStore.setItemAsync(key, value);
}
