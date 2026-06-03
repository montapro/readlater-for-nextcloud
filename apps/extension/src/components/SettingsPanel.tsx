import React from "react";
import { useReadLater } from "../context/ReadLaterContext";
import { useTheme } from "../hooks/useTheme";
import {
  Link2,
  User,
  Lock,
  Wifi,
  BookOpen,
  Monitor,
  Sun,
  Moon,
} from "lucide-react";
import type { ThemeType } from "../types";

export function SettingsPanel() {
  const {
    config,
    updateConfig,
    isUrlValid,
    testConnection,
    saveSettings,
    loading,
    testingConnection,
  } = useReadLater();
  const { theme, setTheme } = useTheme();

  return (
    <div className="p-4 space-y-6 animate-in fade-in slide-in-from-top-2 overflow-y-auto">
      {/* Credentials section */}
      <section className="space-y-3">
        <h2 className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
          Credentials
        </h2>
        <div className="space-y-2">
          <div className="relative">
            <Link2 className="absolute left-3 top-2.5 w-4 h-4 text-muted-foreground" />
            <input
              placeholder="WebDAV URL"
              value={config.url}
              onChange={(e) => updateConfig({ url: e.target.value })}
              className="w-full pl-9 pr-3 py-2 text-sm border bg-card rounded-lg focus:ring-2 focus:ring-primary/20 outline-none border-border font-mono text-[11px]"
            />
          </div>
          <div className="relative">
            <User className="absolute left-3 top-2.5 w-4 h-4 text-muted-foreground" />
            <input
              placeholder="Username"
              value={config.username}
              onChange={(e) => updateConfig({ username: e.target.value })}
              className="w-full pl-9 pr-3 py-2 text-sm border bg-card rounded-lg focus:ring-2 focus:ring-primary/20 outline-none border-border"
            />
          </div>
          <div className="relative">
            <Lock className="absolute left-3 top-2.5 w-4 h-4 text-muted-foreground" />
            <input
              type="password"
              placeholder="App Password"
              value={config.password}
              onChange={(e) => updateConfig({ password: e.target.value })}
              className="w-full pl-9 pr-3 py-2 text-sm border bg-card rounded-lg focus:ring-2 focus:ring-primary/20 outline-none border-border"
            />
          </div>

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
              onClick={saveSettings}
              disabled={loading || testingConnection}
              className="py-2 bg-primary text-primary-foreground rounded-lg font-bold hover:bg-primary/90 transition-all shadow-lg shadow-primary/20 cursor-pointer disabled:opacity-50"
            >
              {loading ? "Saving..." : "Save"}
            </button>
          </div>
        </div>

        <div className="pt-2">
          <a
            href="https://docs.nextcloud.com/server/latest/user_manual/en/files/access_webdav.html"
            target="_blank"
            className="flex items-center justify-center gap-2 py-2 border border-border text-foreground rounded-lg text-xs font-semibold hover:bg-muted transition-all cursor-pointer w-full"
          >
            <BookOpen className="w-3.5 h-3.5" /> WebDAV Help
          </a>
        </div>
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
