import { useEffect, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Search, X } from "lucide-react";
import { m } from "@/paraglide/messages";

interface SearchModalProps {
  open: boolean;
  onClose: () => void;
}

export function SearchModal({ open, onClose }: SearchModalProps) {
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  const [keyword, setKeyword] = useState("");

  // 打开时自动聚焦 + 锁定背景滚动；Esc 关闭
  useEffect(() => {
    if (!open) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const t = setTimeout(() => inputRef.current?.focus(), 50);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      clearTimeout(t);
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  if (!open) return null;

  const submit = () => {
    const q = keyword.trim();
    onClose();
    if (q) {
      navigate({ to: "/search", search: { q } });
    } else {
      navigate({ to: "/search" });
    }
  };

  return (
    <>
      <style>{`@keyframes searchModalFade{from{opacity:0}to{opacity:1}}`}</style>
      <div
        style={{ animation: "searchModalFade 150ms ease-out" }}
        className="fixed inset-0 z-[100] flex items-start justify-center px-4 pt-[12vh] bg-black/40 backdrop-blur-sm"
        onMouseDown={(e) => {
          if (e.target === e.currentTarget) onClose();
        }}
      >
      <div className="w-full max-w-2xl fuwari-card-base p-3 md:p-4 shadow-2xl ring-1 ring-black/5 dark:ring-white/10">
        <div className="relative flex items-center">
          <Search className="absolute left-4 w-5 h-5 fuwari-text-30 pointer-events-none" />
          <input
            ref={inputRef}
            type="text"
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") submit();
            }}
            placeholder={m.search_placeholder()}
            className="w-full pl-12 pr-12 py-3 rounded-xl border border-(--fuwari-input-border) bg-(--fuwari-input-bg) focus:outline-none focus:border-(--fuwari-primary)/50 focus:bg-(--fuwari-primary)/5 transition-all fuwari-text-90 text-lg md:text-xl placeholder:text-black/30 dark:placeholder:text-white/30"
          />
          {/* 关闭按钮 */}
          <button
            type="button"
            onClick={onClose}
            aria-label={"关闭"}
            className="absolute right-3 w-8 h-8 flex items-center justify-center rounded-lg text-black/40 dark:text-white/40 hover:bg-black/5 dark:hover:bg-white/10 transition-colors"
          >
            <X size={18} strokeWidth={1.5} />
          </button>
        </div>

        {/* 搜索按钮 */}
        <button
          type="button"
          onClick={submit}
          className="mt-3 w-full flex items-center justify-center gap-2 h-12 rounded-xl bg-(--fuwari-primary) text-white font-medium text-base active:scale-[0.98] transition-transform hover:opacity-90"
        >
          <Search size={18} strokeWidth={2} />
          {m.nav_search()}
        </button>
      </div>
      </div>
    </>
  );
}
