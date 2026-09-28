import React, { useEffect, useState } from "react";
import { useReadLater } from "../context/ReadLaterContext";
import {
  Cloud,
  FolderTree,
  Wifi,
  Monitor,
  Sun,
  Moon,
  LogOut,
  Loader2,
} from "lucide-react";
import type { ThemeType } from "../types";
import { normalizeBasePath } from "../utils/loginFlow";

export function SettingsPanel() {
  const {
    config,
    isConfigured,
    loginStatus,
    connectToNextcloud,
    disconnect,
    setBasePath,
    testConnection,
    loading,
    testingConnection,
    isUrlValid,
    theme,
    setTheme,
  } = useReadLater();

  const [instance, setInstance] = useState("");
  const [basePathInput, setBasePathInput] = useState(config.basePath);

  useEffect(() => {
    if (config.server) {
      setInstance(config.server.replace(/^https?:\/\//, ""));
    }
  }, [config.server]);

  useEffect(() => {
    setBasePathInput(config.basePath);
  }, [config.basePath]);

  const connecting = loginStatus !== "idle";
  const canConnect =
    !connecting && instance.trim().length > 0 && basePathInput.trim().length > 0;
  const isPathDirty =
    basePathInput.trim().length > 0 &&
    basePathInput !== config.basePath &&
    normalizeBasePath(basePathInput) !== config.basePath;

  const loginLabel = {
    idle: "Connect to Nextcloud",
    connecting: "Starting…",
    waiting: "Waiting for approval…",
    finishing: "Finishing…",
  }[loginStatus];

  const handleConnect = () => {
    if (!canConnect) return;
    connectToNextcloud(instance, basePathInput);
  };

  const handleInstanceKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleConnect();
    }
  };

  const handleSavePath = async () => {
    await setBasePath(basePathInput);
    setBasePathInput(normalizeBasePath(basePathInput));
  };

  return (
    <div className="p-4 space-y-6 animate-in fade-in slide-in-from-top-2 overflow-y-auto">
      {/* Connection section */}
      <section className="space-y-3">
        <h2 className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
          Nextcloud Connection
        </h2>

        {isConfigured ? (
          <div className="flex items-center justify-between rounded-lg border border-border bg-card px-3 py-2">
            <div className="min-w-0">
              <p className="text-sm font-semibold truncate">
                {config.server.replace(/^https?:\/\//, "")}
              </p>
              <p className="text-xs text-muted-foreground truncate">
                {config.username} · /files/{config.uid}
                {config.basePath}
              </p>
            </div>
            <button
              onClick={disconnect}
              title="Disconnect"
              className="shrink-0 ml-2 p-2 text-muted-foreground hover:text-destructive transition-colors cursor-pointer"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <>
            <div className="relative">
              <Cloud className="absolute left-3 top-2.5 w-4 h-4 text-muted-foreground" />
              <input
                placeholder="cloud.example.com"
                value={instance}
                onChange={(e) => setInstance(e.target.value)}
                onKeyDown={handleInstanceKeyDown}
                className="w-full pl-9 pr-3 py-2 text-sm border bg-card rounded-lg focus:ring-2 focus:ring-primary/20 outline-none border-border"
              />
            </div>
            <div className="relative">
              <FolderTree className="absolute left-3 top-2.5 w-4 h-4 text-muted-foreground" />
              <input
                placeholder="Folder in Nextcloud, e.g. AppSync (or / for root)"
                value={basePathInput}
                onChange={(e) => setBasePathInput(e.target.value)}
                onKeyDown={handleInstanceKeyDown}
                className="w-full pl-9 pr-3 py-2 text-sm border bg-card rounded-lg focus:ring-2 focus:ring-primary/20 outline-none border-border"
              />
            </div>
            <button
              onClick={handleConnect}
              disabled={!canConnect}
              className="w-full flex items-center justify-center gap-2 py-2 bg-primary text-primary-foreground rounded-lg font-bold hover:bg-primary/90 transition-all shadow-lg shadow-primary/20 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {connecting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Cloud className="w-4 h-4" />
              )}
              {loginLabel}
            </button>
            <p className="text-xs text-muted-foreground">
              A Nextcloud tab opens where you sign in and grant access. No
              password is stored in the extension.
            </p>
          </>
        )}

        {isConfigured && (
          <>
            <div className="relative">
              <FolderTree className="absolute left-3 top-2.5 w-4 h-4 text-muted-foreground" />
              <input
                placeholder="Folder in Nextcloud, e.g. AppSync (or / for root)"
                value={basePathInput}
                onChange={(e) => setBasePathInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    if (isPathDirty) void handleSavePath();
                  }
                }}
                className="w-full pl-9 pr-3 py-2 text-sm border bg-card rounded-lg focus:ring-2 focus:ring-primary/20 outline-none border-border"
              />
            </div>
            <p className="text-xs text-muted-foreground">
              The folder you set must already exist on your Nextcloud
              filesystem.
            </p>
            <div className="grid grid-cols-2 gap-2 pt-1">
              <button
                onClick={testConnection}
                disabled={testingConnection || loading || !isUrlValid}
                className="flex items-center justify-center gap-2 py-2 border border-border text-foreground rounded-lg font-semibold hover:bg-muted transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Wifi
                  className={`w-4 h-4 ${testingConnection ? "animate-pulse" : ""}`}
                />{" "}
                Test
              </button>
              <button
                onClick={handleSavePath}
                disabled={!isPathDirty || loading}
                className="flex items-center justify-center gap-2 py-2 bg-primary text-primary-foreground rounded-lg font-bold hover:bg-primary/90 transition-all shadow-lg shadow-primary/20 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? "Saving..." : "Save"}
              </button>
            </div>
          </>
        )}
      </section>

      {/* Appearance section */}
      <section className="space-y-3 border-t border-border pt-4">
        <h2 className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
          Appearance
        </h2>
        <div className="flex bg-muted p-1 rounded-xl">
          {(["system", "light", "dark"] as ThemeType[]).map((t) => (
            <button
              key={t}
              onClick={() => setTheme(t)}
              className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                theme === t
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {t === "system" && <Monitor className="w-3.5 h-3.5" />}
              {t === "light" && <Sun className="w-3.5 h-3.5" />}
              {t === "dark" && <Moon className="w-3.5 h-3.5" />}
              <span className="capitalize">{t}</span>
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}
