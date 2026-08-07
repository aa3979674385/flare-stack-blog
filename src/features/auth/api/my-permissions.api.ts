import { createServerFn } from "@tanstack/react-start";
import { eq } from "drizzle-orm";
import { sessionMiddleware } from "@/lib/middlewares";
import { user } from "@/lib/db/schema";
import {
  effectivePermissions,
  isSuperAdmin,
} from "@/lib/permissions";

/**
 * 返回当前登录管理员自身的权限信息（供侧边栏过滤、页面守卫使用）。
 * 仅需要已登录会话，不要求管理员（普通用户也能调用，只是 effective 为空）。
 * 直接读取 DB 的 permissions 列，确保与会话是否携带自定义列无关。
 */
export const getMyPermissionsFn = createServerFn()
  .middleware([sessionMiddleware])
  .handler(async ({ context }) => {
    if (!context.session) {
      return {
        role: null,
        permissions: null,
        isSuper: false,
        effective: [],
      };
    }
    const u = await context.db.query.user.findFirst({
      where: eq(user.id, context.session.user.id),
      columns: { role: true, permissions: true },
    });
    const subject = u ?? context.session.user;
    return {
      role: subject.role ?? null,
      permissions: (subject as { permissions?: unknown }).permissions ?? null,
      isSuper: isSuperAdmin(subject),
      effective: effectivePermissions(subject),
    };
  });
