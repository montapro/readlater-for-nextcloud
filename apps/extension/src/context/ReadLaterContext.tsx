import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useMemo,
  useCallback,
  type ReactNode,
} from "react";
import browser from "webextension-polyfill";
import { ReadLaterClient, WebDAVConfig, Link } from "@readlater/core";
import type { FilterType, SortType, StatusMessage } from "../types";

// ---------------------------------------------------------------------------
// Context value type
// ---------------------------------------------------------------------------

interface ReadLaterContextValue {
  config: WebDAVConfig;
  updateConfig: (partial: Partial<WebDAVConfig>) => void;
  isConfigured: boolean;
  links: Link[];
  loading: boolean;
  testingConnection: boolean;
  status: StatusMessage;
  showSettings: boolean;
  setShowSettings: (show: boolean) => void;
  filter: FilterType;
  setFilter: (f: FilterType) => void;
  sortBy: SortType;
  setSortBy: (s: SortType) => void;
  currentTab: { url?: string; title?: string };
  isUrlValid: boolean;
  isAlreadySavedAndUnread: boolean;
  hasUnread: boolean;
  refreshLinks: () => Promise<void>;
  testConnection: () => Promise<void>;
  saveSettings: () => Promise<void>;
  saveCurrentLink: () => Promise<void>;
  handleToggleRead: (id: string, isRead: boolean) => Promise<void>;
  handleDeleteLink: (id: string) => Promise<void>;
  handleMarkAllRead: () => Promise<void>;
  handleDeleteAll: () => Promise<void>;
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
// Provider
// ---------------------------------------------------------------------------

function getClient(config: WebDAVConfig): ReadLaterClient {
  return new ReadLaterClient(config);
}

export function ReadLaterProvider({ children }: { children: ReactNode }) {
  // --- Config state ---
  const [config, setConfig] = useState<WebDAVConfig>({
    url: "",
    username: "",
    password: "",
  });
  const [isConfigured, setIsConfigured] = useState(false);

  const updateConfig = useCallback((partial: Partial<WebDAVConfig>) => {
    setConfig((prev) => ({ ...prev, ...partial }));
  }, []);

  // --- Data state ---
  const [links, setLinks] = useState<Link[]>([]);
  const [loading, setLoading] = useState(false);
  const [testingConnection, setTestingConnection] = useState(false);
  const [status, setStatus] = useState<StatusMessage>({
    message: "",
    type: null,
  });

  // --- UI state ---
  const [showSettings, setShowSettings] = useState(false);
  const [filter, setFilter] = useState<FilterType>("all");
  const [sortBy, setSortBy] = useState<SortType>("newest");
  const [currentTab, setCurrentTab] = useState<{
    url?: string;
    title?: string;
  }>({});

  // --- Computed ---
  const isUrlValid = useMemo(
    () => config.url.trim().startsWith("https://"),
    [config.url],
  );

  const isAlreadySavedAndUnread = useMemo(
    () =>
      currentTab.url
        ? links.some((l) => l.url === currentTab.url && !l.isRead)
        : false,
    [links, currentTab.url],
  );

  const hasUnread = useMemo(() => links.some((l) => !l.isRead), [links]);

  // -----------------------------------------------------------------------
  // Initialization
  // -----------------------------------------------------------------------

  useEffect(() => {
    async function init() {
      try {
        const result = await browser.storage.local.get([
          "webdav_url",
          "webdav_user",
          "webdav_pass",
          "links_cache",
          "pref_filter",
          "pref_sortBy",
        ]);

        if (result.links_cache) setLinks(result.links_cache as Link[]);
        if (result.pref_filter) setFilter(result.pref_filter as FilterType);
        if (result.pref_sortBy) setSortBy(result.pref_sortBy as SortType);

        if (result.webdav_url) {
          const loadedConfig: WebDAVConfig = {
            url: result.webdav_url as string,
            username: (result.webdav_user as string) || "",
            password: (result.webdav_pass as string) || "",
          };
          setConfig(loadedConfig);
          setIsConfigured(true);
          // Don't await – let the fetch happen in the background
          doRefreshLinks(loadedConfig);
        } else {
          setShowSettings(true);
        }
      } catch (err) {
        console.error("ReadLater: Failed to initialize settings", err);
        setShowSettings(true);
      }

      try {
        const tabs = await browser.tabs.query({
          active: true,
          currentWindow: true,
        });
        const activeTab = tabs[0];
        if (activeTab) {
          setCurrentTab({ url: activeTab.url, title: activeTab.title });
        }
      } catch (_err) {
        // Tab query may fail in some contexts (e.g. incognito)
      }
    }
    init();
  }, []);

  // -----------------------------------------------------------------------
  // Persist filter/sort preferences
  // -----------------------------------------------------------------------

  useEffect(() => {
    browser.storage.local.set({ pref_filter: filter, pref_sortBy: sortBy });
  }, [filter, sortBy]);

  // -----------------------------------------------------------------------
  // Actions
  // -----------------------------------------------------------------------

  /** Internal fetch helper – takes config so it can be called before state is set. */
  const doRefreshLinks = useCallback(async (cfg: WebDAVConfig) => {
    if (!cfg.url) return;
    setLoading(true);
    try {
      const client = getClient(cfg);
      const store = await client.fetchLinks();
      setLinks(store.links);
      await browser.storage.local.set({ links_cache: store.links });
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Sync failed.";
      setStatus({ message, type: "error" });
    } finally {
      setLoading(false);
    }
  }, []);

  const refreshLinks = useCallback(async () => {
    await doRefreshLinks(config);
  }, [config, doRefreshLinks]);

  const testConnection = useCallback(async () => {
    if (!isUrlValid) return;
    setTestingConnection(true);
    setStatus({ message: "Testing connection...", type: "info" });
    try {
      const client = getClient(config);
      const result = await client.verifyConnection();
      if (result.ok) {
        setStatus({ message: "Connection successful!", type: "success" });
      } else {
        setStatus({
          message: result.error || "Connection failed. Check your data.",
          type: "error",
        });
      }
    } catch (_err) {
      setStatus({
        message: "Test failed. Check URL and credentials.",
        type: "error",
      });
    } finally {
      setTestingConnection(false);
    }
  }, [config, isUrlValid]);

  const saveSettings = useCallback(async () => {
    setLoading(true);
    try {
      await browser.storage.local.set({
        webdav_url: config.url,
        webdav_user: config.username,
        webdav_pass: config.password,
      });

      if (config.url) {
        const client = getClient(config);
        const store = await client.fetchLinks();
        setLinks(store.links);
        await browser.storage.local.set({ links_cache: store.links });
        setIsConfigured(true);
      } else {
        setLinks([]);
        await browser.storage.local.set({ links_cache: [] });
        setIsConfigured(false);
      }

      setShowSettings(false);
      setStatus({ message: "Settings saved!", type: "success" });
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Save failed.";
      setStatus({ message, type: "error" });
    }
  }, [config]);

  const saveCurrentLink = useCallback(async () => {
    if (!currentTab.url || !currentTab.title || isAlreadySavedAndUnread) return;
    setStatus({ message: "Saving...", type: "info" });
    try {
      const client = getClient(config);
      await client.addLink({
        url: currentTab.url,
        title: currentTab.title,
        tags: [],
      });
      setStatus({ message: "Saved!", type: "success" });
      await doRefreshLinks(config);
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Save failed.";
      setStatus({ message, type: "error" });
    }
  }, [config, currentTab, isAlreadySavedAndUnread, doRefreshLinks]);

  const handleToggleRead = useCallback(
    async (id: string, isRead: boolean) => {
      try {
        const client = getClient(config);
        await client.updateLink(id, { isRead: !isRead });
        await doRefreshLinks(config);
      } catch (_err) {
        setStatus({ message: "Update failed.", type: "error" });
      }
    },
    [config, doRefreshLinks],
  );

  const handleDeleteLink = useCallback(
    async (id: string) => {
      if (!confirm("Delete this link?")) return;
      try {
        const client = getClient(config);
        await client.deleteLink(id);
        await doRefreshLinks(config);
      } catch (_err) {
        setStatus({ message: "Delete failed.", type: "error" });
      }
    },
    [config, doRefreshLinks],
  );

  const handleMarkAllRead = useCallback(async () => {
    if (!confirm("Mark all links as read?")) return;
    setStatus({ message: "Updating...", type: "info" });
    try {
      const client = getClient(config);
      await client.markAllAsRead();
      setStatus({ message: "All marked as read!", type: "success" });
      await doRefreshLinks(config);
    } catch (_err) {
      setStatus({ message: "Failed to update.", type: "error" });
    }
  }, [config, doRefreshLinks]);

  const handleDeleteAll = useCallback(async () => {
    if (!confirm("DANGER: Delete ALL links permanently?")) return;
    setStatus({ message: "Deleting everything...", type: "info" });
    try {
      const client = getClient(config);
      await client.deleteAllLinks();
      setStatus({ message: "All links deleted.", type: "success" });
      await doRefreshLinks(config);
    } catch (_err) {
      setStatus({ message: "Deletion failed.", type: "error" });
    }
  }, [config, doRefreshLinks]);

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
      status,
      showSettings,
      setShowSettings,
      filter,
      setFilter,
      sortBy,
      setSortBy,
      currentTab,
      isUrlValid,
      isAlreadySavedAndUnread,
      hasUnread,
      refreshLinks,
      testConnection,
      saveSettings,
      saveCurrentLink,
      handleToggleRead,
      handleDeleteLink,
      handleMarkAllRead,
      handleDeleteAll,
    }),
    [
      config,
      updateConfig,
      isConfigured,
      links,
      loading,
      testingConnection,
      status,
      showSettings,
      filter,
      sortBy,
      currentTab,
      isUrlValid,
      isAlreadySavedAndUnread,
      hasUnread,
      refreshLinks,
      testConnection,
      saveSettings,
      saveCurrentLink,
      handleToggleRead,
      handleDeleteLink,
      handleMarkAllRead,
      handleDeleteAll,
    ],
  );

  return (
    <ReadLaterContext.Provider value={value}>
      {children}
    </ReadLaterContext.Provider>
  );
}
