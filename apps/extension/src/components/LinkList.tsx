import React, { useMemo } from "react";
import { useReadLater } from "../context/ReadLaterContext";
import { LinkCard } from "./LinkCard";
import { CheckCheck, Trash2, Link2 } from "lucide-react";

export function LinkList() {
  const {
    links,
    filter,
    sortBy,
    searchQuery,
    handleMarkAllRead,
    handleDeleteAll,
    hasUnread,
    loading,
  } = useReadLater();

  const processedLinks = useMemo(() => {
    let result = [...links];
    if (filter === "read") result = result.filter((l) => l.isRead);
    if (filter === "unread") result = result.filter((l) => !l.isRead);
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      result = result.filter(
        (l) =>
          l.title.toLowerCase().includes(q) ||
          l.url.toLowerCase().includes(q) ||
          l.tags.some((t) => t.toLowerCase().includes(q))
      );
    }
    result.sort((a, b) => {
      if (sortBy === "newest")
        return new Date(b.addedAt).getTime() - new Date(a.addedAt).getTime();
      if (sortBy === "oldest")
        return new Date(a.addedAt).getTime() - new Date(b.addedAt).getTime();
      if (sortBy === "alpha") return a.title.localeCompare(b.title);
      return 0;
    });
    return result;
  }, [links, filter, sortBy, searchQuery]);

  if (loading && links.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="flex items-center gap-2 text-muted-foreground">
          <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          <span className="text-xs font-semibold">Loading...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-2 custom-scrollbar">
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground px-1">
          {filter === "all"
            ? "All Links"
            : filter === "read"
              ? "Read Links"
              : "Unread Links"}
        </h2>
        {links.length > 0 && (
          <div className="flex items-center gap-2">
            <button
              onClick={handleMarkAllRead}
              disabled={!hasUnread}
              className={`transition-colors cursor-pointer disabled:cursor-default ${
                !hasUnread
                  ? "text-muted/30"
                  : "text-muted-foreground hover:text-green-500"
              }`}
              title="Mark all as read"
            >
              <CheckCheck className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={handleDeleteAll}
              className="text-muted-foreground hover:text-destructive transition-colors cursor-pointer"
              title="Delete all"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>

      {processedLinks.length === 0 ? (
        <div className="py-16 text-center space-y-3">
          <Link2 className="w-10 h-10 text-muted-foreground/30 mx-auto" />
          <p className="text-muted-foreground text-xs italic">
            {filter === "all"
              ? "No links saved yet. Save a link to get started!"
              : "No matching links found"}
          </p>
        </div>
      ) : (
        processedLinks.map((link) => <LinkCard key={link.id} link={link} />)
      )}
    </div>
  );
}
