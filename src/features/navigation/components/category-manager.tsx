import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FolderOpen } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  createCategoryFn,
  deleteCategoryFn,
  getUncategorizedCountFn,
  updateCategoryFn,
} from "@/features/categories/api/categories.api";
import {
  CATEGORIES_KEYS,
  categoriesWithCountAdminQueryOptions,
} from "@/features/categories/queries";
import type { CategoryWithCount } from "@/features/categories/categories.schema";
import { navMenuQuery } from "@/features/navigation/queries";
import { useNavigate } from "@tanstack/react-router";

interface Draft {
  id?: number;
  name: string;
  description: string;
  parentId?: number | null;
}

/** 计算每个分类的深度（顶级=0）与父级名称映射，用于层级展示 */
function buildDepthAndParent(
  list: Array<{ id: number; name: string; parentId: number | null }>,
): { depthById: Map<number, number>; nameById: Map<number, string> } {
  const nameById = new Map<number, string>();
  for (const c of list) nameById.set(c.id, c.name);

  const depthById = new Map<number, number>();
  const computeDepth = (id: number, seen: Set<number>): number => {
    if (depthById.has(id)) return depthById.get(id)!;
    const cat = list.find((c) => c.id === id);
    if (!cat || cat.parentId == null) {
      depthById.set(id, 0);
      return 0;
    }
    if (seen.has(id)) return 0; // 防环
    seen.add(id);
    const d = computeDepth(cat.parentId, seen) + 1;
    depthById.set(id, d);
    return d;
  };
  for (const c of list) computeDepth(c.id, new Set());
  return { depthById, nameById };
}

/** 返回某分类的所有后代 id（含间接子级），用于禁止把自身/子孙设为自己的父级 */
function descendantIds(
  list: Array<{ id: number; parentId: number | null }>,
  rootId: number,
): Set<number> {
  const childrenOf = new Map<number | null, Array<number>>();
  for (const c of list) {
    const key = c.parentId ?? null;
    const arr = childrenOf.get(key) ?? [];
    arr.push(c.id);
    childrenOf.set(key, arr);
  }
  const result = new Set<number>();
  const queue: Array<number> = [rootId];
  while (queue.length) {
    const cur = queue.shift() as number;
    for (const child of childrenOf.get(cur) ?? []) {
      if (!result.has(child)) {
        result.add(child);
        queue.push(child);
      }
    }
  }
  return result;
}

export function CategoryManager() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { data: categoriesData = [], isLoading } = useQuery(
    categoriesWithCountAdminQueryOptions(),
  );
  const categories = categoriesData as CategoryWithCount[];
  const { data: uncategorizedCount = 0 } = useQuery({
    queryKey: ["uncategorized", "count"],
    queryFn: () => getUncategorizedCountFn(),
  });

  const [draft, setDraft] = useState<Draft | null>(null);

  const invalidateCategories = () => {
    queryClient.invalidateQueries({ queryKey: CATEGORIES_KEYS.admin });
    queryClient.invalidateQueries({ queryKey: CATEGORIES_KEYS.adminWithCount });
    queryClient.invalidateQueries({ queryKey: CATEGORIES_KEYS.public });
    queryClient.invalidateQueries({ queryKey: navMenuQuery.queryKey });
  };

  const saveMutation = useMutation({
    mutationFn: async (next: Draft) => {
      const payload = {
        name: next.name,
        description: next.description || undefined,
        parentId: next.parentId ?? null,
      };
      if (next.id === undefined) {
        return await createCategoryFn({ data: payload });
      }
      return await updateCategoryFn({
        data: { id: next.id, data: payload },
      });
    },
    onSuccess: (result) => {
      if (result.error) {
        toast.error("保存失败：" + (result.error.reason ?? ""));
        return;
      }
      invalidateCategories();
      setDraft(null);
      toast.success("分类已保存");
    },
    onError: () => toast.error("保存失败"),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => deleteCategoryFn({ data: { id } }),
    onSuccess: () => {
      invalidateCategories();
      toast.success("分类已删除（其下文章自动归入未分类）");
    },
    onError: () => toast.error("删除失败"),
  });

  const move = async (idx: number, dir: -1 | 1) => {
    const next = [...categories];
    const j = idx + dir;
    if (j < 0 || j >= next.length) return;
    const a = next[idx];
    const b = next[j];
    const aSort = a.sortOrder;
    const bSort = b.sortOrder;
    await Promise.all([
      updateCategoryFn({ data: { id: a.id, data: { sortOrder: bSort } } }),
      updateCategoryFn({ data: { id: b.id, data: { sortOrder: aSort } } }),
    ]);
    invalidateCategories();
  };

  const startAdd = () => setDraft({ name: "", description: "", parentId: null });
  const startEdit = (c: CategoryWithCount) =>
    setDraft({
      id: c.id,
      name: c.name,
      description: c.description ?? "",
      parentId: c.parentId ?? null,
    });
  const cancel = () => setDraft(null);

  const commitDraft = () => {
    if (!draft) return;
    if (!draft.name.trim()) {
      toast.error("请填写分类名称");
      return;
    }
    saveMutation.mutate(draft);
  };

  const remove = (id: number) => {
    deleteMutation.mutate(id);
  };

  // 层级相关：深度/父名映射，以及「禁止把自身或子孙设为父级」集合
  const { depthById, nameById } = buildDepthAndParent(categories as CategoryWithCount[]);
  const forbiddenParentIds = draft?.id
    ? descendantIds(
        categories.map((c) => ({ id: c.id, parentId: c.parentId ?? null })),
        draft.id,
      )
    : new Set<number>();

  return (
    <div className="space-y-8 pb-20">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-serif font-medium tracking-tight">
            分类管理
          </h1>
          <p className="text-xs font-mono text-muted-foreground uppercase tracking-widest mt-1">
            CATEGORY MANAGEMENT
          </p>
        </div>
        <Button onClick={startAdd} size="sm">
          ＋ 新建分类
        </Button>
      </div>

      {draft && (
        <div className="border border-border/30 p-4 space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label className="text-xs text-muted-foreground">分类名称</label>
              <Input
                value={draft.name}
                onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                placeholder="如：技术"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">
                描述（可选）
              </label>
              <Input
                value={draft.description}
                onChange={(e) =>
                  setDraft({ ...draft, description: e.target.value })
                }
                placeholder="简短描述"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">
                上级分类（可选，支持二级/多级嵌套）
              </label>
              <select
                value={draft.parentId ?? ""}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    parentId:
                      e.target.value === "" ? null : Number(e.target.value),
                  })
                }
                className="h-9 w-full rounded-md border border-input bg-white dark:bg-zinc-800 dark:border-zinc-600 px-2 text-sm text-gray-900 dark:text-zinc-200 [color-scheme:light] dark:[color-scheme:dark]"
              >
                <option value="">（顶级分类，无上级）</option>
                {categories
                  .filter(
                    (c) =>
                      c.id !== draft.id && !forbiddenParentIds.has(c.id),
                  )
                  .map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
              </select>
            </div>
          </div>
          <div className="flex gap-2">
            <Button
              onClick={commitDraft}
              size="sm"
              disabled={saveMutation.isPending}
            >
              {saveMutation.isPending ? "保存中…" : "保存"}
            </Button>
            <Button onClick={cancel} size="sm" variant="ghost">
              取消
            </Button>
          </div>
        </div>
      )}

      <div className="border border-border/30">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border/30 bg-muted/5 text-[10px] uppercase tracking-widest text-muted-foreground">
              <th className="px-4 py-3 text-left">排序</th>
              <th className="px-4 py-3 text-left">名称</th>
              <th className="px-4 py-3 text-left">描述</th>
              <th className="px-4 py-3 text-left">文章数</th>
              <th className="px-4 py-3 text-right">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/30">
            {isLoading ? (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-muted-foreground">
                  加载中…
                </td>
              </tr>
            ) : (
              <>
                {categories.map((c, idx) => (
                  <tr key={c.id} className="hover:bg-muted/5">
                    <td className="px-4 py-3">
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => move(idx, -1)}
                          disabled={idx === 0}
                        >
                          ↑
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => move(idx, 1)}
                          disabled={idx === categories.length - 1}
                        >
                          ↓
                        </Button>
                      </div>
                    </td>
                    <td className="px-4 py-3 font-medium">
                      <div
                        style={{
                          paddingLeft:
                            (depthById.get(c.id) ?? 0) * 16,
                        }}
                      >
                        {(depthById.get(c.id) ?? 0) > 0 ? "↳ " : ""}
                        {c.name}
                        {(depthById.get(c.id) ?? 0) > 0 && (
                          <span className="ml-2 text-[10px] text-muted-foreground">
                            （上级：{nameById.get(c.parentId ?? -1) ?? "—"}）
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground text-xs">
                      {c.description ?? "-"}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground font-mono text-xs">
                      {c.postCount}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => startEdit(c)}
                        >
                          [ 编辑 ]
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-red-500 hover:text-red-600"
                          onClick={() => remove(c.id)}
                        >
                          [ 删除 ]
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
                {/* 未分类：分类体系内的兜底桶（系统保留，不可删） */}
                <tr className="hover:bg-muted/5 bg-muted/10">
                  <td className="px-4 py-3 text-muted-foreground">—</td>
                  <td className="px-4 py-3 font-medium">
                    <span className="inline-flex items-center gap-1.5">
                      <FolderOpen size={13} className="text-muted-foreground" />
                      未分类
                    </span>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground text-xs">
                    未归入任何分类的文章（自动兜底）
                  </td>
                  <td className="px-4 py-3 text-muted-foreground font-mono text-xs">
                    {uncategorizedCount}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() =>
                        navigate({
                          to: "/posts",
                          search: { uncategorized: true },
                        })
                      }
                    >
                      [ 查看 ]
                    </Button>
                  </td>
                </tr>
              </>
            )}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-muted-foreground">
        提示：分类为真实独立分类（与标签解耦），支持二级/多级嵌套（设「上级分类」即可）。点击某父分类查看文章时，会连带显示其全部子分类下的文章。删除某分类时，其下文章自动归入「未分类」兜底桶，不会丢失。
      </p>
    </div>
  );
}
