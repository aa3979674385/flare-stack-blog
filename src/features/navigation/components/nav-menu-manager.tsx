import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { saveNavMenuFn } from "@/features/navigation/api/navigation.api";
import {
  navigationAdminQuery,
  navMenuQuery,
} from "@/features/navigation/queries";
import type { NavMenuItem } from "@/features/navigation/navigation.schema";

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

export function NavMenuManager() {
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery(navigationAdminQuery);
  const navMenu = data?.navMenu ?? [];
  const categories = data?.categories ?? [];
  const [draft, setDraft] = useState<NavMenuItem | null>(null);

  const saveMutation = useMutation({
    mutationFn: (next: NavMenuItem[]) => saveNavMenuFn({ data: next }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: navigationAdminQuery.queryKey });
      queryClient.invalidateQueries({ queryKey: navMenuQuery.queryKey });
      setDraft(null);
      toast.success("导航菜单已保存");
    },
    onError: () => toast.error("保存失败"),
  });

  const startAddLink = () =>
    setDraft({
      id: uid(),
      label: "",
      type: "link",
      target: "",
      enabled: true,
      sortOrder: navMenu.length,
      parentId: null,
    });
  const startAddCategory = () =>
    setDraft({
      id: uid(),
      label: categories[0]?.name ?? "",
      type: "category",
      target: String(categories[0]?.id ?? ""),
      enabled: true,
      sortOrder: navMenu.length,
      parentId: null,
    });
  const startEdit = (it: NavMenuItem) => setDraft({ ...it });

  const commit = () => {
    if (!draft) return;
    if (!draft.label.trim()) {
      toast.error("请填写显示名称");
      return;
    }
    if (draft.type === "link" && !draft.target.trim()) {
      toast.error("请填写链接地址");
      return;
    }
    if (draft.type === "category" && !draft.target) {
      toast.error("请选择分类");
      return;
    }
    const exists = navMenu.some((n) => n.id === draft.id);
    const next = exists
      ? navMenu.map((n) => (n.id === draft.id ? draft : n))
      : [...navMenu, draft];
    saveMutation.mutate(next);
  };

  const move = (idx: number, dir: -1 | 1) => {
    const next = [...navMenu];
    const j = idx + dir;
    if (j < 0 || j >= next.length) return;
    [next[idx], next[j]] = [next[j], next[idx]];
    next.forEach((n, i) => (n.sortOrder = i));
    saveMutation.mutate(next);
  };

  const remove = (id: string) => {
    if (id === "home") {
      toast.error("首页为系统保留项，不可删除");
      return;
    }
    saveMutation.mutate(navMenu.filter((n) => n.id !== id));
  };

  const toggle = (id: string) => {
    saveMutation.mutate(
      navMenu.map((n) => (n.id === id ? { ...n, enabled: !n.enabled } : n)),
    );
  };

  return (
    <div className="space-y-8 pb-20">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-serif font-medium tracking-tight">
            导航菜单
          </h1>
          <p className="text-xs font-mono text-muted-foreground uppercase tracking-widest mt-1">
            NAVIGATION MENU
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={startAddLink} size="sm">
            ＋ 自定义链接
          </Button>
          <Button
            onClick={startAddCategory}
            size="sm"
            disabled={categories.length === 0}
          >
            ＋ 添加分类
          </Button>
        </div>
      </div>

      {draft && (
        <div className="border border-border/30 p-4 space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-muted-foreground">显示名称</label>
              <Input
                value={draft.label}
                onChange={(e) => setDraft({ ...draft, label: e.target.value })}
                placeholder="如：首页 / 我的博客"
              />
            </div>
            {draft.type === "link" && (
              <div>
                <label className="text-xs text-muted-foreground">
                  链接地址（站内填 /xxx，外链填 https://...）
                </label>
                <Input
                  value={draft.target}
                  onChange={(e) =>
                    setDraft({ ...draft, target: e.target.value })
                  }
                  placeholder="/posts 或 https://example.com"
                />
              </div>
            )}
            {draft.type === "category" && (
              <div>
                <label className="text-xs text-muted-foreground">选择分类</label>
                <select
                  value={draft.target}
                  onChange={(e) => {
                    const cat = categories.find(
                      (c) => String(c.id) === e.target.value,
                    );
                    setDraft({
                      ...draft,
                      target: e.target.value,
                      label: cat ? cat.name : draft.label,
                    });
                  }}
                  className="w-full h-9 bg-white dark:bg-zinc-800 border border-border/50 dark:border-zinc-600 px-2 text-sm text-gray-900 dark:text-zinc-200 rounded-md [color-scheme:light] dark:[color-scheme:dark]"
                >
                  {categories.map((c) => (
                    <option key={c.id} value={String(c.id)}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
          <div>
            <label className="text-xs text-muted-foreground">
              上级菜单（留空 = 顶级，可作为二级目录的父项）
            </label>
            <select
              value={draft.parentId ?? ""}
              onChange={(e) =>
                setDraft({ ...draft, parentId: e.target.value || null })
              }
              className="w-full h-9 bg-white dark:bg-zinc-800 border border-border/50 dark:border-zinc-600 px-2 text-sm text-gray-900 dark:text-zinc-200 rounded-md [color-scheme:light] dark:[color-scheme:dark]"
            >
              <option value="">无（顶级菜单）</option>
              {navMenu
                .filter((n) => !n.parentId && n.id !== draft.id)
                .map((n) => (
                  <option key={n.id} value={n.id}>
                    {n.label}
                  </option>
                ))}
            </select>
          </div>
          {draft.type === "home" && (
            <p className="text-xs text-muted-foreground">
              首页链接固定为 /，仅可修改显示名称。
            </p>
          )}
          <div className="flex gap-2">
            <Button
              onClick={commit}
              size="sm"
              disabled={saveMutation.isPending}
            >
              {saveMutation.isPending ? "保存中…" : "保存"}
            </Button>
            <Button onClick={() => setDraft(null)} size="sm" variant="ghost">
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
              <th className="px-4 py-3 text-left">类型 / 目标</th>
              <th className="px-4 py-3 text-left">启用</th>
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
            ) : navMenu.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-muted-foreground">
                  暂无菜单项
                </td>
              </tr>
            ) : (
              navMenu.map((n, idx) => {
                const catName =
                  n.type === "category"
                    ? categories.find((c) => String(c.id) === n.target)?.name ??
                      "?"
                    : undefined;
                return (
                  <tr key={n.id} className="hover:bg-muted/5">
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
                          disabled={idx === navMenu.length - 1}
                        >
                          ↓
                        </Button>
                      </div>
                    </td>
                    <td className="px-4 py-3 font-medium">
                      {n.parentId && (
                        <span className="text-muted-foreground">↳ </span>
                      )}
                      {n.label}
                      {n.type === "home" && (
                        <span className="ml-2 text-[10px] text-muted-foreground">
                          [首页]
                        </span>
                      )}
                      {n.parentId && (
                        <span className="ml-2 text-[10px] text-muted-foreground">
                          [
                          {navMenu.find((p) => p.id === n.parentId)?.label ??
                            "?"}
                          ]
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground font-mono text-xs">
                      {n.type === "home"
                        ? "/"
                        : n.type === "link"
                          ? n.target
                          : `分类 → ${catName}`}
                    </td>
                    <td className="px-4 py-3">
                      {n.type === "home" ? (
                        <span className="text-[10px] text-muted-foreground">
                          常驻
                        </span>
                      ) : (
                        <input
                          type="checkbox"
                          checked={n.enabled}
                          onChange={() => toggle(n.id)}
                        />
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => startEdit(n)}
                        >
                          [ 编辑 ]
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-red-500 hover:text-red-600"
                          onClick={() => remove(n.id)}
                          disabled={n.type === "home"}
                        >
                          [ 删除 ]
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-muted-foreground">
        提示：使用 ↑/↓ 调整顺序；未启用的项不会在前台显示；「首页」为系统保留项，唯一、不可删除、链接固定。分类项将跳转到该分类的文章列表页。设置「上级菜单」可将本项变为二级子菜单（最多两级），前台桌面端以下拉形式、移动端以缩进形式展示。
      </p>
    </div>
  );
}
