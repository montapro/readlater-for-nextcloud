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
import * as WebBrowser from "expo-web-browser";
import { ReadLaterClient, Link } from "@readlater/core";
import type { FilterType, SortType, StatusMessage, ThemeType } from "../types";
import { useShareIntent } from "expo-share-intent";
import { fetchPageMetadata } from "../utils/metadata";
import { normalizeUrl } from "../utils";
import {
  buildWebDavUrl,
  fetchUid,
  normalizeBasePath,
  normalizeInstance,
  pollLoginFlow,
  startLoginFlow,
  type NextcloudConfig,
} from "../utils/loginFlow";
import {
  readStoredConfig,
  removeStoredConfig,
  toWebDavConfig,
  writeBasePath,
  writeStoredConfig,
} from "../utils/nextcloudConfig";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type LoginStatus = "idle" | "connecting" | "waiting" | "finishing";

const EMPTY_CONFIG: NextcloudConfig = {
  server: "",
  username: "",
  appPassword: "",
  uid: "",
  basePath: "/",
};

interface ReadLaterContextValue {
  config: NextcloudConfig;
  isConfigured: boolean;
  loginStatus: LoginStatus;
  links: Link[];
  loading: boolean;
  testingConnection: boolean;
  fetchProgress: { done: number; total: number } | null;
  isUrlValid: boolean;
  showSettings: boolean;
  setShowSettings: (show: boolean) => void;
  filter: FilterType;
  setFilter: (f: FilterType) => void;
  sortBy: SortType;
  setSortBy: (s: SortType) => void;
  theme: ThemeType;
  setTheme: (theme: ThemeType) => void;
  unreadCount: number;
  status: StatusMessage;
  showStatus: (message: string, type: StatusMessage["type"]) => void;
  clearStatus: () => void;
  showAddModal: boolean;
  setShowAddModal: (show: boolean) => void;
  editingLink: Link | null;
  setEditingLink: (link: Link | null) => void;
  connectToNextcloud: (instance: string, basePath: string) => Promise<void>;
  disconnect: () => Promise<void>;
  setBasePath: (path: string) => Promise<void>;
  refreshLinks: () => Promise<void>;
  testConnection: () => Promise<void>;
  handleFetchUnreadMetadata: () => Promise<void>;
  handleToggleRead: (
    id: string,
    isRead: boolean,
    options?: { confirm?: boolean }
  ) => Promise<boolean>;
  handleDeleteLink: (
    id: string,
    options?: { confirm?: boolean }
  ) => Promise<boolean>;
  handleUpdateLink: (
    id: string,
    updates: Partial<Omit<Link, "id" | "addedAt">>,
    faviconData?: string
  ) => Promise<{ ok: boolean; error?: string }>;
  handleAddLink: (
    url: string,
    title?: string,
    fetchTitle?: boolean,
    faviconData?: string
  ) => Promise<{ ok: boolean; error?: string }>;
  handleMarkAllRead: () => Promise<void>;
  handleDeleteAll: () => Promise<void>;
  handleOpenLink: (url: string) => void;
  getIconSource: (
    link: Link
  ) => { uri: string; headers: Record<string, string> } | undefined;
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

function getClient(config: NextcloudConfig): ReadLaterClient {
  return new ReadLaterClient(toWebDavConfig(config));
}

function toBase64(value: string): string {
  const bytes = new TextEncoder().encode(value);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

/**
 * Derives a title from a shared text payload (e.g. YouTube's
 * `Watch "Title" on YouTube — https://youtu.be/...`).
 */
function extractSharedTitle(
  text: string | null | undefined,
  url: string | null
): string | undefined {
  if (!text) return undefined;
  const title = text
    .replace(url ?? "", "")
    .replace(/https?:\/\/\S+/g, " ")
    .replace(/[\r\n]+/g, " ")
    .replace(/watch\s*["'“”]?\s*/i, "")
    .replace(/\s*["'””]?\s*on youtube\s*/i, " ")
    .replace(/["“”'‘’]/g, "")
    .replace(/[\s\-–—:]+/g, " ")
    .trim();
  return title || undefined;
}

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

export function ReadLaterProvider({ children }: { children: ReactNode }) {
  const [config, setConfig] = useState<NextcloudConfig>(EMPTY_CONFIG);
  const [isConfigured, setIsConfigured] = useState(false);
  const [loginStatus, setLoginStatus] = useState<LoginStatus>("idle");
  const [links, setLinks] = useState<Link[]>([]);
  const [loading, setLoading] = useState(false);
  const [testingConnection, setTestingConnection] = useState(false);
  const [fetchProgress, setFetchProgress] = useState<{
    done: number;
    total: number;
  } | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [filter, setFilter] = useState<FilterType>("unread");
  const [sortBy, setSortBy] = useState<SortType>("newest");
  const [theme, setTheme] = useState<ThemeType>("system");
  const [status, setStatus] = useState<StatusMessage>({
    text: "",
    type: "info",
    visible: false,
  });
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingLink, setEditingLink] = useState<Link | null>(null);

  const { hasShareIntent, shareIntent, resetShareIntent } = useShareIntent();
  const shareIntentHandledRef = useRef(false);

  const configRef = useRef(config);
  configRef.current = config;

  const linksRef = useRef(links);
  linksRef.current = links;

  const isUrlValid = useMemo(
    () => normalizeInstance(config.server).startsWith("https://"),
    [config.server],
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
        const [savedFilter, savedSortBy, savedTheme, linksCache, stored] =
          await Promise.all([
            SecureStore.getItemAsync("pref_filter"),
            SecureStore.getItemAsync("pref_sortBy"),
            SecureStore.getItemAsync("pref_theme"),
            SecureStore.getItemAsync("links_cache"),
            readStoredConfig(),
          ]);

        if (savedFilter) setFilter(savedFilter as FilterType);
        if (savedSortBy) setSortBy(savedSortBy as SortType);
        if (savedTheme) setTheme(savedTheme as ThemeType);

        // Restore cached links for immediate display
        if (linksCache) {
          try {
            const parsed = JSON.parse(linksCache);
            if (Array.isArray(parsed)) setLinks(parsed as Link[]);
          } catch (_err) {
            // Ignore corrupted cache
          }
        }

        if (stored) {
          setConfig(stored);
          setIsConfigured(true);
          doRefreshLinks(stored);
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
    SecureStore.setItemAsync("pref_theme", theme).catch(() => {});
  }, [theme]);

  // -----------------------------------------------------------------------
  // Actions
  // -----------------------------------------------------------------------

  const doRefreshLinks = useCallback(async (cfg: NextcloudConfig) => {
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
        showStatus("Could not fetch links. Check your connection.", "error");
      }
    } finally {
      setLoading(false);
    }
  }, [links.length, showStatus]);

  const refreshLinks = useCallback(async () => {
    await doRefreshLinks(configRef.current);
  }, [doRefreshLinks]);

  const testConnection = useCallback(async () => {
    if (!isUrlValid) return;
    setTestingConnection(true);
    showStatus("Testing connection...", "info");
    try {
      const client = getClient(configRef.current);
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
      showStatus("Test failed. Check your connection.", "error");
    } finally {
      setTestingConnection(false);
    }
  }, [isUrlValid, showStatus]);

  // -----------------------------------------------------------------------
  // Nextcloud login flow
  // -----------------------------------------------------------------------

  const connectToNextcloud = useCallback(
    async (instance: string, basePath: string) => {
      const server = normalizeInstance(instance);
      const rawPath = basePath.trim();
      if (!server) {
        showStatus("Enter your Nextcloud instance first.", "error");
        return;
      }
      if (!rawPath) {
        showStatus("Enter a folder – use / for the root.", "error");
        return;
      }

      const normalizedPath = normalizeBasePath(rawPath);
      setConfig((prev) => ({ ...prev, server, basePath: normalizedPath }));
      await writeBasePath(normalizedPath).catch(() => {});

      setLoginStatus("connecting");
      let browserOpen = false;
      let browserClosed = false;
      try {
        const flow = await startLoginFlow(server);

        browserOpen = true;
        void WebBrowser.openBrowserAsync(flow.loginUrl)
          .catch(() => {})
          .then(() => {
            browserClosed = true;
          });

        setLoginStatus("waiting");
        const credentials = await pollLoginFlow(
          flow.pollEndpoint,
          flow.pollToken,
          () => browserClosed,
        );

        setLoginStatus("finishing");
        const uid = await fetchUid(
          credentials.server,
          credentials.loginName,
          credentials.appPassword,
        );

        const loaded: NextcloudConfig = {
          server: normalizeInstance(credentials.server),
          username: credentials.loginName,
          appPassword: credentials.appPassword,
          uid,
          basePath: normalizedPath,
        };
        await writeStoredConfig(loaded);
        setConfig(loaded);
        setIsConfigured(true);
        setLoginStatus("idle");
        showStatus("Connected to Nextcloud!", "success");
        await doRefreshLinks(loaded);
      } catch (err) {
        setLoginStatus("idle");
        const message =
          err instanceof Error ? err.message : "Login failed.";
        showStatus(message, "error");
      } finally {
        if (browserOpen && !browserClosed) {
          await WebBrowser.dismissBrowser().catch(() => {});
        }
      }
    },
    [doRefreshLinks, showStatus],
  );

  const disconnect = useCallback(async () => {
    try {
      await removeStoredConfig();
      await SecureStore.deleteItemAsync("links_cache");
    } catch (_err) {
      // Best effort – clear local state regardless
    }
    setConfig(EMPTY_CONFIG);
    setIsConfigured(false);
    setLinks([]);
    setShowSettings(true);
    showStatus("Disconnected from Nextcloud.", "info");
  }, [showStatus]);

  const setBasePathCallback = useCallback(
    async (path: string) => {
      const basePath = normalizeBasePath(path);
      const updated = { ...configRef.current, basePath };
      setConfig(updated);
      await writeBasePath(basePath).catch(() => {});
      if (updated.server && updated.uid) {
        await doRefreshLinks(updated);
      }
    },
    [doRefreshLinks],
  );

  const handleFetchUnreadMetadata = useCallback(async () => {
    const cfg = configRef.current;
    const unread = linksRef.current.filter((link) => !link.isRead);
    if (unread.length === 0) {
      showStatus("No unread links to fetch.", "info");
      return;
    }

    setFetchProgress({ done: 0, total: unread.length });
    const client = getClient(cfg);
    let updated = 0;

    for (let i = 0; i < unread.length; i++) {
      const link = unread[i];
      try {
        const meta = await fetchPageMetadata(link.url);
        const updates: Partial<Link> = {};
        if (meta.title) updates.title = meta.title;
        if (meta.faviconUrl) updates.faviconUrl = meta.faviconUrl;
        if (meta.faviconData) {
          const iconPath = await client.saveIcon(link.id, meta.faviconData);
          if (iconPath) updates.faviconPath = iconPath;
        }
        if (Object.keys(updates).length > 0) {
          await client.updateLink(link.id, updates);
          updated += 1;
        }
      } catch (_err) {
        // Skip links whose metadata could not be fetched
      }
      setFetchProgress({ done: i + 1, total: unread.length });
    }

    await doRefreshLinks(cfg);
    setFetchProgress(null);
    showStatus(
      `Updated ${updated} of ${unread.length} unread links.`,
      "success"
    );
  }, [doRefreshLinks, showStatus]);

  const handleToggleRead = useCallback(
    (
      id: string,
      isRead: boolean,
      options?: { confirm?: boolean }
    ): Promise<boolean> => {
      const performToggle = async (): Promise<boolean> => {
        try {
          const client = getClient(configRef.current);
          await client.updateLink(id, { isRead: !isRead });
          await doRefreshLinks(configRef.current);
          return true;
        } catch (_err) {
          showStatus("Failed to update link.", "error");
          return false;
        }
      };

      // Confirm when marking a link as read, mirroring the delete flow.
      const shouldConfirm = options?.confirm !== false && !isRead;
      if (!shouldConfirm) {
        return performToggle();
      }
      return new Promise((resolve) => {
        Alert.alert("Mark as read", "Mark this link as read?", [
          { text: "Cancel", style: "cancel", onPress: () => resolve(false) },
          {
            text: "Mark as read",
            onPress: async () => resolve(await performToggle()),
          },
        ]);
      });
    },
    [doRefreshLinks, showStatus]
  );

  const handleDeleteLink = useCallback(
    (id: string, options?: { confirm?: boolean }): Promise<boolean> => {
      const performDelete = async (): Promise<boolean> => {
        try {
          const client = getClient(configRef.current);
          await client.deleteLink(id);
          await doRefreshLinks(configRef.current);
          return true;
        } catch (_err) {
          showStatus("Failed to delete link.", "error");
          return false;
        }
      };

      if (options?.confirm === false) {
        return performDelete();
      }
      return new Promise((resolve) => {
        Alert.alert("Delete Link", "Are you sure?", [
          { text: "Cancel", style: "cancel", onPress: () => resolve(false) },
          {
            text: "Delete",
            style: "destructive",
            onPress: async () => resolve(await performDelete()),
          },
        ]);
      });
    },
    [doRefreshLinks, showStatus]
  );

  const handleAddLink = useCallback(
    async (
      url: string,
      title?: string,
      fetchTitle?: boolean,
      faviconData?: string
    ): Promise<{ ok: boolean; error?: string }> => {
      try {
        url = normalizeUrl(url);
        const client = getClient(configRef.current);
        const savedLink = await client.addLink({
          url,
          title: title || url,
          tags: [],
        });
        setShowAddModal(false);
        showStatus("Link saved!", "success");
        await doRefreshLinks(configRef.current);

        // Favicon was prefetched manually (fetch button) — upload it directly
        if (faviconData) {
          const iconPath = await client.saveIcon(savedLink.id, faviconData);
          if (iconPath) {
            await client.updateLink(savedLink.id, { faviconPath: iconPath });
            await doRefreshLinks(configRef.current);
          }
          return { ok: true };
        }

        // Otherwise fetch page metadata (title + favicon) in the background
        fetchPageMetadata(url)
          .then(async (meta) => {
            const updates: Partial<Link> = {};
            const shouldUpdateTitle = fetchTitle || savedLink.title === url;
            if (shouldUpdateTitle && meta.title) {
              updates.title = meta.title;
            }
            if (meta.faviconUrl) {
              updates.faviconUrl = meta.faviconUrl;
            }
            if (meta.faviconData) {
              const iconPath = await client.saveIcon(
                savedLink.id,
                meta.faviconData
              );
              if (iconPath) {
                updates.faviconPath = iconPath;
              }
            }
            if (Object.keys(updates).length === 0) return;
            await client.updateLink(savedLink.id, updates);
            await doRefreshLinks(configRef.current);
          })
          .catch(() => {});
        return { ok: true };
      } catch (_err) {
        showStatus("Invalid URL", "error");
        return { ok: false, error: "Invalid URL" };
      }
    },
    [doRefreshLinks, showStatus]
  );

  const handleUpdateLink = useCallback(
    async (
      id: string,
      updates: Partial<Omit<Link, "id" | "addedAt">>,
      faviconData?: string
    ): Promise<{ ok: boolean; error?: string }> => {
      try {
        const client = getClient(configRef.current);
        const normalizedUpdates = updates.url
          ? { ...updates, url: normalizeUrl(updates.url) }
          : updates;
        if (faviconData) {
          const iconPath = await client.saveIcon(id, faviconData);
          if (iconPath) {
            normalizedUpdates.faviconPath = iconPath;
          }
        }
        await client.updateLink(id, normalizedUpdates);
        setShowAddModal(false);
        setEditingLink(null);
        showStatus("Link updated!", "success");
        await doRefreshLinks(configRef.current);
        return { ok: true };
      } catch (_err) {
        showStatus("Invalid URL", "error");
        return { ok: false, error: "Invalid URL" };
      }
    },
    [doRefreshLinks, showStatus]
  );

  const handleMarkAllRead = useCallback(async () => {
    Alert.alert("Mark all as read", "Mark all links as read?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Mark All",
        onPress: async () => {
          try {
            const client = getClient(configRef.current);
            await client.markAllAsRead();
            showStatus("All marked as read!", "success");
            await doRefreshLinks(configRef.current);
          } catch (_err) {
            showStatus("Failed to mark all as read.", "error");
          }
        },
      },
    ]);
  }, [doRefreshLinks, showStatus]);

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
              const client = getClient(configRef.current);
              await client.deleteAllLinks();
              showStatus("All links deleted.", "info");
              await doRefreshLinks(configRef.current);
            } catch (_err) {
              showStatus("Failed to delete all links.", "error");
            }
          },
        },
      ]
    );
  }, [doRefreshLinks, showStatus]);

  const handleOpenLink = useCallback((url: string) => {
    Linking.openURL(url);
  }, []);

  const getIconSource = useCallback(
    (
      link: Link
    ): { uri: string; headers: Record<string, string> } | undefined => {
      if (!link.faviconPath) return undefined;
      const cfg = configRef.current;
      const base = buildWebDavUrl(cfg.server, cfg.uid, cfg.basePath);
      const uri = base + link.faviconPath;
      const auth =
        "Basic " + toBase64(`${cfg.username || ""}:${cfg.appPassword || ""}`);
      return { uri, headers: { Authorization: auth } };
    },
    []
  );

  // -----------------------------------------------------------------------
  // Badge, auto-refresh and background sync
  // -----------------------------------------------------------------------

  const appStateRef = useRef<AppStateStatus | null>(
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
      if (nextState === "active" && previous !== "active" && isConfigured) {
        refreshLinks();
      }
    });
    return () => subscription.remove();
  }, [isConfigured, refreshLinks]);

  // Save a URL shared from another app (iOS share extension)
  useEffect(() => {
    if (!hasShareIntent) {
      // Allow processing the next share intent
      shareIntentHandledRef.current = false;
      return;
    }
    if (!isConfigured || shareIntentHandledRef.current) {
      return;
    }
    const url = shareIntent.webUrl;
    if (!url) return;
    shareIntentHandledRef.current = true;
    resetShareIntent();
    const title =
      shareIntent.meta?.title ?? extractSharedTitle(shareIntent.text, url);
    handleAddLink(url, title, true);
  }, [
    hasShareIntent,
    shareIntent,
    isConfigured,
    resetShareIntent,
    handleAddLink,
  ]);

  // -----------------------------------------------------------------------
  // Context value
  // -----------------------------------------------------------------------

  const value = useMemo<ReadLaterContextValue>(
    () => ({
      config,
      isConfigured,
      loginStatus,
      links,
      loading,
      testingConnection,
      fetchProgress,
      isUrlValid,
      showSettings,
      setShowSettings,
      filter,
      setFilter,
      sortBy,
      setSortBy,
      theme,
      setTheme,
      unreadCount,
      status,
      showStatus,
      clearStatus,
      showAddModal,
      setShowAddModal,
      editingLink,
      setEditingLink,
      connectToNextcloud,
      disconnect,
      setBasePath: setBasePathCallback,
      refreshLinks,
      testConnection,
      handleFetchUnreadMetadata,
      handleToggleRead,
      handleDeleteLink,
      handleUpdateLink,
      handleAddLink,
      handleMarkAllRead,
      handleDeleteAll,
      handleOpenLink,
      getIconSource,
    }),
    [
      config,
      isConfigured,
      loginStatus,
      links,
      loading,
      testingConnection,
      fetchProgress,
      isUrlValid,
      showSettings,
      filter,
      sortBy,
      theme,
      unreadCount,
      status,
      showStatus,
      clearStatus,
      showAddModal,
      editingLink,
      connectToNextcloud,
      disconnect,
      setBasePathCallback,
      refreshLinks,
      testConnection,
      handleFetchUnreadMetadata,
      handleToggleRead,
      handleDeleteLink,
      handleUpdateLink,
      handleAddLink,
      handleMarkAllRead,
      handleDeleteAll,
      handleOpenLink,
      getIconSource,
    ]
  );

  return (
    <ReadLaterContext.Provider value={value}>
      {children}
    </ReadLaterContext.Provider>
  );
}
