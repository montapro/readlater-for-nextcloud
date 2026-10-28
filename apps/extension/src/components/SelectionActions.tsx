import React from "react";
import { useReadLater } from "../context/ReadLaterContext";
import { CheckCircle2, ExternalLink, Trash2 } from "lucide-react";

interface ActionButtonProps {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  className?: string;
}

function ActionButton({ icon, label, onClick, className }: ActionButtonProps) {
  return (
    <button
      onClick={onClick}
      title={label}
      aria-label={label}
      className={`p-1 rounded-full transition-colors cursor-pointer ${className ?? ""}`}
    >
      {icon}
    </button>
  );
}

/**
 * Inline batch actions for the selected links, with the selection count to
 * the right. Rendered in the list header only once at least one link is
 * selected.
 *
 * The read toggle always offers the direction that would change something:
 * "Mark as unread" for an all-read selection (e.g. the read list), otherwise
 * "Mark as read".
 */
export function SelectionActions() {
  const {
    selectedCount,
    selectedAllRead,
    openSelected,
    markSelectedRead,
    markSelectedUnread,
    deleteSelected,
  } = useReadLater();

  if (selectedCount === 0) return null;

  return (
    <div className="flex items-center gap-1">
      <ActionButton
        icon={<ExternalLink className="w-3.5 h-3.5" />}
        label="Open in new tabs"
        onClick={() => void openSelected()}
        className="text-muted-foreground hover:text-primary hover:bg-primary/10"
      />
      <ActionButton
        icon={<CheckCircle2 className="w-3.5 h-3.5" />}
        label={selectedAllRead ? "Mark as unread" : "Mark as read"}
        onClick={() =>
          void (selectedAllRead ? markSelectedUnread() : markSelectedRead())
        }
        className={
          selectedAllRead
            ? "text-green-500 hover:text-muted-foreground hover:bg-muted"
            : "text-muted-foreground hover:text-green-500 hover:bg-green-500/10"
        }
      />
      <ActionButton
        icon={<Trash2 className="w-3.5 h-3.5" />}
        label="Delete"
        onClick={() => void deleteSelected()}
        className="text-muted-foreground hover:text-destructive hover:bg-destructive/10"
      />
      <span className="ml-1 pl-2 border-l border-border text-[10px] font-bold text-primary">
        {selectedCount} {selectedCount === 1 ? "link" : "links"}
      </span>
    </div>
  );
}
