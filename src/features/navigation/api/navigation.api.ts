import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import * as ConfigService from "@/features/config/service/config.service";
import * as CategoryService from "@/features/categories/categories.service";
import { recordAdminLog } from "@/features/admin-log/service/admin-log.service";
import {
  DEFAULT_HOME_NAV_ITEM,
  navMenuItemSchema,
  type NavMenuItem,
} from "@/features/navigation/navigation.schema";
import type { Category } from "@/features/categories/categories.schema";
import { dbMiddleware, requirePermission } from "@/lib/middlewares";

export interface ResolvedNavItem {
  id: string;
  label: string;
  /** 内部路由路径 */
  to?: string;
  /** 内部路由 search 参数 */
  search?: Record<string, string | undefined>;
  /** 外部链接完整 URL */
  href?: string;
  external?: boolean;
  /** 同级排序权重（小在前） */
  sortOrder?: number;
  /** 子菜单项（二级目录）；存在时前台以下拉/缩进形式展示 */
  children?: Array<ResolvedNavItem>;
}

function fallbackNavMenu(): NavMenuItem[] {
  return [DEFAULT_HOME_NAV_ITEM];
}

/**
 * 确保导航菜单始终包含系统保留项「首页」，且该保留项不可被禁用。
 * 未分类不再强制进入导航 —— 它是分类体系内的兜底，由分类管理页/文章列表访问。
 */
function withSystemNavItems(items: NavMenuItem[]): NavMenuItem[] {
  const next = [...items];
  if (!next.find((n) => n.type === "home")) {
    next.push(DEFAULT_HOME_NAV_ITEM);
  }
  return next.map((n) => (n.type === "home" ? { ...n, enabled: true } : n));
}

function resolveNavItem(
  item: NavMenuItem,
  categories: Array<Category>,
): ResolvedNavItem | null {
  if (!item.enabled) return null;

  if (item.type === "home") {
    return { id: item.id, label: item.label, to: "/", sortOrder: item.sortOrder };
  }

  if (item.type === "link") {
    const href = item.target.trim();
    if (/^https?:\/\//i.test(href)) {
      return { id: item.id, label: item.label, href, external: true, sortOrder: item.sortOrder };
    }
    return { id: item.id, label: item.label, to: href, sortOrder: item.sortOrder };
  }

  // category：关联真实分类（categories 表），点击跳转到该分类的文章列表
  const cat = categories.find((c) => String(c.id) === item.target);
  if (!cat) return null;
  return {
    id: item.id,
    label: item.label || cat.name,
    to: "/posts",
    search: { categoryId: String(cat.id) },
    sortOrder: item.sortOrder,
  };

}

/** 过滤掉不符合当前枚举的历史残留菜单项（如旧的 uncategorized 类型） */
function validNavItems(items: NavMenuItem[]): NavMenuItem[] {
  const allowed = new Set(["home", "link", "category"]);
  return items.filter((n) => allowed.has(n.type));
}

/** 公开：返回渲染好的导航菜单（已启用、已排序、链接已解析，并构建成二级目录树） */
export const getNavMenuFn = createServerFn()
  .middleware([dbMiddleware])
  .handler(async ({ context }) => {
    const cfg = await ConfigService.getSystemConfig(context);
    const categories = await CategoryService.getCategories(context, {
      sortBy: "sortOrder",
      sortDir: "asc",
    });
    const items = withSystemNavItems(
      validNavItems(cfg.navMenu ?? fallbackNavMenu()),
    );

    // 1) 先逐个 resolve（enabled=false 的项 resolveNavItem 返回 null 会被过滤）
    const nodes = items
      .map((it) => ({ raw: it, resolved: resolveNavItem(it, categories) }))
      .filter(
        (
          x,
        ): x is { raw: NavMenuItem; resolved: ResolvedNavItem } =>
          x.resolved !== null,
      );

    // 2) 建立 id -> resolved 映射（含 children 容器）
    const byId = new Map<string, ResolvedNavItem>();
    nodes.forEach(({ resolved }) => byId.set(resolved.id, resolved));

    // 3) 按 parentId 嵌套；parentId 缺失/失效的视为顶级
    const roots: ResolvedNavItem[] = [];
    nodes.forEach(({ raw, resolved }) => {
      const pid = raw.parentId ?? null;
      const parent = pid ? byId.get(pid) : undefined;
      if (parent) {
        (parent.children ??= []).push(resolved);
      } else {
        roots.push(resolved);
      }
    });

    // 4) 每级按 sortOrder 升序排序
    const byOrder = (a: ResolvedNavItem, b: ResolvedNavItem) =>
      (a.sortOrder ?? 0) - (b.sortOrder ?? 0);
    roots.sort(byOrder);
    roots.forEach((r) => r.children?.sort(byOrder));

    return roots;
  });

/** 后台：读取导航菜单 + 真实分类列表（config.manage） */
export const getNavigationFn = createServerFn()
  .middleware([requirePermission("config.manage")])
  .handler(async ({ context }) => {
    const cfg = await ConfigService.getSystemConfig(context);
    const categories = await CategoryService.getCategories(context, {
      withCount: true,
      sortBy: "sortOrder",
      sortDir: "asc",
    });
    return {
      navMenu: withSystemNavItems(
        validNavItems(cfg.navMenu ?? fallbackNavMenu()),
      ),
      categories,
    };
  });

/** 后台：保存导航菜单（config.manage） */
export const saveNavMenuFn = createServerFn({ method: "POST" })
  .middleware([requirePermission("config.manage")])
  .inputValidator(z.array(navMenuItemSchema))
  .handler(async ({ context, data }) => {
    const cfg = await ConfigService.getSystemConfig(context);
    const next = { ...cfg, navMenu: withSystemNavItems(data) };
    await ConfigService.updateSystemConfig(context, next);
    await recordAdminLog(context.db, context.session.user, {
      action: "config.update",
      targetType: "system",
      targetId: null,
      targetName: null,
      detail: "更新导航菜单",
    });
    return { success: true };
  });
