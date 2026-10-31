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

export interface PendingConfirm {
  message: string;
  confirmLabel: string;
  destructive: boolean;
}

interface ReadLaterContextValue {
  config: NextcloudConfigState;
  isConfigured: boolean;
  links: Link[];
  /** Links after filter, search and sort – exactly what the list renders. */
  visibleLinks: Link[];
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
  loginStatus: LoginStatus;connectToNextcloud: (instance: string, basePath: string) => Promise<void>;
  disconnect: () => Promise<void>;
  setBasePath: (path: string) => Promise<void>;
  refreshLinks: () => Promise<void>;
  testConnection: () => Promise<void>;
  saveCurrentLink: () => Promise<void>;
  saveTabsOrToggleCurrent: () => Promise<void>;
  /** Number of saveable highlighted tabs; badge is shown when >= 2. */
  highlightedTabCount: number;
  savingTabs: boolean;
  handleToggleRead: (id: string, isRead: boolean) => Promise<void>;
  handleDeleteLink: (id: string) => Promise<void>;
  /** IDs of the currently selected (visible) links. */
  selectedIds: Set<string>;
  selectedCount: number;
  toggleSelected: (id: string) => void;
  toggleSelectAllVisible: () => void;
  clearSelection: () => void;
  openSelected: () => Promise<void>;
  selectedAllRead: boolean;
  markSelectedRead: () => Promise<void>;
  markSelectedUnread: () => Promise<void>;
  deleteSelected: () => Promise<void>;
  openLink: (url: string) => Promise<void>;
  pendingConfirm: PendingConfirm | null;
  resolveConfirm: (accepted: boolean) => void;
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

interface TabToSave {
  url: string;
  title: string;
  tags: string[];
}

/**
 * Highlighted tabs of the current window that can actually be saved:
 * http(s) only and collapsed to unique URLs, so the badge count always
 * matches what the save action would process.
 */
async function collectHighlightedTabs(): Promise<TabToSave[]> {
  const tabs = await browser.tabs.query({
    currentWindow: true,
    highlighted: true,
  });

  const seen = new Set<string>();
  const items: TabToSave[] = [];
  for (const tab of tabs) {
    const url = tab.url;
    if (!url || !/^https?:\/\//i.test(url)) continue;
    if (seen.has(url)) continue;
    seen.add(url);
    items.push({ url, title: tab.title || url, tags: [] });
  }
  return items;
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
  const [savingTabs, setSavingTabs] = useState(false);
  const [highlightedTabCount, setHighlightedTabCount] = useState(0);

  const [status, setStatus] = useState<StatusMessage>({
    text: "",
    type: "info",
    visible: false,
  });

  // --- UI state ---
  const [showSettings, setShowSettings] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(
    () => new Set<string>()
  );
  const [pendingConfirm, setPendingConfirm] = useState<PendingConfirm | null>(
    null
  );
  const confirmResolver = useRef<((accepted: boolean) => void) | null>(null);
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

  const visibleLinks = useMemo(() => {
    let result = [...links];
    if (filter === "read") result = result.filter((l) => l.isRead);
    if (filter === "unread") result = result.filter((l) => !l.isRead);
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      result = result.filter(
        (l) =>
          l.title.toLowerCase().includes(q) ||
          l.url.toLowerCase().includes(q) ||
          l.tags.some((t) => t.toLowerCase().includes(q))
      );
    }
    result.sort((a, b) => {
      if (sortBy === "newest")
        return new Date(b.addedAt).getTime() - new Date(a.addedAt).getTime();
      if (sortBy === "oldest")
        return new Date(a.addedAt).getTime() - new Date(b.addedAt).getTime();
      if (sortBy === "alpha") return a.title.localeCompare(b.title);
      return 0;
    });
    return result;
  }, [links, filter, sortBy, searchQuery]);

  const selectedLinks = useMemo(
    () => visibleLinks.filter((l) => selectedIds.has(l.id)),
    [visibleLinks, selectedIds]
  );
  const selectedCount = selectedLinks.length;
  const selectedAllRead =
    selectedLinks.length > 0 && selectedLinks.every((l) => l.isRead);

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
  // Confirmation helper
  //
  // Native window.confirm() steals focus, which makes Chrome close the
  // popup mid-action. The dialog lives in the popup instead.
  // -----------------------------------------------------------------------

  const askConfirm = useCallback(
    (
      message: string,
      options?: { confirmLabel?: string; destructive?: boolean }
    ) =>
      new Promise<boolean>((resolve) => {
        confirmResolver.current?.(false);
        confirmResolver.current = resolve;
        setPendingConfirm({
          message,
          confirmLabel: options?.confirmLabel ?? "Confirm",
          destructive: options?.destructive ?? false,
        });
      }),
    []
  );

  const resolveConfirm = useCallback((accepted: boolean) => {
    const resolve = confirmResolver.current;
    confirmResolver.current = null;
    setPendingConfirm(null);
    resolve?.(accepted);
  }, []);

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
        // "all" was removed as a filter – fall back to unread for old prefs.
        if (stored.pref_filter === "read" || stored.pref_filter === "unread") {
          setFilter(stored.pref_filter as FilterType);
        }
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

      try {
        setHighlightedTabCount((await collectHighlightedTabs()).length);
      } catch (_err) {
        // Highlight query may fail in some contexts (e.g. incognito)
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
  // Selection upkeep
  // -----------------------------------------------------------------------

  // Drop ids that no longer exist (deleted, or refreshed away by another client)
  useEffect(() => {
    setSelectedIds((prev) => {
      if (prev.size === 0) return prev;
      const existing = new Set(links.map((l) => l.id));
      const next = new Set<string>();
      for (const id of prev) {
        if (existing.has(id)) next.add(id);
      }
      return next.size === prev.size ? prev : next;
    });
  }, [links]);

  // Filter and search redefine "all visible" – acting on hidden selections
  // would be surprising, so the selection is dropped.
  useEffect(() => {
    setSelectedIds((prev) => (prev.size === 0 ? prev : new Set<string>()));
  }, [filter, searchQuery]);

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

  /** Saved + unread current tab: remove it again. Otherwise save it. */
  const toggleCurrentLink = useCallback(async () => {
    const existing = currentTab.url
      ? links.find((l) => l.url === currentTab.url && !l.isRead)
      : undefined;

    if (!existing) {
      await saveCurrentLink();
      return;
    }

    try {
      const client = getClient(configRef.current);
      await client.deleteLink(existing.id);
      showStatus("Removed from ReadLater.", "success");
      await doRefreshLinks(configRef.current);
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Removal failed.";
      console.error("ReadLater: toggleCurrentLink error", err);
      showStatus(message, "error");
    }
  }, [
    currentTab.url,
    links,
    saveCurrentLink,
    doRefreshLinks,
    showStatus,
  ]);

  const saveTabsOrToggleCurrent = useCallback(async () => {
    if (savingTabs) return;

    let items: TabToSave[] = [];
    try {
      items = await collectHighlightedTabs();
    } catch (err) {
      console.error("ReadLater: could not read highlighted tabs", err);
    }

    // Nothing multi-selected (or nothing saveable): toggle the current tab.
    if (items.length < 2) {
      await toggleCurrentLink();
      return;
    }

    const label = `${items.length} selected tabs`;
    const accepted = await askConfirm(`Save ${label}?`, {
      confirmLabel: "Save",
    });
    if (!accepted) return;

    setSavingTabs(true);
    try {
      showStatus(`Saving ${label}…`, "info");
      const client = getClient(configRef.current);
      const result = await client.addLinks(items);

      const saved = result.added.length + result.reactivated.length;
      const skipped = result.skipped.length;
      if (saved === 0) {
        showStatus(`All ${label} already saved.`, "info");
      } else if (skipped > 0) {
        showStatus(
          `Saved ${saved}, skipped ${skipped} already saved.`,
          "success"
        );
      } else {
        showStatus(
          `Saved ${saved} ${saved === 1 ? "tab" : "tabs"}.`,
          "success"
        );
      }
      await doRefreshLinks(configRef.current);
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Saving tabs failed.";
      console.error("ReadLater: saveTabsOrToggleCurrent error", err);
      showStatus(message, "error");
    } finally {
      setSavingTabs(false);
    }
  }, [savingTabs, toggleCurrentLink, askConfirm, doRefreshLinks, showStatus]);

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

  const openTab = useCallback(async (url: string, active: boolean) => {
    try {
      await browser.tabs.create({ url, active });
      return true;
    } catch (err) {
      console.error("ReadLater: failed to open link", url, err);
      return false;
    }
  }, []);

  const openInBackgroundTab = useCallback(
    (url: string) => openTab(url, false),
    [openTab]
  );

  /** Single link: bring the tab to the foreground (closes the popup). */
  const openLink = useCallback(
    async (url: string) => {
      const ok = await openTab(url, true);
      if (!ok) showStatus("Could not open link.", "error");
    },
    [openTab, showStatus]
  );

  const handleDeleteLink = useCallback(
    async (id: string) => {
      const accepted = await askConfirm("Delete this link?", {
        confirmLabel: "Delete",
        destructive: true,
      });
      if (!accepted) return;
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
    [askConfirm, doRefreshLinks, showStatus]
  );

  const toggleSelected = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedIds(new Set<string>());
  }, []);

  const toggleSelectAllVisible = useCallback(() => {
    setSelectedIds((prev) => {
      const allSelected =
        visibleLinks.length > 0 &&
        visibleLinks.every((l) => prev.has(l.id));
      return allSelected
        ? new Set<string>()
        : new Set(visibleLinks.map((l) => l.id));
    });
  }, [visibleLinks]);

  const openSelected = useCallback(async () => {
    const targets = selectedLinks;
    if (targets.length === 0) return;

    let opened = 0;
    for (const link of targets) {
      if (await openInBackgroundTab(link.url)) opened += 1;
    }

    clearSelection();
    if (opened === 0) {
      showStatus("Could not open any links.", "error");
      return;
    }
    showStatus(
      `Opened ${opened} ${opened === 1 ? "link" : "links"}.`,
      "success"
    );
  }, [selectedLinks, openInBackgroundTab, clearSelection, showStatus]);

  const markSelectedRead = useCallback(async () => {
    const targets = selectedLinks;
    if (targets.length === 0) return;

    showStatus("Updating...", "info");
    try {
      const client = getClient(configRef.current);
      await client.markAsRead(targets.map((l) => l.id));
      clearSelection();
      showStatus(
        `Marked ${targets.length} ${
          targets.length === 1 ? "link" : "links"
        } as read.`,
        "success"
      );
      await doRefreshLinks(configRef.current);
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Failed to update.";
      console.error("ReadLater: markSelectedRead error", err);
      showStatus(message, "error");
    }
  }, [selectedLinks, clearSelection, doRefreshLinks, showStatus]);

  const markSelectedUnread = useCallback(async () => {
    const targets = selectedLinks;
    if (targets.length === 0) return;

    showStatus("Updating...", "info");
    try {
      const client = getClient(configRef.current);
      await client.markAsUnread(targets.map((l) => l.id));
      clearSelection();
      showStatus(
        `Marked ${targets.length} ${
          targets.length === 1 ? "link" : "links"
        } as unread.`,
        "success"
      );
      await doRefreshLinks(configRef.current);
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Failed to update.";
      console.error("ReadLater: markSelectedUnread error", err);
      showStatus(message, "error");
    }
  }, [selectedLinks, clearSelection, doRefreshLinks, showStatus]);

  const deleteSelected = useCallback(async () => {
    const targets = selectedLinks;
    if (targets.length === 0) return;

    const label = `${targets.length} ${
      targets.length === 1 ? "link" : "links"
    }`;
    const accepted = await askConfirm(`Delete ${label}?`, {
      confirmLabel: "Delete",
      destructive: true,
    });
    if (!accepted) return;

    try {
      const client = getClient(configRef.current);
      await client.deleteLinks(targets.map((l) => l.id));
      clearSelection();
      showStatus(`Deleted ${label}.`, "success");
      await doRefreshLinks(configRef.current);
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Deletion failed.";
      console.error("ReadLater: deleteSelected error", err);
      showStatus(message, "error");
    }
  }, [selectedLinks, askConfirm, clearSelection, doRefreshLinks, showStatus]);

  // -----------------------------------------------------------------------
  // Context value
  // -----------------------------------------------------------------------

  const value = useMemo<ReadLaterContextValue>(
    () => ({
      config,
      isConfigured,
      links,
      visibleLinks,
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
      loginStatus,
      connectToNextcloud,
      disconnect,
      setBasePath,
      refreshLinks,
      testConnection,
      saveCurrentLink,
      saveTabsOrToggleCurrent,
      highlightedTabCount,
      savingTabs,
      handleToggleRead,
      handleDeleteLink,
      selectedIds,
      selectedCount,
      toggleSelected,
      toggleSelectAllVisible,
      clearSelection,
      openSelected,
      selectedAllRead,
      markSelectedRead,
      markSelectedUnread,
      deleteSelected,
      openLink,
      pendingConfirm,
      resolveConfirm,
    }),
    [
      config,
      isConfigured,
      links,
      visibleLinks,
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
      loginStatus,
      connectToNextcloud,
      disconnect,
      setBasePath,
      refreshLinks,
      testConnection,
      saveCurrentLink,
      saveTabsOrToggleCurrent,
      highlightedTabCount,
      savingTabs,
      handleToggleRead,
      handleDeleteLink,
      selectedIds,
      selectedCount,
      toggleSelected,
      toggleSelectAllVisible,
      clearSelection,
      openSelected,
      selectedAllRead,
      markSelectedRead,
      markSelectedUnread,
      deleteSelected,
      openLink,
      pendingConfirm,
      resolveConfirm,
    ],
  );

  return (
    <ReadLaterContext.Provider value={value}>
      {children}
    </ReadLaterContext.Provider>
  );
}
