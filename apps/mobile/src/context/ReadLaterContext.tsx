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

export type FilterType = "all" | "read" | "unread";
export type SortType = "newest" | "oldest" | "alpha";

export interface StatusMessage {
  text: string;
  type: "info" | "success" | "error";
  visible: boolean;
}

interface ReadLaterContextValue {
  config: WebDAVConfig;
  updateConfig: (partial: Partial<WebDAVConfig>) => void;
  isConfigured: boolean;
  links: Link[];
  loading: boolean;
  showSettings: boolean;
  setShowSettings: (show: boolean) => void;
  filter: FilterType;
  setFilter: (f: FilterType) => void;
  sortBy: SortType;
  setSortBy: (s: SortType) => void;
  status: StatusMessage;
  showStatus: (message: string, type: StatusMessage["type"]) => void;
  clearStatus: () => void;
  showAddModal: boolean;
  setShowAddModal: (show: boolean) => void;
  refreshLinks: () => Promise<void>;
  saveSettings: () => Promise<void>;
  handleToggleRead: (id: string, isRead: boolean) => Promise<void>;
  handleDeleteLink: (id: string) => void;
  handleAddLink: (url: string, title?: string) => Promise<void>;
  handleMarkAllRead: () => Promise<void>;
  handleDeleteAll: () => Promise<void>;
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
  const [filter, setFilter] = useState<FilterType>("all");
  const [sortBy, setSortBy] = useState<SortType>("newest");
  const [status, setStatus] = useState<StatusMessage>({
    text: "",
    type: "info",
    visible: false,
  });
  const [showAddModal, setShowAddModal] = useState(false);

  const updateConfig = useCallback((partial: Partial<WebDAVConfig>) => {
    setConfig((prev) => ({ ...prev, ...partial }));
  }, []);

  // -----------------------------------------------------------------------
  // Status helpers
  // -----------------------------------------------------------------------

  const clearStatus = useCallback(() => {
    setStatus((prev) => ({ ...prev, visible: false }));
  }, []);

  const showStatus = useCallback(
    (message: string, type: StatusMessage["type"]) => {
      setStatus({ text: message, type, visible: true });
      setTimeout(clearStatus, 3000);
    },
    [clearStatus]
  );

  // -----------------------------------------------------------------------
  // Initialization
  // -----------------------------------------------------------------------

  useEffect(() => {
    (async () => {
      try {
        const [url, user, pass, savedFilter, savedSortBy] =
          await Promise.all([
            SecureStore.getItemAsync("webdav_url"),
            SecureStore.getItemAsync("webdav_user"),
            SecureStore.getItemAsync("webdav_pass"),
            SecureStore.getItemAsync("pref_filter"),
            SecureStore.getItemAsync("pref_sortBy"),
          ]);

        if (savedFilter) setFilter(savedFilter as FilterType);
        if (savedSortBy) setSortBy(savedSortBy as SortType);

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

  // Persist filter/sort
  useEffect(() => {
    SecureStore.setItemAsync("pref_filter", filter).catch(() => {});
  }, [filter]);

  useEffect(() => {
    SecureStore.setItemAsync("pref_sortBy", sortBy).catch(() => {});
  }, [sortBy]);

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
      showStatus("Could not fetch links. Check your settings.", "error");
    } finally {
      setLoading(false);
    }
  }, [showStatus]);

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
      showStatus("Settings saved!", "success");
    } catch (_err) {
      showStatus("Failed to save settings.", "error");
    }
  }, [config, doRefreshLinks, showStatus]);

  const handleToggleRead = useCallback(
    async (id: string, isRead: boolean) => {
      try {
        const client = getClient(config);
        await client.updateLink(id, { isRead: !isRead });
        await doRefreshLinks(config);
      } catch (_err) {
        showStatus("Failed to update link.", "error");
      }
    },
    [config, doRefreshLinks, showStatus]
  );

  const handleDeleteLink = useCallback(
    (id: string) => {
      Alert.alert("Delete Link", "Are you sure?", [
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
              showStatus("Failed to delete link.", "error");
            }
          },
        },
      ]);
    },
    [config, doRefreshLinks, showStatus]
  );

  const handleAddLink = useCallback(
    async (url: string, title?: string) => {
      try {
        const client = getClient(config);
        await client.addLink({
          url,
          title: title || url,
          tags: [],
        });
        setShowAddModal(false);
        showStatus("Link saved!", "success");
        await doRefreshLinks(config);
      } catch (_err) {
        showStatus("Failed to save link.", "error");
      }
    },
    [config, doRefreshLinks, showStatus]
  );

  const handleMarkAllRead = useCallback(async () => {
    Alert.alert("Mark all as read", "Mark all links as read?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Mark All",
        onPress: async () => {
          try {
            const client = getClient(config);
            await client.markAllAsRead();
            showStatus("All marked as read!", "success");
            await doRefreshLinks(config);
          } catch (_err) {
            showStatus("Failed to mark all as read.", "error");
          }
        },
      },
    ]);
  }, [config, doRefreshLinks, showStatus]);

  const handleDeleteAll = useCallback(async () => {
    Alert.alert(
      "Delete All",
      "DANGER: Delete ALL links permanently?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete All",
          style: "destructive",
          onPress: async () => {
            try {
              const client = getClient(config);
              await client.deleteAllLinks();
              showStatus("All links deleted.", "info");
              await doRefreshLinks(config);
            } catch (_err) {
              showStatus("Failed to delete all links.", "error");
            }
          },
        },
      ]
    );
  }, [config, doRefreshLinks, showStatus]);

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
      filter,
      setFilter,
      sortBy,
      setSortBy,
      status,
      showStatus,
      clearStatus,
      showAddModal,
      setShowAddModal,
      refreshLinks,
      saveSettings,
      handleToggleRead,
      handleDeleteLink,
      handleAddLink,
      handleMarkAllRead,
      handleDeleteAll,
      handleOpenLink,
    }),
    [
      config,
      updateConfig,
      isConfigured,
      links,
      loading,
      showSettings,
      filter,
      sortBy,
      status,
      showStatus,
      clearStatus,
      showAddModal,
      refreshLinks,
      saveSettings,
      handleToggleRead,
      handleDeleteLink,
      handleAddLink,
      handleMarkAllRead,
      handleDeleteAll,
      handleOpenLink,
    ]
  );

  return (
    <ReadLaterContext.Provider value={value}>
      {children}
    </ReadLaterContext.Provider>
  );
}
