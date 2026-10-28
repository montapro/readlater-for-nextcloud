import React, { useEffect, useRef } from "react";
import { useReadLater } from "../context/ReadLaterContext";

/**
 * In-popup confirmation dialog.
 *
 * Deliberately not window.confirm(): the native dialog moves focus away from
 * the popup, which makes Chrome close it and abort the pending action.
 */
export function ConfirmDialog() {
  const { pendingConfirm, resolveConfirm } = useReadLater();
  const confirmButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!pendingConfirm) return;

    confirmButtonRef.current?.focus();

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        resolveConfirm(false);
      } else if (e.key === "Enter") {
        e.preventDefault();
        resolveConfirm(true);
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [pendingConfirm, resolveConfirm]);

  if (!pendingConfirm) return null;

  return (
    <div
      className="absolute inset-0 z-50 flex items-center justify-center bg-black/40 p-6"
      role="dialog"
      aria-modal="true"
      aria-label={pendingConfirm.message}
    >
      <div className="w-full bg-card border border-border rounded-xl shadow-xl p-4 space-y-4">
        <p className="text-xs font-semibold leading-relaxed text-foreground">
          {pendingConfirm.message}
        </p>
        <div className="flex items-center justify-end gap-2">
          <button
            onClick={() => resolveConfirm(false)}
            className="px-3 py-1.5 text-[11px] font-semibold text-foreground border border-border rounded-lg hover:bg-muted transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            ref={confirmButtonRef}
            onClick={() => resolveConfirm(true)}
            className={`px-3 py-1.5 text-[11px] font-bold rounded-lg transition-all cursor-pointer ${
              pendingConfirm.destructive
                ? "bg-destructive text-white hover:bg-destructive/90"
                : "bg-primary text-primary-foreground hover:bg-primary/90"
            }`}
          >
            {pendingConfirm.confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
