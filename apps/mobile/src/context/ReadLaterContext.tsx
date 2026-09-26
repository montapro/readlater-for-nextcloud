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
import { AppState, Platform, type AppStateStatus } from "react-native";
import * as Linking from "expo-linking";
import * as Notifications from "expo-notifications";
import { ReadLaterClient, WebDAVConfig, Link } from "@readlater/core";
import type { FilterType, SortType, StatusMessage, ThemeType } from "../types";
import { useShareIntent } from "expo-share-intent";
import { normalizeUrl } from "../utils";
import {
  confirmDialog,
  storageGet,
  storageSet,
  loadPageMetadata,
  toProxyUrl,
} from "../utils/webCompat";

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
  refreshLinks: () => Promise<void>;
  saveSettings: () => Promise<void>;
  testConnection: () => Promise<void>;
  handleToggleRead: (id: string, isRead: boolean) => Promise<boolean>;
  handleDeleteLink: (
    id: string,
    options?: { confirm?: boolean }
  ) => Promise<boolean>;
  handleUpdateLink: (
    id: string,
    updates: Partial<Omit<Link, "id" | "addedAt">>,
    favicon?: FaviconPayload
  ) => Promise<{ ok: boolean; error?: string }>;
  handleAddLink: (
    url: string,
    title?: string,
    fetchTitle?: boolean,
    favicon?: FaviconPayload
  ) => Promise<{ ok: boolean; error?: string }>;
  handleMarkAllRead: () => Promise<void>;
  handleDeleteAll: () => Promise<void>;
  handleOpenLink: (url: string) => void;
  getIconSource: (
    link: Link
  ) => { uri: string; headers: Record<string, string> } | undefined;
}

interface FaviconPayload {
  data?: string;
  url?: string;
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
  return new ReadLaterClient({ ...config, url: toProxyUrl(config.url) });
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
        const [url, user, pass, savedFilter, savedSortBy, savedTheme, linksCache] =
          await Promise.all([
            storageGet("webdav_url"),
            storageGet("webdav_user"),
            storageGet("webdav_pass"),
            storageGet("pref_filter"),
            storageGet("pref_sortBy"),
            storageGet("pref_theme"),
            storageGet("links_cache"),
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
    storageSet("pref_filter", filter).catch(() => {});
  }, [filter]);

  useEffect(() => {
    storageSet("pref_sortBy", sortBy).catch(() => {});
  }, [sortBy]);

  useEffect(() => {
    storageSet("pref_theme", theme).catch(() => {});
  }, [theme]);

  // -----------------------------------------------------------------------
  // Actions
  // -----------------------------------------------------------------------

  const doRefreshLinks = useCallback(async (cfg: WebDAVConfig) => {
    setLoading(true);
    try {
      const client = getClient(cfg);
      const store = await client.fetchLinks();
      setLinks(store.links);
      await storageSet("links_cache", JSON.stringify(store.links));
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
      await storageSet("webdav_url", config.url);
      await storageSet("webdav_user", config.username || "");
      await storageSet("webdav_pass", config.password || "");
      setIsConfigured(true);
      setShowSettings(false);
      await doRefreshLinks(config);
      showStatus("Settings saved!", "success");
    } catch (_err) {
      showStatus("Failed to save settings.", "error");
    }
  }, [config, doRefreshLinks, showStatus]);

  const handleToggleRead = useCallback(
    async (id: string, isRead: boolean): Promise<boolean> => {
      try {
        const client = getClient(config);
        await client.updateLink(id, { isRead: !isRead });
        await doRefreshLinks(config);
        return true;
      } catch (_err) {
        showStatus("Failed to update link.", "error");
        return false;
      }
    },
    [config, doRefreshLinks, showStatus]
  );

  const handleDeleteLink = useCallback(
    (id: string, options?: { confirm?: boolean }): Promise<boolean> => {
      const performDelete = async (): Promise<boolean> => {
        try {
          const client = getClient(config);
          await client.deleteLink(id);
          await doRefreshLinks(config);
          return true;
        } catch (_err) {
          showStatus("Failed to delete link.", "error");
          return false;
        }
      };

      if (options?.confirm === false) {
        return performDelete();
      }
      return confirmDialog(
        "Delete Link",
        "Are you sure?",
        { label: "Delete", destructive: true }
      ).then((confirmed) => (confirmed ? performDelete() : false));
    },
    [config, doRefreshLinks, showStatus]
  );

  const handleAddLink = useCallback(
    async (
      url: string,
      title?: string,
      fetchTitle?: boolean,
      favicon?: FaviconPayload
    ): Promise<{ ok: boolean; error?: string }> => {
      try {
        url = normalizeUrl(url);
        const client = getClient(config);
        const savedLink = await client.addLink({
          url,
          title: title || url,
          tags: [],
        });
        setShowAddModal(false);
        showStatus("Link saved!", "success");
        await doRefreshLinks(config);

        // Favicon was prefetched manually (fetch button) — upload it directly
        if (favicon?.data) {
          const iconPath = await client.saveIcon(savedLink.id, favicon.data);
          if (iconPath) {
            await client.updateLink(savedLink.id, {
              faviconPath: iconPath,
              ...(favicon.url ? { faviconUrl: favicon.url } : {}),
            });
            await doRefreshLinks(config);
          }
          return { ok: true };
        }
        if (favicon?.url) {
          await client.updateLink(savedLink.id, { faviconUrl: favicon.url });
          await doRefreshLinks(config);
          return { ok: true };
        }

        // Otherwise fetch page metadata (title + favicon) in the background
        loadPageMetadata(url)
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
            await doRefreshLinks(config);
          })
          .catch(() => {});
        return { ok: true };
      } catch (_err) {
        showStatus("Invalid URL", "error");
        return { ok: false, error: "Invalid URL" };
      }
    },
    [config, doRefreshLinks, showStatus]
  );

  const handleUpdateLink = useCallback(
    async (
      id: string,
      updates: Partial<Omit<Link, "id" | "addedAt">>,
      favicon?: FaviconPayload
    ): Promise<{ ok: boolean; error?: string }> => {
      try {
        const client = getClient(config);
        const normalizedUpdates = updates.url
          ? { ...updates, url: normalizeUrl(updates.url) }
          : updates;
        if (favicon?.data) {
          const iconPath = await client.saveIcon(id, favicon.data);
          if (iconPath) {
            normalizedUpdates.faviconPath = iconPath;
          }
        } else if (favicon?.url) {
          normalizedUpdates.faviconUrl = favicon.url;
        }
        await client.updateLink(id, normalizedUpdates);
        setShowAddModal(false);
        setEditingLink(null);
        showStatus("Link updated!", "success");
        await doRefreshLinks(config);
        return { ok: true };
      } catch (_err) {
        showStatus("Invalid URL", "error");
        return { ok: false, error: "Invalid URL" };
      }
    },
    [config, doRefreshLinks, showStatus]
  );

  const handleMarkAllRead = useCallback(async () => {
    const confirmed = await confirmDialog(
      "Mark all as read",
      "Mark all links as read?",
      { label: "Mark All" }
    );
    if (!confirmed) return;
    try {
      const client = getClient(config);
      await client.markAllAsRead();
      showStatus("All marked as read!", "success");
      await doRefreshLinks(config);
    } catch (_err) {
      showStatus("Failed to mark all as read.", "error");
    }
  }, [config, links, doRefreshLinks, showStatus]);

  const handleDeleteAll = useCallback(async () => {
    const confirmed = await confirmDialog(
      "Delete All",
      "DANGER: Delete ALL links permanently?",
      { label: "Delete All", destructive: true }
    );
    if (!confirmed) return;
    try {
      const client = getClient(config);
      await client.deleteAllLinks();
      showStatus("All links deleted.", "info");
      await doRefreshLinks(config);
    } catch (_err) {
      showStatus("Failed to delete all links.", "error");
    }
  }, [config, doRefreshLinks, showStatus]);

  const handleOpenLink = useCallback((url: string) => {
    Linking.openURL(url);
  }, []);

  const getIconSource = useCallback(
    (
      link: Link
    ): { uri: string; headers: Record<string, string> } | undefined => {
      if (Platform.OS === "web") return undefined;
      if (!link.faviconPath) return undefined;
      const base = config.url.endsWith("/") ? config.url : config.url + "/";
      const uri = base + link.faviconPath;
      const auth = "Basic " + toBase64(`${config.username || ""}:${config.password || ""}`);
      return { uri, headers: { Authorization: auth } };
    },
    [config]
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
      refreshLinks,
      saveSettings,
      testConnection,
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
      updateConfig,
      isConfigured,
      links,
      loading,
      testingConnection,
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
      refreshLinks,
      saveSettings,
      testConnection,
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
