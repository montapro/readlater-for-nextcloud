import React from "react";
import { Link } from "@readlater/core";
import { useReadLater } from "../context/ReadLaterContext";
import { formatDate } from "../utils";
import { ExternalLink, CheckCircle2, Trash2, Tag } from "lucide-react";

interface Props {
  link: Link;
}

export function LinkCard({ link }: Props) {
  const { handleToggleRead, handleDeleteLink } = useReadLater();

  return (
    <div
      className={`p-3 rounded-xl border flex flex-col gap-2 transition-all group ${
        link.isRead
          ? "bg-muted/30 opacity-60"
          : "bg-card shadow-sm border-border hover:border-primary/30"
      }`}
    >
      <div className="flex-1 min-w-0">
        <h3
          className={`text-[11px] font-bold truncate ${
            link.isRead
              ? "line-through text-muted-foreground"
              : "text-foreground"
          }`}
        >
          {link.title}
        </h3>

        {link.description && (
          <p className="text-[10px] text-muted-foreground/80 mt-0.5 line-clamp-2 leading-relaxed">
            {link.description}
          </p>
        )}

        <p className="text-[9px] text-muted-foreground truncate mt-0.5 font-mono">
          {link.url}
        </p>

        {link.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-1.5">
            {link.tags.map((tag) => (
              <span
                key={tag}
                className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md bg-primary/10 text-primary text-[8px] font-semibold"
              >
                <Tag className="w-2.5 h-2.5" />
                {tag}
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="flex items-center justify-between pt-2 mt-1 border-t border-border/50">
        <span className="text-[9px] text-muted-foreground font-medium">
          {formatDate(link.addedAt)}
        </span>
        <div className="flex items-center gap-3">
          <a
            href={link.url}
            target="_blank"
            className="p-1 text-muted-foreground hover:text-primary transition-colors cursor-pointer"
            title="Open in new tab"
          >
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
          <button
            onClick={() => handleToggleRead(link.id, link.isRead)}
            className={`p-1 transition-colors cursor-pointer ${
              link.isRead
                ? "text-green-500"
                : "text-muted-foreground hover:text-green-500"
            }`}
            title={link.isRead ? "Mark as unread" : "Mark as read"}
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => handleDeleteLink(link.id)}
            className="p-1 text-muted-foreground hover:text-destructive transition-colors cursor-pointer"
            title="Delete link"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
