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
    <div className="flex flex-wrap items-center justify-center gap-1.5 py-6">
      {/* Previous: icon only，手机端不挤 */}
      <button
        type="button"
        disabled={currentPage <= 1}
        onClick={() => onPageChange(currentPage - 1)}
        aria-label="上一页"
        className={cn(
          "flex h-9 w-9 items-center justify-center rounded-md transition",
          currentPage <= 1
            ? "cursor-not-allowed fuwari-text-50 opacity-50"
            : "bg-(--fuwari-card-bg) text-(--fuwari-btn-content) hover:bg-(--fuwari-primary) hover:text-white",
        )}
      >
        <ChevronLeft size={18} />
      </button>

      {/* Page numbers */}
      {items.map((item, idx) => {
        if (item === "ellipsis") {
          return (
            <span
              key={`ellipsis-${idx}`}
              className="px-1 text-sm fuwari-text-50"
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
              "flex h-9 min-w-[2.25rem] items-center justify-center rounded-md px-2.5 text-sm font-medium transition",
              isActive
                ? "bg-(--fuwari-primary) text-white shadow-sm"
                : "bg-(--fuwari-card-bg) text-(--fuwari-btn-content) hover:bg-(--fuwari-primary) hover:text-white",
            )}
          >
            {item}
          </button>
        );
      })}

      {/* Next: icon only */}
      <button
        type="button"
        disabled={currentPage >= totalPages}
        onClick={() => onPageChange(currentPage + 1)}
        aria-label="下一页"
        className={cn(
          "flex h-9 w-9 items-center justify-center rounded-md transition",
          currentPage >= totalPages
            ? "cursor-not-allowed fuwari-text-50 opacity-50"
            : "bg-(--fuwari-card-bg) text-(--fuwari-btn-content) hover:bg-(--fuwari-primary) hover:text-white",
        )}
      >
        <ChevronRight size={18} />
      </button>

      {/* Jump：保持输入框 + 校验 + onPageChange 原逻辑，仅收紧样式 */}
      <div className="ml-1 flex items-center gap-1 rounded-md bg-(--fuwari-card-bg) px-2 py-1">
        <span className="text-sm fuwari-text-50">跳转</span>
        <input
          type="text"
          inputMode="numeric"
          value={jumpValue}
          onChange={(e) => setJumpValue(e.target.value.replace(/\D/g, ""))}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleJump();
          }}
          className="w-11 rounded border border-(--fuwari-input-border) bg-(--fuwari-input-bg) px-2 py-1 text-center text-sm text-(--fuwari-btn-content) outline-none focus:border-(--fuwari-primary)"
          placeholder={`${totalPages}`}
        />
        <button
          type="button"
          onClick={handleJump}
          aria-label="跳转到指定页"
          className="flex items-center text-sm font-medium fuwari-text-50 transition hover:text-(--fuwari-primary)"
        >
          <ChevronRight size={16} />
          <ChevronRight size={16} className="-ml-2" />
        </button>
      </div>
    </div>
  );
}
