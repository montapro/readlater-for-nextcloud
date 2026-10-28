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
      className={`p-1 text-muted-foreground transition-colors cursor-pointer ${className ?? ""}`}
    >
      {icon}
    </button>
  );
}

/**
 * Inline batch actions for the selected links, with the selection count to
 * the right. Rendered in the list header only once at least one link is
 * selected.
 */
export function SelectionActions() {
  const { selectedCount, openSelected, markSelectedRead, deleteSelected } =
    useReadLater();

  if (selectedCount === 0) return null;

  return (
    <div className="flex items-center gap-1">
      <ActionButton
        icon={<ExternalLink className="w-3.5 h-3.5" />}
        label="Open in new tabs"
        onClick={() => void openSelected()}
        className="hover:text-primary"
      />
      <ActionButton
        icon={<CheckCircle2 className="w-3.5 h-3.5" />}
        label="Mark as read"
        onClick={() => void markSelectedRead()}
        className="hover:text-green-500"
      />
      <ActionButton
        icon={<Trash2 className="w-3.5 h-3.5" />}
        label="Delete"
        onClick={() => void deleteSelected()}
        className="hover:text-destructive"
      />
      <span className="ml-1 pl-2 border-l border-border text-[10px] font-bold text-primary">
        {selectedCount} {selectedCount === 1 ? "link" : "links"}
      </span>
    </div>
  );
}
