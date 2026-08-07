import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

function generatePageItems(current: number, total: number): Array<number | "ellipsis"> {
  if (total <= 7) {
    return Array.from({ length: total }, (_, i) => i + 1);
  }

  if (current <= 4) {
    return [1, 2, 3, 4, 5, "ellipsis", total];
  }

  if (current >= total - 3) {
    return [
      1,
      "ellipsis",
      total - 4,
      total - 3,
      total - 2,
      total - 1,
      total,
    ];
  }

  return [1, "ellipsis", current - 1, current, current + 1, "ellipsis", total];
}

export function Pagination({
  currentPage,
  totalPages,
  onPageChange,
}: PaginationProps) {
  const [jumpValue, setJumpValue] = useState("");

  if (totalPages <= 1) return null;

  const items = generatePageItems(currentPage, totalPages);

  const handleJump = () => {
    const page = Number(jumpValue);
    if (!Number.isNaN(page) && page >= 1 && page <= totalPages) {
      onPageChange(page);
      setJumpValue("");
    }
  };

  return (
    <div className="flex flex-wrap items-center justify-center gap-2 py-6">
      {/* Previous */}
      <button
        type="button"
        disabled={currentPage <= 1}
        onClick={() => onPageChange(currentPage - 1)}
        className={cn(
          "flex items-center gap-0.5 rounded-md px-3 py-2 text-sm font-medium transition",
          currentPage <= 1
            ? "cursor-not-allowed fuwari-text-50 opacity-50"
            : "bg-(--fuwari-card-bg) text-(--fuwari-btn-content) hover:bg-(--fuwari-primary) hover:text-white",
        )}
      >
        <ChevronLeft size={16} />
        上一页
      </button>

      {/* Page numbers */}
      {items.map((item, idx) => {
        if (item === "ellipsis") {
        return (
          <span
            key={`ellipsis-${idx}`}
            className="px-2 text-sm fuwari-text-50"
          >
            ...
          </span>
        );
        }

        const isActive = item === currentPage;
        return (
          <button
            key={item}
            type="button"
            onClick={() => onPageChange(item)}
            className={cn(
              "min-w-[2.25rem] rounded-md px-3 py-2 text-sm font-medium transition",
              isActive
                ? "bg-(--fuwari-primary) text-white shadow-sm"
                : "bg-(--fuwari-card-bg) text-(--fuwari-btn-content) hover:bg-(--fuwari-primary) hover:text-white",
            )}
          >
            {item}
          </button>
        );
      })}

      {/* Next */}
      <button
        type="button"
        disabled={currentPage >= totalPages}
        onClick={() => onPageChange(currentPage + 1)}
        className={cn(
          "flex items-center gap-0.5 rounded-md px-3 py-2 text-sm font-medium transition",
          currentPage >= totalPages
            ? "cursor-not-allowed fuwari-text-50 opacity-50"
            : "bg-(--fuwari-card-bg) text-(--fuwari-btn-content) hover:bg-(--fuwari-primary) hover:text-white",
        )}
      >
        下一页
        <ChevronRight size={16} />
      </button>

      {/* Jump */}
      <div className="flex items-center gap-1 rounded-md bg-(--fuwari-card-bg) px-2 py-1.5">
        <span className="text-sm fuwari-text-50">跳转</span>
        <input
          type="text"
          inputMode="numeric"
          value={jumpValue}
          onChange={(e) => setJumpValue(e.target.value.replace(/\D/g, ""))}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleJump();
          }}
          className="w-12 rounded border border-(--fuwari-input-border) bg-(--fuwari-input-bg) px-2 py-1 text-center text-sm text-(--fuwari-btn-content) outline-none focus:border-(--fuwari-primary)"
          placeholder={`${totalPages}`}
        />
        <button
          type="button"
          onClick={handleJump}
          className="flex items-center text-sm font-medium fuwari-text-50 transition hover:text-(--fuwari-primary)"
        >
          <ChevronRight size={16} />
          <ChevronRight size={16} className="-ml-2" />
        </button>
      </div>
    </div>
  );
}
