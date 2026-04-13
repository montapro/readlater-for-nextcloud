import React, { useState, useEffect } from "react";
import { LinkKeepClient, WebDAVConfig } from "@linkkeep/core";
import { Settings, Save, CheckCircle2, AlertCircle, Link2, ExternalLink } from "lucide-react";

export default function App() {
  const [config, setConfig] = useState<WebDAVConfig>({
    url: "",
    username: "",
    password: "",
  });
  const [isConfigured, setIsConfigured] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [currentTab, setCurrentTab] = useState<{ url?: string; title?: string }>({});
  const [status, setStatus] = useState<{ message: string; type: "success" | "error" | "info" | null }>({
    message: "",
    type: null,
  });

  useEffect(() => {
    if (typeof chrome !== "undefined" && chrome.storage) {
      chrome.storage.local.get(["webdav_url", "webdav_user", "webdav_pass"], (result: { [key: string]: any }) => {
        if (result.webdav_url && result.webdav_user) {
          const loadedConfig: WebDAVConfig = {
            url: result.webdav_url as string,
            username: result.webdav_user as string,
            password: (result.webdav_pass as string) || "",
          };
          setConfig(loadedConfig);
          setIsConfigured(true);
        } else {
          setShowSettings(true);
        }
      });
    }

    if (typeof chrome !== "undefined" && chrome.tabs) {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        const activeTab = tabs[0];
        if (activeTab) {
          setCurrentTab({ url: activeTab.url, title: activeTab.title });
        }
      });
    }
  }, []);

  const saveConfig = () => {
    if (typeof chrome !== "undefined" && chrome.storage) {
      chrome.storage.local.set(
        {
          webdav_url: config.url,
          webdav_user: config.username,
          webdav_pass: config.password,
        },
        () => {
          setIsConfigured(true);
          setShowSettings(false);
          setStatus({ message: "Settings saved!", type: "success" });
          setTimeout(() => setStatus({ message: "", type: null }), 3000);
        }
      );
    }
  };

  const saveCurrentLink = async () => {
    if (!currentTab.url || !currentTab.title) {
      setStatus({ message: "No active tab found.", type: "error" });
      return;
    }

    setStatus({ message: "Saving to Nextcloud...", type: "info" });
    try {
      const client = new LinkKeepClient(config);
      await client.addLink({
        url: currentTab.url,
        title: currentTab.title,
        tags: [],
      });
      setStatus({ message: "Saved successfully!", type: "success" });
    } catch (error) {
      console.error(error);
      setStatus({ message: "Failed to save. Check settings.", type: "error" });
    }
  };

  return (
    <div className="w-[350px] min-h-[250px] bg-background text-foreground antialiased flex flex-col">
      {/* Header */}
      <header className="px-4 py-3 border-b flex items-center justify-between bg-white sticky top-0 z-10">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
            <Link2 className="text-white w-5 h-5" />
          </div>
          <h1 className="font-bold text-lg tracking-tight">LinkKeep</h1>
        </div>
        <button 
          onClick={() => setShowSettings(!showSettings)}
          className="p-2 hover:bg-secondary rounded-full transition-colors"
          title="Settings"
        >
          <Settings className="w-5 h-5 text-muted-foreground" />
        </button>
      </header>

      <main className="flex-1 p-4">
        {showSettings ? (
          <div className="space-y-4 animate-in fade-in slide-in-from-top-2 duration-200">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">WebDAV Configuration</h2>
            <div className="space-y-3">
              <div className="space-y-1">
                <label className="text-xs font-medium">Server URL</label>
                <input
                  placeholder="https://nextcloud.com/remote.php/dav/files/user/"
                  value={config.url}
                  onChange={(e) => setConfig({ ...config, url: e.target.value })}
                  className="w-full px-3 py-2 text-sm border rounded-md focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium">Username</label>
                <input
                  placeholder="Username"
                  value={config.username}
                  onChange={(e) => setConfig({ ...config, username: e.target.value })}
                  className="w-full px-3 py-2 text-sm border rounded-md focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium">App Password</label>
                <input
                  type="password"
                  placeholder="••••••••••••"
                  value={config.password}
                  onChange={(e) => setConfig({ ...config, password: e.target.value })}
                  className="w-full px-3 py-2 text-sm border rounded-md focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
                />
              </div>
              <button
                onClick={saveConfig}
                className="w-full flex items-center justify-center gap-2 py-2.5 bg-primary text-white rounded-md font-semibold hover:bg-primary/90 transition-colors shadow-sm"
              >
                <Save className="w-4 h-4" />
                Save Config
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-6 animate-in fade-in duration-200">
            <div className="bg-secondary/50 p-4 rounded-xl border border-secondary">
              <div className="flex items-start gap-3">
                <div className="bg-white p-2 rounded-lg border shadow-sm">
                  <ExternalLink className="w-5 h-5 text-primary" />
                </div>
                <div className="flex-1 overflow-hidden">
                  <h3 className="font-semibold text-sm line-clamp-2 leading-tight mb-1">
                    {currentTab.title || "Loading tab info..."}
                  </h3>
                  <p className="text-xs text-muted-foreground truncate italic">
                    {currentTab.url}
                  </p>
                </div>
              </div>
            </div>

            <button
              onClick={saveCurrentLink}
              disabled={status.type === "info"}
              className="w-full flex items-center justify-center gap-3 py-4 bg-primary text-white rounded-xl font-bold text-base hover:bg-primary/90 transition-all shadow-md active:scale-[0.98] disabled:opacity-50"
            >
              <Save className="w-6 h-6" />
              Keep this Link
            </button>
          </div>
        )}
      </main>

      {/* Status Bar */}
      {status.message && (
        <footer className={`px-4 py-2 text-xs flex items-center gap-2 animate-in slide-in-from-bottom-2 duration-300 ${
          status.type === "error" ? "bg-destructive/10 text-destructive border-t border-destructive/20" : 
          status.type === "success" ? "bg-primary/10 text-primary border-t border-primary/20" : 
          "bg-secondary text-muted-foreground border-t"
        }`}>
          {status.type === "success" && <CheckCircle2 className="w-3.5 h-3.5" />}
          {status.type === "error" && <AlertCircle className="w-3.5 h-3.5" />}
          <span className="font-medium">{status.message}</span>
        </footer>
      )}
    </div>
  );
}
