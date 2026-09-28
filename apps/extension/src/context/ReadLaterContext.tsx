import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useMemo,
  useCallback,
  useRef,
  type ReactNode,
} from "react";
import browser from "webextension-polyfill";
import { ReadLaterClient, Link } from "@readlater/core";
import type { FilterType, SortType, StatusMessage } from "../types";
import { useTheme } from "../hooks/useTheme";
import {
  normalizeBasePath,
  normalizeInstance,
} from "../utils/loginFlow";
import { toWebDavConfig } from "../utils/storedConfig";

// ---------------------------------------------------------------------------
// Context value type
// ---------------------------------------------------------------------------

export interface NextcloudConfigState {
  server: string;
  username: string;
  appPassword: string;
  uid: string;
  basePath: string;
}

export type LoginStatus = "idle" | "connecting" | "waiting" | "finishing";

interface ReadLaterContextValue {
  config: NextcloudConfigState;
  isConfigured: boolean;
  links: Link[];
  loading: boolean;
  testingConnection: boolean;
  status: StatusMessage;
  showStatus: (text: string, type: StatusMessage["type"]) => void;
  clearStatus: () => void;
  showSettings: boolean;
  setShowSettings: (show: boolean) => void;
  filter: FilterType;
  setFilter: (f: FilterType) => void;
  sortBy: SortType;
  setSortBy: (s: SortType) => void;
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  theme: "system" | "light" | "dark";
  setTheme: (t: "system" | "light" | "dark") => void;
  currentTab: { url?: string; title?: string };
  isUrlValid: boolean;
  isAlreadySavedAndUnread: boolean;
  hasUnread: boolean;
  loginStatus: LoginStatus;
  connectToNextcloud: (instance: string, basePath: string) => Promise<void>;
  disconnect: () => Promise<void>;
  setBasePath: (path: string) => Promise<void>;
  refreshLinks: () => Promise<void>;
  testConnection: () => Promise<void>;
  saveCurrentLink: () => Promise<void>;
  handleToggleRead: (id: string, isRead: boolean) => Promise<void>;
  handleDeleteLink: (id: string) => Promise<void>;
  handleMarkAllRead: () => Promise<void>;
  handleDeleteAll: () => Promise<void>;
}

const ReadLaterContext = createContext<ReadLaterContextValue | null>(null);

const EMPTY_CONFIG: NextcloudConfigState = {
  server: "",
  username: "",
  appPassword: "",
  uid: "",
  basePath: "",
};

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

function getClient(config: NextcloudConfigState): ReadLaterClient {
  return new ReadLaterClient(toWebDavConfig(config));
}

export function ReadLaterProvider({ children }: { children: ReactNode }) {
  // --- Config state ---
  const [config, setConfig] = useState<NextcloudConfigState>(EMPTY_CONFIG);
  const [isConfigured, setIsConfigured] = useState(false);
  const [loginStatus, setLoginStatus] = useState<LoginStatus>("idle");

  // --- Data state ---
  const [links, setLinks] = useState<Link[]>([]);
  const [loading, setLoading] = useState(false);
  const [testingConnection, setTestingConnection] = useState(false);

  const [status, setStatus] = useState<StatusMessage>({
    text: "",
    type: "info",
    visible: false,
  });

  // --- UI state ---
  const [showSettings, setShowSettings] = useState(false);
  const [filter, setFilter] = useState<FilterType>("unread");
  const [sortBy, setSortBy] = useState<SortType>("newest");
  const [searchQuery, setSearchQuery] = useState("");
  const { theme, setTheme } = useTheme();
  const [currentTab, setCurrentTab] = useState<{
    url?: string;
    title?: string;
  }>({});

  const configRef = useRef(config);
  configRef.current = config;

  // --- Computed ---
  const isUrlValid = useMemo(
    () => normalizeInstance(config.server).startsWith("https://"),
    [config.server],
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
  // Status helpers
  // -----------------------------------------------------------------------

  const clearStatus = useCallback(() => {
    setStatus((prev) => ({ ...prev, visible: false }));
  }, []);

  const showStatus = useCallback(
    (text: string, type: StatusMessage["type"]) => {
      setStatus({ text, type, visible: true });
    },
    [],
  );

  // -----------------------------------------------------------------------
  // Initialization
  // -----------------------------------------------------------------------

  useEffect(() => {
    async function init() {
      try {
        const stored = await browser.storage.local.get([
          "nc_server",
          "nc_username",
          "nc_apppw",
          "nc_uid",
          "nc_basepath",
          "nc_login_status",
          "links_cache",
          "pref_filter",
          "pref_sortBy",
        ]);

        if (stored.links_cache) setLinks(stored.links_cache as Link[]);
        if (stored.pref_filter) setFilter(stored.pref_filter as FilterType);
        if (stored.pref_sortBy) setSortBy(stored.pref_sortBy as SortType);
        if (stored.nc_login_status) {
          setLoginStatus(stored.nc_login_status as LoginStatus);
        }

        if (stored.nc_server && stored.nc_uid) {
          const loaded: NextcloudConfigState = {
            server: stored.nc_server as string,
            username: (stored.nc_username as string) || "",
            appPassword: (stored.nc_apppw as string) || "",
            uid: stored.nc_uid as string,
            basePath: (stored.nc_basepath as string) || "/",
          };
          console.log(
            "ReadLater: loaded config",
            loaded.server,
            "user=" + loaded.username,
            "uid=" + loaded.uid,
            "basePath=" + loaded.basePath,
            "pwLength=" + (loaded.appPassword || "").length
          );
          setConfig(loaded);
          setIsConfigured(true);
          doRefreshLinks(loaded);
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
  // Auto-dismiss status after 3s for non-error messages
  // -----------------------------------------------------------------------

  useEffect(() => {
    if (status.visible && status.type !== "error") {
      const timer = setTimeout(() => clearStatus(), 3000);
      return () => clearTimeout(timer);
    }
  }, [status.visible, status.type, clearStatus]);

  // -----------------------------------------------------------------------
  // Actions
  // -----------------------------------------------------------------------

  const doRefreshLinks = useCallback(async (cfg: NextcloudConfigState) => {
    setLoading(true);
    try {
      const client = getClient(cfg);
      const store = await client.fetchLinks();
      setLinks(store.links);
      await browser.storage.local.set({ links_cache: store.links });
    } catch (err: unknown) {
      if (links.length > 0) {
        showStatus("Showing cached data – server unreachable.", "info");
      } else {
        const message =
          err instanceof Error ? err.message : "Sync failed.";
        showStatus(message, "error");
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
      showStatus("Test failed. Check URL and credentials.", "error");
    } finally {
      setTestingConnection(false);
    }
  }, [isUrlValid, showStatus]);

  // -----------------------------------------------------------------------
  // Nextcloud login flow (runs in the background service worker)
  // -----------------------------------------------------------------------

  useEffect(() => {
    function onMessage(message: unknown) {
      const msg = message as {
        type?: string;
        phase?: LoginStatus;
        result?: { server: string; loginName: string; appPassword: string; uid: string };
        error?: string;
      };
      if (msg.type === "LOGIN_FLOW_PROGRESS" && msg.phase) {
        setLoginStatus(msg.phase);
      }
      if (msg.type === "LOGIN_FLOW_RESULT" && msg.result) {
        const loaded: NextcloudConfigState = {
          server: normalizeInstance(msg.result.server),
          username: msg.result.loginName,
          appPassword: msg.result.appPassword,
          uid: msg.result.uid,
          basePath: configRef.current.basePath || "/",
        };
        setConfig(loaded);
        setIsConfigured(true);
        setLoginStatus("idle");
        showStatus("Connected to Nextcloud!", "success");
        doRefreshLinks(loaded);
      }
      if (msg.type === "LOGIN_FLOW_ERROR") {
        setLoginStatus("idle");
        showStatus(msg.error || "Login failed.", "error");
      }
    }

    browser.runtime.onMessage.addListener(onMessage);
    return () => browser.runtime.onMessage.removeListener(onMessage);
  }, [doRefreshLinks, showStatus]);

  const connectToNextcloud = useCallback(
    async (instance: string, basePath: string) => {
      const server = normalizeInstance(instance);
      const rawPath = basePath.trim();
      if (!server) {
        showStatus("Enter your Nextcloud instance first.", "error");
        return;
      }
      if (!rawPath) {
        showStatus("Enter a folder — use / for the root.", "error");
        return;
      }

      const normalizedPath = normalizeBasePath(rawPath);
      setConfig((prev) => ({ ...prev, server, basePath: normalizedPath }));
      await browser.storage.local.set({ nc_basepath: normalizedPath });

      setLoginStatus("connecting");
      try {
        await browser.runtime.sendMessage({
          type: "START_LOGIN_FLOW",
          instance: server,
        });
      } catch (err: unknown) {
        setLoginStatus("idle");
        const message =
          err instanceof Error ? err.message : "Could not start login flow.";
        showStatus(message, "error");
      }
    },
    [showStatus],
  );

  const disconnect = useCallback(async () => {
    await browser.storage.local.remove([
      "nc_server",
      "nc_username",
      "nc_apppw",
      "nc_uid",
      "links_cache",
    ]);
    setConfig(EMPTY_CONFIG);
    setIsConfigured(false);
    setLinks([]);
    setShowSettings(true);
    showStatus("Disconnected from Nextcloud.", "info");
  }, [showStatus]);

  const setBasePath = useCallback(async (path: string) => {
    const basePath = normalizeBasePath(path);
    const updated = { ...configRef.current, basePath };
    setConfig(updated);
    await browser.storage.local.set({ nc_basepath: basePath });
    if (updated.server && updated.uid) {
      await doRefreshLinks(updated);
    }
  }, [doRefreshLinks]);

  const saveCurrentLink = useCallback(async () => {
    if (!currentTab.url || !currentTab.title || isAlreadySavedAndUnread) return;
    showStatus("Saving...", "info");
    try {
      const client = getClient(configRef.current);
      await client.addLink({
        url: currentTab.url,
        title: currentTab.title,
        tags: [],
      });
      showStatus("Saved!", "success");
      await doRefreshLinks(configRef.current);
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Save failed.";
      showStatus(message, "error");
    }
  }, [currentTab, isAlreadySavedAndUnread, doRefreshLinks, showStatus]);

  const handleToggleRead = useCallback(
    async (id: string, _isRead: boolean) => {
      try {
        const client = getClient(configRef.current);
        await client.updateLink(id, { isRead: !_isRead });
        await doRefreshLinks(configRef.current);
      } catch (err: unknown) {
        const message =
          err instanceof Error ? err.message : "Update failed.";
        console.error("ReadLater: handleToggleRead error", err);
        showStatus(message, "error");
      }
    },
    [doRefreshLinks, showStatus],
  );

  const handleDeleteLink = useCallback(
    async (id: string) => {
      if (!confirm("Delete this link?")) return;
      try {
        const client = getClient(configRef.current);
        await client.deleteLink(id);
        await doRefreshLinks(configRef.current);
      } catch (err: unknown) {
        const message =
          err instanceof Error ? err.message : "Delete failed.";
        console.error("ReadLater: handleDeleteLink error", err);
        showStatus(message, "error");
      }
    },
    [doRefreshLinks, showStatus],
  );

  const handleMarkAllRead = useCallback(async () => {
    if (!confirm("Mark all links as read?")) return;
    showStatus("Updating...", "info");
    try {
      const client = getClient(configRef.current);
      await client.markAllAsRead();
      showStatus("All marked as read!", "success");
      await doRefreshLinks(configRef.current);
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Failed to update.";
      console.error("ReadLater: handleMarkAllRead error", err);
      showStatus(message, "error");
    }
  }, [doRefreshLinks, showStatus]);

  const handleDeleteAll = useCallback(async () => {
    if (!confirm("DANGER: Delete ALL links permanently?")) return;
    showStatus("Deleting everything...", "info");
    try {
      const client = getClient(configRef.current);
      await client.deleteAllLinks();
      showStatus("All links deleted.", "success");
      await doRefreshLinks(configRef.current);
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Deletion failed.";
      console.error("ReadLater: handleDeleteAll error", err);
      showStatus(message, "error");
    }
  }, [doRefreshLinks, showStatus]);

  // -----------------------------------------------------------------------
  // Context value
  // -----------------------------------------------------------------------

  const value = useMemo<ReadLaterContextValue>(
    () => ({
      config,
      isConfigured,
      links,
      loading,
      testingConnection,
      status,
      showStatus,
      clearStatus,
      showSettings,
      setShowSettings,
      filter,
      setFilter,
      sortBy,
      setSortBy,
      searchQuery,
      setSearchQuery,
      theme,
      setTheme,
      currentTab,
      isUrlValid,
      isAlreadySavedAndUnread,
      hasUnread,
      loginStatus,
      connectToNextcloud,
      disconnect,
      setBasePath,
      refreshLinks,
      testConnection,
      saveCurrentLink,
      handleToggleRead,
      handleDeleteLink,
      handleMarkAllRead,
      handleDeleteAll,
    }),
    [
      config,
      isConfigured,
      links,
      loading,
      testingConnection,
      status,
      showStatus,
      clearStatus,
      showSettings,
      filter,
      sortBy,
      searchQuery,
      theme,
      currentTab,
      isUrlValid,
      isAlreadySavedAndUnread,
      hasUnread,
      loginStatus,
      connectToNextcloud,
      disconnect,
      setBasePath,
      refreshLinks,
      testConnection,
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
