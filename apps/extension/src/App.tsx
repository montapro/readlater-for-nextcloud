import React, { useState, useEffect, useMemo } from "react";
import browser from "webextension-polyfill";
import { LinkKeepClient, WebDAVConfig, Link } from "@linkkeep/core";
import { Settings, Save, CheckCircle2, AlertCircle, Link2, ExternalLink, Trash2, RefreshCw, CheckCheck, Wifi, Moon, Sun, Monitor, LogIn, BookOpen } from "lucide-react";

type FilterType = "all" | "read" | "unread";
type SortType = "newest" | "oldest" | "alpha";
type ThemeType = "system" | "light" | "dark";

export default function App() {
  const [config, setConfig] = useState<WebDAVConfig>({ url: "" });
  const [isConfigured, setIsConfigured] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [currentTab, setCurrentTab] = useState<{ url?: string; title?: string }>({});
  const [links, setLinks] = useState<Link[]>([]);
  const [loading, setLoading] = useState(false);
  const [testingConnection, setTestingConnection] = useState(false);
  
  const [filter, setFilter] = useState<FilterType>("all");
  const [sortBy, setSortBy] = useState<SortType>("newest");
  const [theme, setTheme] = useState<ThemeType>("system");

  const [status, setStatus] = useState<{ message: string; type: "success" | "error" | "info" | null }>({
    message: "",
    type: null,
  });

  const isAlreadySavedAndUnread = useMemo(() => {
    if (!currentTab.url) return false;
    return links.some(l => l.url === currentTab.url && !l.isRead);
  }, [links, currentTab.url]);

  // Extract base Nextcloud URL for login button
  const nextcloudBaseUrl = useMemo(() => {
    if (!config.url) return null;
    try {
      const url = new URL(config.url);
      return `${url.protocol}//${url.host}`;
    } catch (e) {
      return null;
    }
  }, [config.url]);

  useEffect(() => {
    async function init() {
      try {
        const result = await browser.storage.local.get([
          "webdav_url", 
          "links_cache",
          "pref_filter",
          "pref_sortBy",
          "pref_theme"
        ]);
        
        if (result.links_cache) setLinks(result.links_cache as Link[]);
        if (result.pref_filter) setFilter(result.pref_filter as FilterType);
        if (result.pref_sortBy) setSortBy(result.pref_sortBy as SortType);
        if (result.pref_theme) setTheme(result.pref_theme as ThemeType);

        if (result.webdav_url) {
          const loadedConfig: WebDAVConfig = {
            url: result.webdav_url as string,
          };
          setConfig(loadedConfig);
          setIsConfigured(true);
          fetchLinks(loadedConfig);
        } else {
          setShowSettings(true);
        }
      } catch (err) {
        setShowSettings(true);
      }

      try {
        const tabs = await browser.tabs.query({ active: true, currentWindow: true });
        const activeTab = tabs[0];
        if (activeTab) {
          setCurrentTab({ url: activeTab.url, title: activeTab.title });
        }
      } catch (err) {}
    }
    init();
  }, []);

  useEffect(() => {
    const root = window.document.documentElement;
    const isDark = theme === "dark" || (theme === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
    if (isDark) root.classList.add("dark"); else root.classList.remove("dark");
    browser.storage.local.set({ pref_theme: theme });
  }, [theme]);

  useEffect(() => {
    browser.storage.local.set({ pref_filter: filter, pref_sortBy: sortBy });
  }, [filter, sortBy]);

  const fetchLinks = async (cfg: WebDAVConfig) => {
    setLoading(true);
    try {
      const client = new LinkKeepClient(cfg);
      const store = await client.fetchLinks();
      setLinks(store.links);
      await browser.storage.local.set({ links_cache: store.links });
    } catch (error: any) {
      setStatus({ message: error.message || "Sync failed.", type: "error" });
    } finally {
      setLoading(false);
    }
  };

  const testConnection = async () => {
    setTestingConnection(true);
    setStatus({ message: "Checking session...", type: "info" });
    try {
      const client = new LinkKeepClient(config);
      const ok = await client.verifyConnection();
      if (ok) {
        setStatus({ message: "Nextcloud connected!", type: "success" });
      } else {
        setStatus({ message: "Access denied. Are you logged in?", type: "error" });
      }
    } catch (err) {
      setStatus({ message: "Could not reach server.", type: "error" });
    } finally {
      setTestingConnection(false);
    }
  };

  const handleSaveSettings = async () => {
    if (!config.url) return;
    setLoading(true);
    try {
      await browser.storage.local.set({ webdav_url: config.url });
      const client = new LinkKeepClient(config);
      const store = await client.fetchLinks();
      setLinks(store.links);
      await browser.storage.local.set({ links_cache: store.links });
      setIsConfigured(true);
      setShowSettings(false);
      setStatus({ message: "URL saved!", type: "success" });
    } catch (err: any) {
      setStatus({ message: err.message, type: "error" });
    } finally {
      setLoading(false);
    }
  };

  const saveCurrentLink = async () => {
    if (!currentTab.url || !currentTab.title || isAlreadySavedAndUnread) return;
    setStatus({ message: "Saving...", type: "info" });
    try {
      const client = new LinkKeepClient(config);
      await client.addLink({ url: currentTab.url, title: currentTab.title, tags: [] });
      setStatus({ message: "Saved!", type: "success" });
      await fetchLinks(config);
    } catch (error: any) {
      setStatus({ message: error.message, type: "error" });
    }
  };

  const handleToggleRead = async (id: string, isRead: boolean) => {
    try {
      const client = new LinkKeepClient(config);
      await client.updateLink(id, { isRead: !isRead });
      await fetchLinks(config);
    } catch (error) {
      setStatus({ message: "Update failed.", type: "error" });
    }
  };

  const handleDeleteLink = async (id: string) => {
    if (!confirm("Delete this link?")) return;
    try {
      const client = new LinkKeepClient(config);
      await client.deleteLink(id);
      await fetchLinks(config);
    } catch (error) {
      setStatus({ message: "Delete failed.", type: "error" });
    }
  };

  const handleMarkAllRead = async () => {
    if (!confirm("Mark all links as read?")) return;
    setStatus({ message: "Updating...", type: "info" });
    try {
      const client = new LinkKeepClient(config);
      await client.markAllAsRead();
      setStatus({ message: "All marked as read!", type: "success" });
      await fetchLinks(config);
    } catch (error) {
      setStatus({ message: "Failed to update.", type: "error" });
    }
  };

  const handleDeleteAll = async () => {
    if (!confirm("DANGER: Delete ALL links permanently?")) return;
    setStatus({ message: "Deleting everything...", type: "info" });
    try {
      const client = new LinkKeepClient(config);
      await client.deleteAllLinks();
      setStatus({ message: "All links deleted.", type: "success" });
      await fetchLinks(config);
    } catch (error) {
      setStatus({ message: "Deletion failed.", type: "error" });
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInMs = now.getTime() - date.getTime();
    const diffInDays = diffInMs / (1000 * 60 * 60 * 24);
    if (diffInDays < 1) {
      const diffInHours = Math.floor(diffInMs / (1000 * 60 * 60));
      if (diffInHours < 1) {
        const diffInMins = Math.floor(diffInMs / (1000 * 60));
        return diffInMins <= 1 ? "Just now" : `${diffInMins}m ago`;
      }
      return `${diffInHours}h ago`;
    }
    if (diffInDays < 2) return "Yesterday";
    return date.toISOString().split("T")[0];
  };

  const processedLinks = useMemo(() => {
    let result = [...links];
    if (filter === "read") result = result.filter(l => l.isRead);
    if (filter === "unread") result = result.filter(l => !l.isRead);
    result.sort((a, b) => {
      if (sortBy === "newest") return new Date(b.addedAt).getTime() - new Date(a.addedAt).getTime();
      if (sortBy === "oldest") return new Date(a.addedAt).getTime() - new Date(b.addedAt).getTime();
      if (sortBy === "alpha") return a.title.localeCompare(b.title);
      return 0;
    });
    return result;
  }, [links, filter, sortBy]);

  const hasUnread = useMemo(() => links.some(l => !l.isRead), [links]);

  return (
    <div className="w-[360px] min-h-[500px] max-h-[600px] bg-background text-foreground antialiased flex flex-col overflow-x-hidden transition-colors duration-300">
      <header className="px-4 py-3 border-b flex items-center justify-between bg-card sticky top-0 z-10 shadow-sm border-border">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center shadow-md shadow-primary/20">
            <Link2 className="text-white w-5 h-5" />
          </div>
          <h1 className="font-bold text-lg tracking-tight text-slate-800 dark:text-slate-100">LinkKeep</h1>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={() => fetchLinks(config)} className={`p-2 hover:bg-muted rounded-full transition-colors cursor-pointer disabled:cursor-default ${loading ? 'animate-spin' : ''}`} disabled={loading || !isConfigured}>
            <RefreshCw className="w-4 h-4 text-muted-foreground" />
          </button>
          <button onClick={() => setShowSettings(!showSettings)} className={`p-2 rounded-full transition-colors cursor-pointer ${showSettings ? 'bg-primary/10 text-primary' : 'hover:bg-muted text-muted-foreground'}`}>
            <Settings className="w-5 h-5" />
          </button>
        </div>
      </header>

      <main className="flex-1 flex flex-col overflow-hidden bg-background">
        {showSettings ? (
          <div className="p-4 space-y-6 animate-in fade-in slide-in-from-top-2 overflow-y-auto">
            <section className="space-y-3">
              <h2 className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Setup</h2>
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                Enter your WebDAV URL. To sync, you must be logged into your Nextcloud in this browser.
              </p>
              <div className="space-y-3">
                <input placeholder="https://cloud.com/remote.php/dav/files/user/" value={config.url} onChange={(e) => setConfig({ ...config, url: e.target.value })} className="w-full px-3 py-2 text-sm border bg-card rounded-lg focus:ring-2 focus:ring-primary/20 outline-none border-border" />
                
                <div className="grid grid-cols-2 gap-2">
                  <button onClick={testConnection} disabled={testingConnection || loading || !config.url} className="flex items-center justify-center gap-2 py-2 border border-border text-foreground rounded-lg font-semibold hover:bg-muted transition-all cursor-pointer disabled:opacity-50">
                    <Wifi className={`w-4 h-4 ${testingConnection ? 'animate-pulse' : ''}`} /> Test
                  </button>
                  <button onClick={handleSaveSettings} disabled={loading || testingConnection || !config.url} className="py-2 bg-primary text-primary-foreground rounded-lg font-bold hover:bg-primary/90 transition-all shadow-lg shadow-primary/20 cursor-pointer disabled:opacity-50">
                    Save URL
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 pt-2">
                <a 
                  href={nextcloudBaseUrl || "#"} 
                  target="_blank" 
                  className={`flex items-center justify-center gap-2 py-2 border border-border text-foreground rounded-lg text-xs font-semibold hover:bg-muted transition-all cursor-pointer ${!nextcloudBaseUrl ? 'opacity-50 pointer-events-none' : ''}`}
                >
                  <LogIn className="w-3.5 h-3.5" /> Nextcloud Login
                </a>
                <a 
                  href="https://docs.nextcloud.com/server/latest/user_manual/en/files/access_webdav.html" 
                  target="_blank" 
                  className="flex items-center justify-center gap-2 py-2 border border-border text-foreground rounded-lg text-xs font-semibold hover:bg-muted transition-all cursor-pointer"
                >
                  <BookOpen className="w-3.5 h-3.5" /> WebDAV Help
                </a>
              </div>
            </section>

            <section className="space-y-3 border-t border-border pt-4">
              <h2 className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Appearance</h2>
              <div className="flex bg-muted p-1 rounded-xl">
                {(["system", "light", "dark"] as ThemeType[]).map((t) => (
                  <button key={t} onClick={() => setTheme(t)} className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer ${theme === t ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}>
                    {t === "system" && <Monitor className="w-3.5 h-3.5" />}
                    {t === "light" && <Sun className="w-3.5 h-3.5" />}
                    {t === "dark" && <Moon className="w-3.5 h-3.5" />}
                    <span className="capitalize">{t}</span>
                  </button>
                ))}
              </div>
            </section>
          </div>
        ) : (
          <div className="flex-1 flex flex-col overflow-hidden">
            <div className="px-4 py-2 bg-muted/50 border-b border-border flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 flex-1 overflow-x-auto no-scrollbar">
                {(["all", "unread", "read"] as FilterType[]).map(f => (
                  <button key={f} onClick={() => setFilter(f)} className={`px-2.5 py-1 rounded-full text-[10px] font-bold capitalize transition-all whitespace-nowrap cursor-pointer ${filter === f ? 'bg-primary text-primary-foreground shadow-sm' : 'bg-card text-muted-foreground border border-border hover:bg-muted'}`}>
                    {f}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-1 border-l border-border pl-2">
                <select value={sortBy} onChange={(e) => setSortBy(e.target.value as SortType)} className="text-[10px] font-bold text-muted-foreground bg-transparent outline-none cursor-pointer">
                  <option value="newest">Newest</option>
                  <option value="oldest">Oldest</option>
                  <option value="alpha">A-Z</option>
                </select>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-2 custom-scrollbar">
              <div className="flex items-center justify-between mb-2">
                <h2 className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground px-1">Recent Links</h2>
                {links.length > 0 && (
                  <div className="flex items-center gap-2">
                    <button onClick={handleMarkAllRead} disabled={!hasUnread} className={`transition-colors cursor-pointer disabled:cursor-default ${!hasUnread ? 'text-muted/30' : 'text-muted-foreground hover:text-green-500'}`} title="Mark all as read">
                      <CheckCheck className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={handleDeleteAll} className="text-muted-foreground hover:text-destructive transition-colors cursor-pointer" title="Delete all">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </div>
              
              {processedLinks.length === 0 ? (
                <div className="py-12 text-center text-muted-foreground text-xs italic">No matching links found</div>
              ) : (
                processedLinks.map((link) => (
                  <div key={link.id} className={`p-3 rounded-xl border flex flex-col gap-2 transition-all group ${link.isRead ? 'bg-muted/30 opacity-60' : 'bg-card shadow-sm border-border hover:border-primary/30'}`}>
                    <div className="flex-1 min-w-0">
                      <h3 className={`text-[11px] font-bold truncate ${link.isRead ? 'line-through text-muted-foreground' : 'text-foreground'}`}>{link.title}</h3>
                      <p className="text-[9px] text-muted-foreground truncate mt-0.5 font-mono">{link.url}</p>
                    </div>
                    <div className="flex items-center justify-between pt-2 mt-1 border-t border-border/50">
                      <span className="text-[9px] text-muted-foreground font-medium">{formatDate(link.addedAt)}</span>
                      <div className="flex items-center gap-3">
                        <a href={link.url} target="_blank" className="p-1 text-muted-foreground hover:text-primary transition-colors cursor-pointer"><ExternalLink className="w-3.5 h-3.5" /></a>
                        <button onClick={() => handleToggleRead(link.id, link.isRead)} className={`p-1 transition-colors cursor-pointer ${link.isRead ? 'text-green-500' : 'text-muted-foreground hover:text-green-500'}`}><CheckCircle2 className="w-3.5 h-3.5" /></button>
                        <button onClick={() => handleDeleteLink(link.id)} className="p-1 text-muted-foreground hover:text-destructive transition-colors cursor-pointer"><Trash2 className="w-3.5 h-3.5" /></button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="p-4 border-t border-border bg-card shadow-lg">
              <div className={`p-3 rounded-xl border transition-all mb-3 ${isAlreadySavedAndUnread ? 'bg-primary/5 border-primary/20' : 'bg-muted/30 border-border'}`}>
                <div className="flex items-start gap-2.5">
                  <div className={`p-1.5 rounded-lg border shadow-sm ${isAlreadySavedAndUnread ? 'bg-primary text-primary-foreground border-primary/20' : 'bg-card text-primary border-border'}`}>
                    {isAlreadySavedAndUnread ? <CheckCheck className="w-3.5 h-3.5" /> : <Link2 className="w-3.5 h-3.5" />}
                  </div>
                  <div className="flex-1 overflow-hidden">
                    <p className={`text-[9px] font-bold uppercase mb-0.5 ${isAlreadySavedAndUnread ? 'text-primary' : 'text-muted-foreground'}`}>
                      {isAlreadySavedAndUnread ? "Already Saved" : "Current Tab"}
                    </p>
                    <h3 className="text-[11px] font-bold truncate text-foreground leading-none">{currentTab.title || "---"}</h3>
                  </div>
                </div>
              </div>

              <button
                onClick={saveCurrentLink}
                disabled={status.type === "info" || loading || !isConfigured || isAlreadySavedAndUnread}
                className={`w-full flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-sm transition-all shadow-lg active:scale-[0.97] disabled:opacity-50 disabled:active:scale-100 cursor-pointer disabled:cursor-default ${
                  isAlreadySavedAndUnread ? 'bg-muted text-muted-foreground shadow-none border border-border' : 'bg-primary text-primary-foreground shadow-primary/20 hover:bg-primary/90'
                }`}
              >
                {isAlreadySavedAndUnread ? <CheckCircle2 className="w-5 h-5" /> : <Save className="w-5 h-5" />}
                {isAlreadySavedAndUnread ? "Saved & Unread" : "Keep this Link"}
              </button>
            </div>
          </div>
        )}
      </main>

      {status.message && (
        <footer className={`px-4 py-2 text-[10px] flex items-center gap-2 border-t border-border ${status.type === "error" ? "bg-destructive/10 text-destructive" : status.type === "success" ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}>
          <span className="font-bold">{status.message}</span>
        </footer>
      )}
    </div>
  );
}
