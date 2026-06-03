import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
  type ReactNode,
} from "react";
import { Alert } from "react-native";
import * as SecureStore from "expo-secure-store";
import * as Crypto from "expo-crypto";
import * as Linking from "expo-linking";
import { ReadLaterClient, WebDAVConfig, Link } from "@readlater/core";

// ---------------------------------------------------------------------------
// Crypto polyfill for React Native (needed by @readlater/core)
// Preserves existing crypto properties.
// ---------------------------------------------------------------------------
if (!global.crypto?.randomUUID) {
  // @ts-expect-error – polyfilling randomUUID
  global.crypto = {
    ...(global.crypto || {}),
    randomUUID: () => Crypto.randomUUID(),
  };
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ReadLaterContextValue {
  config: WebDAVConfig;
  updateConfig: (partial: Partial<WebDAVConfig>) => void;
  isConfigured: boolean;
  links: Link[];
  loading: boolean;
  showSettings: boolean;
  setShowSettings: (show: boolean) => void;
  refreshLinks: () => Promise<void>;
  saveSettings: () => Promise<void>;
  handleToggleRead: (id: string, isRead: boolean) => Promise<void>;
  handleDeleteLink: (id: string) => void;
  handleOpenLink: (url: string) => void;
}

const ReadLaterContext = createContext<ReadLaterContextValue | null>(null);

export function useReadLater(): ReadLaterContextValue {
  const ctx = useContext(ReadLaterContext);
  if (!ctx) {
    throw new Error("useReadLater must be used within a ReadLaterProvider");
  }
  return ctx;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getClient(config: WebDAVConfig): ReadLaterClient {
  return new ReadLaterClient(config);
}

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

export function ReadLaterProvider({ children }: { children: ReactNode }) {
  const [config, setConfig] = useState<WebDAVConfig>({
    url: "",
    username: "",
    password: "",
  });
  const [isConfigured, setIsConfigured] = useState(false);
  const [links, setLinks] = useState<Link[]>([]);
  const [loading, setLoading] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  const updateConfig = useCallback((partial: Partial<WebDAVConfig>) => {
    setConfig((prev) => ({ ...prev, ...partial }));
  }, []);

  // -----------------------------------------------------------------------
  // Initialization
  // -----------------------------------------------------------------------

  useEffect(() => {
    (async () => {
      try {
        const url = await SecureStore.getItemAsync("webdav_url");
        const user = await SecureStore.getItemAsync("webdav_user");
        const pass = await SecureStore.getItemAsync("webdav_pass");

        if (url && user) {
          const loadedConfig: WebDAVConfig = {
            url,
            username: user,
            password: pass || "",
          };
          setConfig(loadedConfig);
          setIsConfigured(true);
          doRefreshLinks(loadedConfig);
        } else {
          setShowSettings(true);
        }
      } catch (_err) {
        setShowSettings(true);
      }
    })();
  }, []);

  // -----------------------------------------------------------------------
  // Actions
  // -----------------------------------------------------------------------

  const doRefreshLinks = useCallback(async (cfg: WebDAVConfig) => {
    setLoading(true);
    try {
      const client = getClient(cfg);
      const store = await client.fetchLinks();
      setLinks(store.links);
    } catch (_err) {
      Alert.alert(
        "Error",
        "Could not fetch links. Please check your settings."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  const refreshLinks = useCallback(async () => {
    await doRefreshLinks(config);
  }, [config, doRefreshLinks]);

  const saveSettings = useCallback(async () => {
    try {
      await SecureStore.setItemAsync("webdav_url", config.url);
      await SecureStore.setItemAsync("webdav_user", config.username);
      await SecureStore.setItemAsync("webdav_pass", config.password || "");
      setIsConfigured(true);
      setShowSettings(false);
      await doRefreshLinks(config);
    } catch (_err) {
      Alert.alert("Error", "Failed to save settings.");
    }
  }, [config, doRefreshLinks]);

  const handleToggleRead = useCallback(
    async (id: string, isRead: boolean) => {
      try {
        const client = getClient(config);
        await client.updateLink(id, { isRead: !isRead });
        await doRefreshLinks(config);
      } catch (_err) {
        Alert.alert("Error", "Failed to update link.");
      }
    },
    [config, doRefreshLinks]
  );

  const handleDeleteLink = useCallback(
    (id: string) => {
      Alert.alert("Delete Link", "Are you sure you want to remove this link?", [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              const client = getClient(config);
              await client.deleteLink(id);
              await doRefreshLinks(config);
            } catch (_err) {
              Alert.alert("Error", "Failed to delete link.");
            }
          },
        },
      ]);
    },
    [config, doRefreshLinks]
  );

  const handleOpenLink = useCallback((url: string) => {
    Linking.openURL(url);
  }, []);

  // -----------------------------------------------------------------------
  // Context value
  // -----------------------------------------------------------------------

  const value = useMemo<ReadLaterContextValue>(
    () => ({
      config,
      updateConfig,
      isConfigured,
      links,
      loading,
      showSettings,
      setShowSettings,
      refreshLinks,
      saveSettings,
      handleToggleRead,
      handleDeleteLink,
      handleOpenLink,
    }),
    [
      config,
      updateConfig,
      isConfigured,
      links,
      loading,
      showSettings,
      refreshLinks,
      saveSettings,
      handleToggleRead,
      handleDeleteLink,
      handleOpenLink,
    ]
  );

  return (
    <ReadLaterContext.Provider value={value}>
      {children}
    </ReadLaterContext.Provider>
  );
}
