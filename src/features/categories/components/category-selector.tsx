import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Folder, Loader2, Plus, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { createCategoryFn } from "@/features/categories/api/categories.api";
import {
  CATEGORIES_KEYS,
  categoriesAdminQueryOptions,
} from "@/features/categories/queries";
import type { Category } from "@/lib/db/schema";
import { cn } from "@/lib/utils";

/** 计算每个分类的深度（顶级=0），用于在编辑器中按层级缩进展示 */
function buildCategoryDepthMap(
  list: Array<{ id: number; parentId: number | null }>,
): Map<number, number> {
  const depthById = new Map<number, number>();
  const compute = (id: number, seen: Set<number>): number => {
    if (depthById.has(id)) return depthById.get(id)!;
    const cat = list.find((c) => c.id === id);
    if (!cat || cat.parentId == null) {
      depthById.set(id, 0);
      return 0;
    }
    if (seen.has(id)) return 0; // 防环
    seen.add(id);
    const d = compute(cat.parentId, seen) + 1;
    depthById.set(id, d);
    return d;
  };
  for (const c of list) compute(c.id, new Set());
  return depthById;
}


interface CategorySelectorProps {
  value: Array<number>;
  onChange: (value: Array<number>) => void;
  disabled?: boolean;
}

export function CategorySelector({
  value = [],
  onChange,
  disabled,
}: CategorySelectorProps) {
  const [open, setOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();

  const {
    data: categories = [],
    isLoading: isCategoriesLoading,
    isError,
  } = useQuery(categoriesAdminQueryOptions());

  const depthById = useMemo(
    () => buildCategoryDepthMap(categories as Category[]),
    [categories],
  );

  const createCategoryMutation = useMutation({
    mutationFn: async (name: string) =>
      createCategoryFn({ data: { name } }),

    onMutate: async (newCategoryName) => {
      await queryClient.cancelQueries({
        queryKey: CATEGORIES_KEYS.admin,
      });

      const previousCategories = queryClient.getQueryData<Array<Category>>(
        CATEGORIES_KEYS.admin,
      );

      const tempId = -Math.round(Math.random() * 1000000);
      const optimisticCategory: Category = {
        id: tempId,
        name: newCategoryName,
        description: null,
        parentId: null,
        sortOrder: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      queryClient.setQueryData(
        CATEGORIES_KEYS.admin,
        (old: Array<Category> | undefined) => {
          if (!old) return [optimisticCategory];
          return [...old, optimisticCategory].sort((a, b) =>
            a.name.localeCompare(b.name),
          );
        },
      );

      onChange([...value, optimisticCategory.id]);
      setSearchTerm("");

      return { previousCategories, optimisticCategoryId: optimisticCategory.id };
    },

    onSuccess: (result, _variables, context) => {
      if (result.error) {
        queryClient.setQueryData(
          CATEGORIES_KEYS.admin,
          context.previousCategories,
        );
        onChange(value.filter((id) => id !== context.optimisticCategoryId));
        toast.error("创建分类失败");
        return;
      }

      const newCategory = result.data;
      if (!newCategory) return;
      queryClient.setQueryData(
        CATEGORIES_KEYS.admin,
        (old: Array<Category> | undefined) => {
          if (!old) return [newCategory];
          return old
            .map((c) =>
              c.id === context.optimisticCategoryId ? newCategory : c,
            )
            .sort((a, b) => a.name.localeCompare(b.name));
        },
      );

      onChange(
        value.map((id) =>
          id === context.optimisticCategoryId ? newCategory.id : id,
        ),
      );
    },

    onSettled: (_data, settledError, _newTagName, context) => {
      if (settledError) {
        if (context?.previousCategories) {
          queryClient.setQueryData(
            CATEGORIES_KEYS.admin,
            context.previousCategories,
          );
        }
        if (context?.optimisticCategoryId) {
          onChange(value.filter((id) => id !== context.optimisticCategoryId));
        }
      }

      queryClient.invalidateQueries({ queryKey: CATEGORIES_KEYS.admin });
    },
  });

  const selectedCategories = useMemo(
    () => categories.filter((c) => value.includes(c.id)),
    [categories, value],
  );

  const availableCategories = useMemo(
    () =>
      categories.filter((c) =>
        c.name.toLowerCase().includes(searchTerm.toLowerCase()),
      ),
    [categories, searchTerm],
  );

  const toggleCategory = (categoryId: number) => {
    if (value.includes(categoryId)) {
      onChange(value.filter((id) => id !== categoryId));
    } else {
      onChange([...value, categoryId]);
    }
    setSearchTerm("");
    inputRef.current?.focus();
  };

  const handleKeyDown = (
    e: React.KeyboardEvent<HTMLInputElement>,
  ) => {
    if (e.key === "Enter") {
      e.preventDefault();
      const trimmedTerm = searchTerm.trim();
      if (!trimmedTerm) return;

      const exactMatch = categories.find(
        (t) => t.name.toLowerCase() === trimmedTerm.toLowerCase(),
      );

      if (exactMatch) {
        if (!value.includes(exactMatch.id)) {
          toggleCategory(exactMatch.id);
        } else {
          setSearchTerm("");
        }
      } else {
        createCategoryMutation.mutate(trimmedTerm);
      }
    } else if (
      e.key === "Backspace" &&
      searchTerm === "" &&
      selectedCategories.length > 0
    ) {
      const lastCategory = selectedCategories[selectedCategories.length - 1];
      onChange(value.filter((id) => id !== lastCategory.id));
    }
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const isInitialLoading = isCategoriesLoading && categories.length === 0;

  return (
    <div className="relative group" ref={containerRef}>
      <div
        onClick={() => {
          if (!disabled && !isInitialLoading) {
            inputRef.current?.focus();
            setOpen(true);
          }
        }}
        className={cn(
          "min-h-9 w-full rounded-md border border-input bg-transparent px-2 py-1.5 text-sm shadow-sm transition-colors cursor-text",
          "focus-within:ring-1 focus-within:ring-ring focus-within:border-ring",
          (disabled || isInitialLoading) && "cursor-not-allowed opacity-50",
          "flex flex-wrap items-center gap-1.5",
        )}
      >
        {selectedCategories.map((category) => (
          <Badge
            key={category.id}
            variant="secondary"
            className="h-5 px-1.5 gap-1 text-[10px] items-center bg-secondary hover:bg-secondary/80 transition-colors"
          >
            <Folder size={10} className="text-muted-foreground/50" />
            <span className="truncate max-w-37.5">{category.name}</span>
            <div
              role="button"
              className="ml-0.5 rounded-full hover:bg-black/10 dark:hover:bg-white/10 p-0.5 cursor-pointer"
              onMouseDown={(e) => {
                e.preventDefault();
                e.stopPropagation();
                if (!disabled) toggleCategory(category.id);
              }}
            >
              <X size={10} />
            </div>
          </Badge>
        ))}

        <input
          ref={inputRef}
          type="text"
          className="flex-1 min-w-20 bg-transparent outline-none placeholder:text-muted-foreground text-sm h-6"
          placeholder={
            selectedCategories.length === 0 ? "选择或输入分类" : ""
          }
          value={searchTerm}
          onChange={(e) => {
            setSearchTerm(e.target.value);
            setOpen(true);
          }}
          onKeyDown={handleKeyDown}
          onFocus={() => !isInitialLoading && setOpen(true)}
          disabled={disabled || isInitialLoading}
        />

        {(isInitialLoading || createCategoryMutation.isPending) && (
          <div className="animate-spin text-muted-foreground mr-1">
            <Loader2 size={12} />
          </div>
        )}
      </div>

      {open && !disabled && (
        <div className="absolute top-full left-0 z-50 mt-1 w-full rounded-md border bg-popover text-popover-foreground shadow-md animate-in fade-in-0 zoom-in-95">
          <div className="max-h-50 w-full overflow-y-auto overflow-x-hidden p-1">
            {searchTerm &&
              !categories.some(
                (t) => t.name.toLowerCase() === searchTerm.toLowerCase(),
              ) && (
                <div
                  className="relative flex cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none hover:bg-accent hover:text-accent-foreground"
                  onClick={() => createCategoryMutation.mutate(searchTerm)}
                >
                  <Plus className="mr-2 h-4 w-4 text-muted-foreground" />
                  <span>创建分类「{searchTerm}」</span>
                </div>
              )}

            {isError ? (
              <div className="p-2 text-xs text-destructive text-center">
                <p>分类加载失败</p>
              </div>
            ) : availableCategories.length === 0 && !searchTerm ? (
              <p className="p-2 text-xs text-muted-foreground text-center">
                暂无分类，输入名称即可创建
              </p>
            ) : availableCategories.length === 0 &&
              searchTerm &&
              !createCategoryMutation.isPending ? null : (
              availableCategories.map((category) => {
                const isSelected = value.includes(category.id);
                return (
                  <div
                    key={category.id}
                    className={cn(
                      "relative flex cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none transition-colors",
                      isSelected
                        ? "bg-accent/50 text-accent-foreground"
                        : "hover:bg-accent hover:text-accent-foreground",
                    )}
                    onClick={() => toggleCategory(category.id)}
                  >
                    <Folder className="mr-2 h-4 w-4 text-muted-foreground/50 shrink-0" />
                    <span className="flex-1 truncate">
                      {depthById.get(category.id)
                        ? "　".repeat(depthById.get(category.id)!)
                        : ""}
                      {depthById.get(category.id) ? "↳ " : ""}
                      {category.name}
                    </span>
                    {isSelected && (
                      <Check className="ml-auto h-4 w-4 opacity-50" />
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
