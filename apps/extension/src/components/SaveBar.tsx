import React from "react";
import { useReadLater } from "../context/ReadLaterContext";
import { CheckCheck, Link2, Save, CheckCircle2 } from "lucide-react";

export function SaveBar() {
  const {
    currentTab,
    isAlreadySavedAndUnread,
    isConfigured,
    loading,
    status,
    saveCurrentLink,
  } = useReadLater();

  return (
    <div className="p-4 border-t border-border bg-card shadow-lg">
      <div
        className={`p-3 rounded-xl border transition-all mb-3 ${
          isAlreadySavedAndUnread
            ? "bg-primary/5 border-primary/20"
            : "bg-muted/30 border-border"
        }`}
      >
        <div className="flex items-start gap-2.5">
          <div
            className={`p-1.5 rounded-lg border shadow-sm ${
              isAlreadySavedAndUnread
                ? "bg-primary text-primary-foreground border-primary/20"
                : "bg-card text-primary border-border"
            }`}
          >
            {isAlreadySavedAndUnread ? (
              <CheckCheck className="w-3.5 h-3.5" />
            ) : (
              <Link2 className="w-3.5 h-3.5" />
            )}
          </div>
          <div className="flex-1 overflow-hidden">
            <p
              className={`text-[9px] font-bold uppercase mb-0.5 ${
                isAlreadySavedAndUnread ? "text-primary" : "text-muted-foreground"
              }`}
            >
              {isAlreadySavedAndUnread ? "Already Saved" : "Current Tab"}
            </p>
            <h3 className="text-[11px] font-bold truncate text-foreground leading-none">
              {currentTab.title || "---"}
            </h3>
          </div>
        </div>
      </div>

      <button
        onClick={saveCurrentLink}
        disabled={
          (status.visible && status.type === "info") || loading || !isConfigured || isAlreadySavedAndUnread
        }
        className={`w-full flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-sm transition-all shadow-lg active:scale-[0.97] disabled:opacity-50 disabled:active:scale-100 cursor-pointer disabled:cursor-default ${
          isAlreadySavedAndUnread
            ? "bg-muted text-muted-foreground shadow-none border border-border"
            : "bg-primary text-primary-foreground shadow-primary/20 hover:bg-primary/90"
        }`}
      >
        {isAlreadySavedAndUnread ? (
          <CheckCircle2 className="w-5 h-5" />
        ) : (
          <Save className="w-5 h-5" />
        )}
        {isAlreadySavedAndUnread ? "Saved & Unread" : "Keep this Link"}
      </button>
    </div>
  );
}
