import React, { useState, useEffect, useMemo } from "react";
import browser from "webextension-polyfill";
import { LinkKeepClient, WebDAVConfig, Link } from "@linkkeep/core";
import { Settings, Save, CheckCircle2, AlertCircle, Link2, ExternalLink, Trash2, RefreshCw } from "lucide-react";

type FilterType = "all" | "read" | "unread";
type SortType = "newest" | "oldest" | "alpha";

export default function App() {
  const [config, setConfig] = useState<WebDAVConfig>({ url: "", username: "", password: "" });
  const [isConfigured, setIsConfigured] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [currentTab, setCurrentTab] = useState<{ url?: string; title?: string }>({});
  const [links, setLinks] = useState<Link[]>([]);
  const [loading, setLoading] = useState(false);
  
  const [filter, setFilter] = useState<FilterType>("all");
  const [sortBy, setSortBy] = useState<SortType>("newest");

  const [status, setStatus] = useState<{ message: string; type: "success" | "error" | "info" | null }>({
    message: "",
    type: null,
  });

  const isAlreadySavedAndUnread = useMemo(() => {
    if (!currentTab.url) return false;
    return links.some(l => l.url === currentTab.url && !l.isRead);
  }, [links, currentTab.url]);

  useEffect(() => {
    async function init() {
      // Load initial data and cache
      try {
        const result = await browser.storage.local.get(["webdav_url", "webdav_user", "webdav_pass", "links_cache"]);
        
        // Show cached links immediately for better UX
        if (result.links_cache) {
          setLinks(result.links_cache as Link[]);
        }

        if (result.webdav_url && result.webdav_user) {
          const loadedConfig: WebDAVConfig = {
            url: result.webdav_url as string,
            username: result.webdav_user as string,
            password: (result.webdav_pass as string) || "",
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

  const fetchLinks = async (cfg: WebDAVConfig) => {
    setLoading(true);
    try {
      const client = new LinkKeepClient(cfg);
      const store = await client.fetchLinks();
      setLinks(store.links);
      
      // Update cache
      await browser.storage.local.set({ links_cache: store.links });
      // Notify background script to update badge
      browser.runtime.sendMessage({ type: "SYNC_LINKS" });
      
    } catch (error) {
      setStatus({ message: "Sync failed.", type: "error" });
    } finally {
      setLoading(false);
    }
  };

  const saveCurrentLink = async () => {
    if (!currentTab.url || !currentTab.title || isAlreadySavedAndUnread) return;
    setStatus({ message: "Saving...", type: "info" });
    try {
      const client = new LinkKeepClient(config);
      await client.addLink({
        url: currentTab.url,
        title: currentTab.title,
        tags: [],
      });
      setStatus({ message: "Saved!", type: "success" });
      await fetchLinks(config);
    } catch (error: any) {
      setStatus({ message: error.message || "Failed to save.", type: "error" });
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

  return (
    <div className="w-[360px] min-h-[500px] max-h-[600px] bg-background text-foreground antialiased flex flex-col overflow-x-hidden">
      <header className="px-4 py-3 border-b flex items-center justify-between bg-white sticky top-0 z-10 shadow-sm">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center shadow-md shadow-primary/20">
            <Link2 className="text-white w-5 h-5" />
          </div>
          <h1 className="font-bold text-lg tracking-tight">LinkKeep</h1>
        </div>
        <div className="flex items-center gap-1">
          <button 
            onClick={() => fetchLinks(config)}
            className={`p-2 hover:bg-slate-100 rounded-full transition-colors ${loading ? 'animate-spin' : ''}`}
            disabled={loading || !isConfigured}
          >
            <RefreshCw className="w-4 h-4 text-slate-500" />
          </button>
          <button onClick={() => setShowSettings(!showSettings)} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
            <Settings className="w-5 h-5 text-slate-500" />
          </button>
        </div>
      </header>

      <main className="flex-1 flex flex-col overflow-hidden">
        {showSettings ? (
          <div className="p-4 space-y-4 animate-in fade-in slide-in-from-top-2">
            <h2 className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Settings</h2>
            <div className="space-y-3">
              <input placeholder="WebDAV URL" value={config.url} onChange={(e) => setConfig({ ...config, url: e.target.value })} className="w-full px-3 py-2 text-sm border rounded-lg focus:ring-2 focus:ring-primary/20 outline-none" />
              <input placeholder="Username" value={config.username} onChange={(e) => setConfig({ ...config, username: e.target.value })} className="w-full px-3 py-2 text-sm border rounded-lg focus:ring-2 focus:ring-primary/20 outline-none" />
              <input type="password" placeholder="App Password" value={config.password} onChange={(e) => setConfig({ ...config, password: e.target.value })} className="w-full px-3 py-2 text-sm border rounded-lg focus:ring-2 focus:ring-primary/20 outline-none" />
              <button onClick={async () => {
                await browser.storage.local.set({ webdav_url: config.url, webdav_user: config.username, webdav_pass: config.password });
                setIsConfigured(true); setShowSettings(false); fetchLinks(config);
              }} className="w-full py-2.5 bg-primary text-white rounded-lg font-bold hover:bg-primary/90 transition-all shadow-lg shadow-primary/20">Save Settings</button>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex flex-col overflow-hidden">
            <div className="px-4 py-2 bg-slate-50 border-b flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 flex-1 overflow-x-auto no-scrollbar">
                {(["all", "unread", "read"] as FilterType[]).map(f => (
                  <button key={f} onClick={() => setFilter(f)} className={`px-2.5 py-1 rounded-full text-[10px] font-bold capitalize transition-all whitespace-nowrap ${filter === f ? 'bg-primary text-white' : 'bg-white text-slate-500 border'}`}>
                    {f}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-1 border-l pl-2 border-slate-200">
                <select value={sortBy} onChange={(e) => setSortBy(e.target.value as SortType)} className="text-[10px] font-bold text-slate-500 bg-transparent outline-none">
                  <option value="newest">Newest</option>
                  <option value="oldest">Oldest</option>
                  <option value="alpha">A-Z</option>
                </select>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-2 pr-1 custom-scrollbar bg-slate-50/30">
              {processedLinks.length === 0 ? (
                <div className="py-12 text-center text-slate-400 text-xs italic">No matching links found</div>
              ) : (
                processedLinks.map((link) => (
                  <div key={link.id} className={`p-3 rounded-xl border flex flex-col gap-2 transition-all group ${link.isRead ? 'bg-slate-100 opacity-60' : 'bg-white shadow-sm border-slate-200 hover:border-primary/30'}`}>
                    <div className="flex-1 min-w-0">
                      <h3 className={`text-[11px] font-bold truncate ${link.isRead ? 'line-through text-slate-400' : 'text-slate-700'}`}>{link.title}</h3>
                      <p className="text-[9px] text-slate-400 truncate mt-0.5">{link.url}</p>
                    </div>
                    <div className="flex items-center justify-end gap-3 pt-2 mt-1 border-t border-slate-100">
                      <a href={link.url} target="_blank" className="p-1 text-slate-400 hover:text-primary transition-colors"><ExternalLink className="w-3.5 h-3.5" /></a>
                      <button onClick={() => handleToggleRead(link.id, link.isRead)} className={`p-1 transition-colors ${link.isRead ? 'text-green-500' : 'text-slate-400 hover:text-green-500'}`}><CheckCircle2 className="w-3.5 h-3.5" /></button>
                      <button onClick={() => handleDeleteLink(link.id)} className="p-1 text-slate-400 hover:text-red-500 transition-colors"><Trash2 className="w-3.5 h-3.5" /></button>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="p-4 border-t bg-white shadow-up">
              <div className={`p-3 rounded-xl border transition-all mb-3 ${isAlreadySavedAndUnread ? 'bg-green-50 border-green-100' : 'bg-slate-50 border-slate-100'}`}>
                <div className="flex items-start gap-2.5">
                  <div className={`p-1.5 rounded-lg border shadow-sm ${isAlreadySavedAndUnread ? 'bg-white text-green-500 border-green-200' : 'bg-white text-primary border-slate-200'}`}>
                    {isAlreadySavedAndUnread ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Link2 className="w-3.5 h-3.5" />}
                  </div>
                  <div className="flex-1 overflow-hidden">
                    <p className={`text-[9px] font-bold uppercase mb-0.5 ${isAlreadySavedAndUnread ? 'text-green-600' : 'text-slate-400'}`}>
                      {isAlreadySavedAndUnread ? "Already Saved" : "Current Tab"}
                    </p>
                    <h3 className="text-[11px] font-bold truncate text-slate-700 leading-none">{currentTab.title || "---"}</h3>
                  </div>
                </div>
              </div>

              <button
                onClick={saveCurrentLink}
                disabled={status.type === "info" || !isConfigured || isAlreadySavedAndUnread}
                className={`w-full flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-sm transition-all shadow-lg active:scale-[0.97] disabled:opacity-50 disabled:active:scale-100 ${
                  isAlreadySavedAndUnread ? 'bg-green-500 text-white shadow-green-200' : 'bg-primary text-white shadow-primary/20 hover:bg-primary/90'
                }`}
              >
                {isAlreadySavedAndUnread ? <CheckCircle2 className="w-5 h-5" /> : <Save className="w-5 h-5" />}
                {isAlreadySavedAndUnread ? "In your Collection" : "Keep this Link"}
              </button>
            </div>
          </div>
        )}
      </main>

      {status.message && (
        <footer className={`px-4 py-2 text-[10px] flex items-center gap-2 border-t ${status.type === "error" ? "bg-red-50 text-red-600" : status.type === "success" ? "bg-green-50 text-green-700" : "bg-slate-50 text-slate-500"}`}>
          <span className="font-bold">{status.message}</span>
        </footer>
      )}
    </div>
  );
}
