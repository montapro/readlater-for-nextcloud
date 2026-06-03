import React from "react";
import { useReadLater } from "../context/ReadLaterContext";
import type { FilterType, SortType } from "../types";

const filters: FilterType[] = ["all", "unread", "read"];
const sortOptions: { value: SortType; label: string }[] = [
  { value: "newest", label: "Newest" },
  { value: "oldest", label: "Oldest" },
  { value: "alpha", label: "A-Z" },
];

export function FilterBar() {
  const { filter, setFilter, sortBy, setSortBy } = useReadLater();

  return (
    <div className="px-4 py-2 bg-muted/50 border-b border-border flex items-center justify-between gap-2">
      <div className="flex items-center gap-1.5 flex-1 overflow-x-auto no-scrollbar">
        {filters.map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-2.5 py-1 rounded-full text-[10px] font-bold capitalize transition-all whitespace-nowrap cursor-pointer ${
              filter === f
                ? "bg-primary text-primary-foreground shadow-sm"
                : "bg-card text-muted-foreground border border-border hover:bg-muted"
            }`}
          >
            {f}
          </button>
        ))}
      </div>
      <div className="flex items-center gap-1 border-l border-border pl-2">
        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as SortType)}
          className="text-[10px] font-bold text-muted-foreground bg-transparent outline-none cursor-pointer"
        >
          {sortOptions.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
