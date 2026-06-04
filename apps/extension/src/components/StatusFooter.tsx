import React from "react";
import { useReadLater } from "../context/ReadLaterContext";

export function StatusFooter() {
  const { status } = useReadLater();

  if (!status.visible || !status.text) return null;

  const bgColor =
    status.type === "error"
      ? "bg-destructive/10 text-destructive"
      : status.type === "success"
        ? "bg-primary/10 text-primary"
        : "bg-muted text-muted-foreground";

  return (
    <footer
      className={`px-4 py-2 text-[10px] flex items-center gap-2 border-t border-border ${bgColor}`}
    >
      <span className="font-bold">{status.text}</span>
    </footer>
  );
}
