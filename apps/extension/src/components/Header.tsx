import React from "react";
import { useReadLater } from "../context/ReadLaterContext";
import { Settings, RefreshCw } from "lucide-react";

export function Header() {
  const { loading, isConfigured, refreshLinks, showSettings, setShowSettings } =
    useReadLater();

  return (
    <header className="px-4 py-3 border-b flex items-center justify-between bg-card sticky top-0 z-10 shadow-sm border-border">
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center shadow-md shadow-primary/20">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
            <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
          </svg>
        </div>
        <h1 className="font-bold text-lg tracking-tight text-slate-800 dark:text-slate-100">
          ReadLater
        </h1>
      </div>
      <div className="flex items-center gap-1">
        <button
          onClick={refreshLinks}
          className={`p-2 hover:bg-muted rounded-full transition-colors cursor-pointer disabled:cursor-default ${loading ? "animate-spin" : ""}`}
          disabled={loading || !isConfigured}
          title="Refresh links"
        >
          <RefreshCw className="w-4 h-4 text-muted-foreground" />
        </button>
        <button
          onClick={() => setShowSettings(!showSettings)}
          className={`p-2 rounded-full transition-colors cursor-pointer ${showSettings ? "bg-primary/10 text-primary" : "hover:bg-muted text-muted-foreground"}`}
          title="Settings"
        >
          <Settings className="w-5 h-5" />
        </button>
      </div>
    </header>
  );
}
