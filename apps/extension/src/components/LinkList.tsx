import React, { useEffect, useRef } from "react";
import { useReadLater } from "../context/ReadLaterContext";
import { LinkCard } from "./LinkCard";
import { SelectionActions } from "./SelectionActions";
import { Link2 } from "lucide-react";

export function LinkList() {
  const {
    links,
    visibleLinks,
    filter,
    selectedCount,
    toggleSelectAllVisible,
    loading,
  } = useReadLater();
  const selectAllRef = useRef<HTMLInputElement>(null);

  const allSelected =
    visibleLinks.length > 0 && selectedCount === visibleLinks.length;

  useEffect(() => {
    if (selectAllRef.current) {
      selectAllRef.current.indeterminate = selectedCount > 0 && !allSelected;
    }
  }, [selectedCount, allSelected]);

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
      {visibleLinks.length > 0 && (
        <div className="flex items-center justify-between gap-2 mb-2 px-1">
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input
              ref={selectAllRef}
              type="checkbox"
              checked={allSelected}
              onChange={toggleSelectAllVisible}
              aria-label={`Select all ${visibleLinks.length} visible links`}
              className="w-3.5 h-3.5 accent-primary cursor-pointer"
            />
            <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
              Select all ({visibleLinks.length})
            </span>
          </label>

          {selectedCount > 0 && <SelectionActions />}
        </div>
      )}

      {visibleLinks.length === 0 ? (
        <div className="py-16 text-center space-y-3">
          <Link2 className="w-10 h-10 text-muted-foreground/30 mx-auto" />
          <p className="text-muted-foreground text-xs italic">
            {filter === "all"
              ? "No links saved yet. Save a link to get started!"
              : "No matching links found"}
          </p>
        </div>
      ) : (
        visibleLinks.map((link) => <LinkCard key={link.id} link={link} />)
      )}
    </div>
  );
}
