import { cn } from "@/lib/utils";

export interface Tab {
  id: string;
  label: string;
}

interface CategoryTabsProps {
  tabs: Tab[];
  activeId: string;
  onChange: (id: string) => void;
}

export function CategoryTabs({ tabs, activeId, onChange }: CategoryTabsProps) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {tabs.map((tab) => {
        const isActive = tab.id === activeId;
        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => onChange(tab.id)}
            className={cn(
              "rounded-full px-5 py-2 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--fuwari-primary)",
              isActive
                ? "bg-(--fuwari-primary) text-white shadow-sm"
                : "bg-(--fuwari-card-bg) text-(--fuwari-meta) hover:text-(--fuwari-title)",
            )}
            aria-pressed={isActive}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}