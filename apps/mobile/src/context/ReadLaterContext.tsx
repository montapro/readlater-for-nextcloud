import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
  type ReactNode,
} from "react";
import { Alert, AppState, Platform, type AppStateStatus } from "react-native";
import * as SecureStore from "expo-secure-store";
import * as Linking from "expo-linking";
import * as Notifications from "expo-notifications";
import { ReadLaterClient, WebDAVConfig, Link } from "@readlater/core";
import type { FilterType, SortType, StatusMessage, RefreshInterval } from "../types";
import {
  DEFAULT_REFRESH_INTERVAL,
  intervalToMs,
  intervalToBackgroundMinutes,
} from "../refreshIntervals";
import {
  registerBackgroundSyncAsync,
  unregisterBackgroundSyncAsync,
} from "../backgroundTask";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ReadLaterContextValue {
  config: WebDAVConfig;
  updateConfig: (partial: Partial<WebDAVConfig>) => void;
  isConfigured: boolean;
  links: Link[];
  loading: boolean;
  testingConnection: boolean;
  isUrlValid: boolean;
  showSettings: boolean;
  setShowSettings: (show: boolean) => void;
  filter: FilterType;
  setFilter: (f: FilterType) => void;
  sortBy: SortType;
  setSortBy: (s: SortType) => void;
  refreshInterval: RefreshInterval;
  setRefreshInterval: (interval: RefreshInterval) => void;
  unreadCount: number;
  status: StatusMessage;
  showStatus: (message: string, type: StatusMessage["type"]) => void;
  clearStatus: () => void;
  showAddModal: boolean;
  setShowAddModal: (show: boolean) => void;
  refreshLinks: () => Promise<void>;
  saveSettings: () => Promise<void>;
  testConnection: () => Promise<void>;
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
  const [testingConnection, setTestingConnection] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [filter, setFilter] = useState<FilterType>("unread");
  const [sortBy, setSortBy] = useState<SortType>("newest");
  const [refreshInterval, setRefreshInterval] = useState<RefreshInterval>(
    DEFAULT_REFRESH_INTERVAL
  );
  const [status, setStatus] = useState<StatusMessage>({
    text: "",
    type: "info",
    visible: false,
  });
  const [showAddModal, setShowAddModal] = useState(false);

  const updateConfig = useCallback((partial: Partial<WebDAVConfig>) => {
    setConfig((prev) => ({ ...prev, ...partial }));
  }, []);

  const isUrlValid = useMemo(
    () => config.url.trim().startsWith("https://"),
    [config.url],
  );

  const unreadCount = useMemo(
    () => links.filter((link) => !link.isRead).length,
    [links],
  );

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
        const [url, user, pass, savedFilter, savedSortBy, savedInterval, linksCache] =
          await Promise.all([
            SecureStore.getItemAsync("webdav_url"),
            SecureStore.getItemAsync("webdav_user"),
            SecureStore.getItemAsync("webdav_pass"),
            SecureStore.getItemAsync("pref_filter"),
            SecureStore.getItemAsync("pref_sortBy"),
            SecureStore.getItemAsync("pref_refreshInterval"),
            SecureStore.getItemAsync("links_cache"),
          ]);

        if (savedFilter) setFilter(savedFilter as FilterType);
        if (savedSortBy) setSortBy(savedSortBy as SortType);
        if (savedInterval) setRefreshInterval(savedInterval as RefreshInterval);

        // Restore cached links for immediate display
        if (linksCache) {
          try {
            const parsed = JSON.parse(linksCache);
            if (Array.isArray(parsed)) setLinks(parsed as Link[]);
          } catch (_err) {
            // Ignore corrupted cache
          }
        }

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

        // Request app-icon badge permission on first launch (iOS only)
        if (Platform.OS === "ios") {
          try {
            await Notifications.requestPermissionsAsync({
              ios: { allowBadge: true, allowAlert: false, allowSound: false },
            });
          } catch (_err) {
            // Badge permission is non-fatal; header counter still works
          }
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

  useEffect(() => {
    SecureStore.setItemAsync("pref_refreshInterval", refreshInterval).catch(
      () => {}
    );
  }, [refreshInterval]);

  // -----------------------------------------------------------------------
  // Actions
  // -----------------------------------------------------------------------

  const doRefreshLinks = useCallback(async (cfg: WebDAVConfig) => {
    setLoading(true);
    try {
      const client = getClient(cfg);
      const store = await client.fetchLinks();
      setLinks(store.links);
      await SecureStore.setItemAsync("links_cache", JSON.stringify(store.links));
    } catch (_err) {
      if (links.length > 0) {
        showStatus("Showing cached data – server unreachable.", "info");
      } else {
        showStatus("Could not fetch links. Check your settings.", "error");
      }
    } finally {
      setLoading(false);
    }
  }, [links.length, showStatus]);

  const refreshLinks = useCallback(async () => {
    await doRefreshLinks(config);
  }, [config, doRefreshLinks]);

  const testConnection = useCallback(async () => {
    setTestingConnection(true);
    showStatus("Testing connection...", "info");
    try {
      const client = getClient(config);
      const result = await client.verifyConnection();
      if (result.ok) {
        showStatus("Connection successful!", "success");
      } else {
        showStatus(
          result.error || "Connection failed. Check your data.",
          "error",
        );
      }
    } catch (_err) {
      showStatus("Test failed. Check URL and credentials.", "error");
    } finally {
      setTestingConnection(false);
    }
  }, [config, showStatus]);

  const saveSettings = useCallback(async () => {
    try {
      await SecureStore.setItemAsync("webdav_url", config.url);
      await SecureStore.setItemAsync("webdav_user", config.username || "");
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
  // Badge, auto-refresh and background sync
  // -----------------------------------------------------------------------

  const appStateRef = useRef<AppStateStatus | null>(
    (AppState.currentState as AppStateStatus | null) ?? null
  );
  const [appState, setAppState] = useState<AppStateStatus | null>(
    (AppState.currentState as AppStateStatus | null) ?? null
  );

  // Update the app icon badge whenever the unread count changes (iOS only)
  useEffect(() => {
    if (Platform.OS !== "ios") return;
    Notifications.setBadgeCountAsync(unreadCount).catch(() => {});
  }, [unreadCount]);

  // Refresh when the app returns to the foreground (not on cold start, which
  // is handled by the init effect above)
  useEffect(() => {
    const subscription = AppState.addEventListener("change", (nextState) => {
      const previous = appStateRef.current;
      appStateRef.current = nextState;
      setAppState(nextState);
      if (nextState === "active" && previous !== "active" && isConfigured) {
        refreshLinks();
      }
    });
    return () => subscription.remove();
  }, [isConfigured, refreshLinks]);

  // Exact refresh timer while the app is open and in the foreground
  useEffect(() => {
    if (!isConfigured || appState !== "active") return;
    const ms = intervalToMs(refreshInterval);
    if (ms == null) return;
    const timer = setInterval(() => {
      refreshLinks();
    }, ms);
    return () => clearInterval(timer);
  }, [isConfigured, appState, refreshInterval, refreshLinks]);

  // Register/unregister the iOS background task based on the interval
  useEffect(() => {
    if (!isConfigured) {
      unregisterBackgroundSyncAsync();
      return;
    }
    const minutes = intervalToBackgroundMinutes(refreshInterval);
    if (minutes == null) {
      unregisterBackgroundSyncAsync();
    } else {
      registerBackgroundSyncAsync(minutes);
    }
  }, [isConfigured, refreshInterval]);

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
      testingConnection,
      isUrlValid,
      showSettings,
      setShowSettings,
      filter,
      setFilter,
      sortBy,
      setSortBy,
      refreshInterval,
      setRefreshInterval,
      unreadCount,
      status,
      showStatus,
      clearStatus,
      showAddModal,
      setShowAddModal,
      refreshLinks,
      saveSettings,
      testConnection,
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
      testingConnection,
      isUrlValid,
      showSettings,
      filter,
      sortBy,
      refreshInterval,
      unreadCount,
      status,
      showStatus,
      clearStatus,
      showAddModal,
      refreshLinks,
      saveSettings,
      testConnection,
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
