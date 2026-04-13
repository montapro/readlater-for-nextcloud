import React, { useState, useEffect } from "react";
import browser from "webextension-polyfill";
import { LinkKeepClient, WebDAVConfig, Link } from "@linkkeep/core";
import { Settings, Save, CheckCircle2, AlertCircle, Link2, ExternalLink, Trash2, RefreshCw } from "lucide-react";

export default function App() {
  const [config, setConfig] = useState<WebDAVConfig>({
    url: "",
    username: "",
    password: "",
  });
  const [isConfigured, setIsConfigured] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [currentTab, setCurrentTab] = useState<{ url?: string; title?: string }>({});
  const [links, setLinks] = useState<Link[]>([]);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<{ message: string; type: "success" | "error" | "info" | null }>({
    message: "",
    type: null,
  });

  useEffect(() => {
    async function init() {
      try {
        const result = await browser.storage.local.get(["webdav_url", "webdav_user", "webdav_pass"]);
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
    } catch (error) {
      console.error(error);
      setStatus({ message: "Failed to fetch list.", type: "error" });
    } finally {
      setLoading(false);
    }
  };

  const saveConfig = async () => {
    try {
      await browser.storage.local.set({
        webdav_url: config.url,
        webdav_user: config.username,
        webdav_pass: config.password,
      });
      setIsConfigured(true);
      setShowSettings(false);
      setStatus({ message: "Settings saved!", type: "success" });
      fetchLinks(config);
      setTimeout(() => setStatus({ message: "", type: null }), 3000);
    } catch (err) {
      setStatus({ message: "Error saving settings.", type: "error" });
    }
  };

  const saveCurrentLink = async () => {
    if (!currentTab.url || !currentTab.title) return;
    setStatus({ message: "Saving...", type: "info" });
    try {
      const client = new LinkKeepClient(config);
      await client.addLink({
        url: currentTab.url,
        title: currentTab.title,
        tags: [],
      });
      setStatus({ message: "Saved!", type: "success" });
      fetchLinks(config);
    } catch (error) {
      setStatus({ message: "Failed to save.", type: "error" });
    }
  };

  const handleToggleRead = async (id: string, isRead: boolean) => {
    try {
      const client = new LinkKeepClient(config);
      await client.updateLink(id, { isRead: !isRead });
      fetchLinks(config);
    } catch (error) {
      setStatus({ message: "Update failed.", type: "error" });
    }
  };

  const handleDeleteLink = async (id: string) => {
    if (!confirm("Delete this link?")) return;
    try {
      const client = new LinkKeepClient(config);
      await client.deleteLink(id);
      fetchLinks(config);
    } catch (error) {
      setStatus({ message: "Delete failed.", type: "error" });
    }
  };

  return (
    <div className="w-[360px] min-h-[450px] max-h-[600px] bg-background text-foreground antialiased flex flex-col overflow-x-hidden">
      <header className="px-4 py-3 border-b flex items-center justify-between bg-white sticky top-0 z-10 shadow-sm">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
            <Link2 className="text-white w-5 h-5" />
          </div>
          <h1 className="font-bold text-lg tracking-tight">LinkKeep</h1>
        </div>
        <div className="flex items-center gap-1">
           <button 
            onClick={() => fetchLinks(config)}
            className={`p-2 hover:bg-secondary rounded-full transition-colors ${loading ? 'animate-spin' : ''}`}
            disabled={loading || !isConfigured}
          >
            <RefreshCw className="w-4 h-4 text-muted-foreground" />
          </button>
          <button 
            onClick={() => setShowSettings(!showSettings)}
            className="p-2 hover:bg-secondary rounded-full transition-colors"
          >
            <Settings className="w-5 h-5 text-muted-foreground" />
          </button>
        </div>
      </header>

      <main className="flex-1 flex flex-col overflow-hidden">
        {showSettings ? (
          <div className="p-4 space-y-4 animate-in fade-in slide-in-from-top-2 duration-200">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">WebDAV Configuration</h2>
            <div className="space-y-3">
              <input
                placeholder="Nextcloud WebDAV URL"
                value={config.url}
                onChange={(e) => setConfig({ ...config, url: e.target.value })}
                className="w-full px-3 py-2 text-sm border rounded-md outline-none focus:ring-2 focus:ring-primary/20"
              />
              <input
                placeholder="Username"
                value={config.username}
                onChange={(e) => setConfig({ ...config, username: e.target.value })}
                className="w-full px-3 py-2 text-sm border rounded-md outline-none focus:ring-2 focus:ring-primary/20"
              />
              <input
                type="password"
                placeholder="App Password"
                value={config.password}
                onChange={(e) => setConfig({ ...config, password: e.target.value })}
                className="w-full px-3 py-2 text-sm border rounded-md outline-none focus:ring-2 focus:ring-primary/20"
              />
              <button
                onClick={saveConfig}
                className="w-full py-2.5 bg-primary text-white rounded-md font-semibold hover:bg-primary/90 transition-colors"
              >
                Save & Connect
              </button>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex flex-col overflow-hidden p-4">
            {/* LINK LIST: DIRECTLY ABOVE THE SAVE BUTTON */}
            <div className="flex-1 overflow-y-auto mb-4 space-y-2 pr-1 custom-scrollbar">
              <h2 className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2 px-1">Recent Links</h2>
              {loading && links.length === 0 ? (
                <div className="py-10 text-center text-muted-foreground text-sm">Synchronizing...</div>
              ) : links.length === 0 ? (
                <div className="py-10 text-center text-muted-foreground text-sm italic">No links found</div>
              ) : (
                links.slice(0, 8).map((link) => (
                  <div key={link.id} className={`p-3 rounded-lg border flex flex-col gap-2 transition-all ${link.isRead ? 'bg-secondary/20 opacity-60' : 'bg-white shadow-sm border-slate-100'}`}>
                    <div className="flex-1 min-w-0">
                      <h3 className={`text-xs font-semibold truncate leading-tight ${link.isRead ? 'line-through text-muted-foreground' : 'text-slate-800'}`}>{link.title}</h3>
                      <p className="text-[10px] text-muted-foreground truncate font-mono mt-0.5">{link.url}</p>
                    </div>
                    
                    <div className="flex items-center justify-end gap-4 border-t border-slate-50 pt-2 mt-1">
                      <a href={link.url} target="_blank" className="p-1 hover:bg-slate-100 rounded text-slate-400 hover:text-primary transition-colors">
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                      <button 
                        onClick={() => handleToggleRead(link.id, link.isRead)} 
                        className={`p-1 hover:bg-slate-100 rounded transition-colors ${link.isRead ? 'text-green-600' : 'text-slate-400 hover:text-green-600'}`}
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                      </button>
                      <button 
                        onClick={() => handleDeleteLink(link.id)} 
                        className="p-1 hover:bg-slate-100 rounded text-slate-400 hover:text-destructive transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* QUICK SAVE SECTION (BOTTOM) */}
            <div className="border-t pt-4 bg-background">
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 mb-4">
                <p className="text-[9px] font-bold text-slate-400 uppercase mb-1">Active Page</p>
                <div className="flex items-start gap-2">
                  <div className="bg-white p-1.5 rounded-md border border-slate-200 shadow-sm">
                    <Link2 className="w-3.5 h-3.5 text-primary" />
                  </div>
                  <div className="flex-1 overflow-hidden">
                    <h3 className="text-[11px] font-bold truncate text-slate-700 leading-none">{currentTab.title || "---"}</h3>
                    <p className="text-[10px] text-slate-400 truncate mt-1 italic">{currentTab.url}</p>
                  </div>
                </div>
              </div>

              <button
                onClick={saveCurrentLink}
                disabled={status.type === "info" || !isConfigured}
                className="w-full flex items-center justify-center gap-2 py-3.5 bg-primary text-white rounded-xl font-bold text-sm hover:bg-primary/90 transition-all shadow-lg shadow-primary/20 active:scale-[0.97] disabled:opacity-50"
              >
                <Save className="w-5 h-5" />
                Keep this Link
              </button>
            </div>
          </div>
        )}
      </main>

      {status.message && (
        <footer className={`px-4 py-2 text-[10px] flex items-center gap-2 animate-in slide-in-from-bottom-1 border-t ${
          status.type === "error" ? "bg-red-50 text-red-600 border-red-100" : 
          status.type === "success" ? "bg-green-50 text-green-700 border-green-100" : 
          "bg-slate-50 text-slate-500 border-slate-100"
        }`}>
          {status.type === "success" && <CheckCircle2 className="w-3 h-3" />}
          {status.type === "error" && <AlertCircle className="w-3 h-3" />}
          <span className="font-semibold">{status.message}</span>
        </footer>
      )}
    </div>
  );
}
