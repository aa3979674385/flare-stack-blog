import { createServerFn } from "@tanstack/react-start";
import { getRequestHeader } from "@tanstack/react-start/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { recordAdminLog } from "@/features/admin-log/service/admin-log.service";
import { user } from "@/lib/db/schema";
import { createPermissionError } from "@/lib/errors";
import { dbMiddleware, requirePermission } from "@/lib/middlewares";
import * as UserService from "../service/users.service";

const listUsersInputSchema = z.object({
  offset: z.number().int().nonnegative(),
  limit: z.number().int().positive(),
  search: z.string().optional(),
});

const getUserInputSchema = z.object({
  id: z.string(),
});

const updateUserInputSchema = z.object({
  id: z.string(),
  name: z.string().min(1).max(80),
  role: z.enum(["admin", "user"]),
  // 权限键数组；null = 超级管理员（全部权限）；role 非 admin 时忽略
  permissions: z.array(z.string()).nullable().optional(),
  banned: z.boolean(),
  banReason: z.string().max(500).nullable().optional(),
  // 封禁到期时间戳（ms）；null 表示永久封禁
  banExpires: z.number().nullable().optional(),
});

export type UpdateUserPayload = z.infer<typeof updateUserInputSchema>;

export const listUsersFn = createServerFn()
  .middleware([requirePermission("user.manage")])
  .inputValidator(listUsersInputSchema)
  .handler(({ data, context }) => UserService.listUsers(context, data));

export const getUserFn = createServerFn()
  .middleware([requirePermission("user.manage")])
  .inputValidator(getUserInputSchema)
  .handler(({ data, context }) => UserService.getUser(context, data.id));

export const updateUserFn = createServerFn()
  .middleware([requirePermission("user.manage")])
  .inputValidator(updateUserInputSchema)
  .handler(async ({ data, context }) => {
    const prev = await UserService.getUser(context, data.id);
    await UserService.updateUser(context, data.id, {
      name: data.name,
      role: data.role,
      // 仅在显式传了 permissions 时更新（封禁/解封等调用可不传，避免清空）
      ...(data.permissions !== undefined
        ? { permissions: data.permissions }
        : {}),
      banned: data.banned,
      banReason: data.banned ? (data.banReason ?? null) : null,
      banExpires: data.banned
        ? data.banExpires != null
          ? new Date(data.banExpires)
          : null
        : null,
    });

    // 记录操作日志
    const admin = context.session.user;
    let action = "user.update";
    let detail: string | null = null;
    if (data.banned && !prev?.banned) {
      action = "user.ban";
      detail = JSON.stringify({
        banReason: data.banReason ?? null,
        banExpires: data.banExpires ?? null,
      });
    } else if (!data.banned && prev?.banned) {
      action = "user.unban";
    } else {
      detail = JSON.stringify({
        name: data.name,
        role: data.role,
        banned: data.banned,
      });
    }
    await recordAdminLog(context.db, admin, {
      action,
      targetType: "user",
      targetId: data.id,
      targetName: prev?.name ?? data.name,
      detail,
    });
  });

/** 设置 / 取消用户会员状态：关联套餐 id 与到期时间（ms；null=永久）。 */
const setMembershipSchema = z.object({
  id: z.string(),
  planId: z.string().nullable(),
  expiresAt: z.number().nullable(),
});

export const setUserMembershipFn = createServerFn()
  .middleware([requirePermission("user.manage")])
  .inputValidator(setMembershipSchema)
  .handler(async ({ data, context }) => {
    const prev = await UserService.getUser(context, data.id);
    await context.db
      .update(user)
      .set({
        membershipPlanId: data.planId,
        membershipExpiresAt:
          data.expiresAt != null ? new Date(data.expiresAt) : null,
      })
      .where(eq(user.id, data.id));
    await recordAdminLog(context.db, context.session.user, {
      action: data.planId ? "user.membership.grant" : "user.membership.revoke",
      targetType: "user",
      targetId: data.id,
      targetName: prev?.name ?? data.id,
      detail: JSON.stringify({
        planId: data.planId,
        expiresAt: data.expiresAt,
      }),
    });
  });

/** 从请求 cookie 中提取所有可能的会话 token（规避不同版本 cookie 命名差异） */
function extractSessionTokenCandidates(cookie: string): string[] {
  if (!cookie) return [];
  return cookie
    .split(";")
    .map((c) => c.trim())
    .filter(Boolean)
    .map((pair) => {
      const idx = pair.indexOf("=");
      if (idx === -1) return "";
      const raw = pair.slice(idx + 1);
      try {
        return decodeURIComponent(raw);
      } catch {
        return raw;
      }
    })
    .filter(Boolean);
}

/** 判断当前访问者（已登录但被封禁）是否处于封禁状态。无需鉴权，仅读 cookie + DB。 */
export const getBannedStatusFn = createServerFn()
  .middleware([dbMiddleware])
  .handler(async ({ context }) => {
    const cookie = getRequestHeader("cookie") || "";
    const candidates = extractSessionTokenCandidates(cookie);
    if (candidates.length === 0) return null;
    return UserService.getBanInfoBySessionTokens(context, candidates);
  });

/** 通过邮箱查询封禁信息（用于登录失败但已知邮箱的场景） */
export const getBanInfoByEmailFn = createServerFn()
  .middleware([dbMiddleware])
  .inputValidator(z.object({ email: z.string() }))
  .handler(({ data, context }) =>
    UserService.getBanInfoByEmail(context, data.email),
  );

/** 删除用户（级联清理会话与第三方账号绑定）。禁止删除当前登录的管理员自身。 */
export const deleteUserFn = createServerFn()
  .middleware([requirePermission("user.manage")])
  .inputValidator(z.object({ id: z.string() }))
  .handler(async ({ data, context }) => {
    if (context.session.user.id === data.id) {
      throw createPermissionError();
    }
    const target = await UserService.getUser(context, data.id);
    await UserService.deleteUser(context, data.id);
    await recordAdminLog(context.db, context.session.user, {
      action: "user.delete",
      targetType: "user",
      targetId: data.id,
      targetName: target?.name ?? null,
    });
  });

const adjustPointsInputSchema = z.object({
  id: z.string(),
  type: z.enum(["points", "credits"]),
  delta: z.number().int(),
  reason: z.string().max(200).nullable().optional(),
});

export type AdjustUserPointsPayload = z.infer<typeof adjustPointsInputSchema>;

/** 调整用户双积分（普通积分 points / 会员积分 credits）：在现有余额上增减，结果不允许为负。 */
export const adjustPointsFn = createServerFn()
  .middleware([requirePermission("user.manage")])
  .inputValidator(adjustPointsInputSchema)
  .handler(async ({ data, context }) => {
    const target = await UserService.getUser(context, data.id);
    const balance = await UserService.adjustPoints(
      context,
      data.id,
      data.type,
      data.delta,
    );
    const admin = context.session.user;
    // 同步记一条积分流水（与后台操作日志互补，便于对账与用户侧展示）
    await UserService.recordUserPointTransaction(context, {
      userId: data.id,
      type: data.type,
      amount: data.delta,
      balanceAfter: balance,
      source: "admin_adjust",
      operatorId: admin.id,
      reason: data.reason ?? null,
    });
    await recordAdminLog(context.db, admin, {
      action: "user.adjustPoints",
      targetType: "user",
      targetId: data.id,
      targetName: target?.name ?? null,
      detail: JSON.stringify({
        type: data.type,
        delta: data.delta,
        balance,
        reason: data.reason ?? null,
      }),
    });
    return { balance };
  });

const listPointTxInputSchema = z.object({
  offset: z.number().int().nonnegative(),
  limit: z.number().int().positive().max(100),
  userId: z.string().optional(),
  type: z.enum(["points", "credits"]).optional(),
  source: z.string().optional(),
  orderNo: z.string().optional(),
});

/** 后台：积分流水总览（支持按用户 / 类型 / 来源 / 订单号筛选）。需 points.view 权限。 */
export const getPointTransactionsFn = createServerFn()
  .middleware([requirePermission("points.view")])
  .inputValidator(listPointTxInputSchema)
  .handler(async ({ data, context }) =>
    UserService.listUserPointTransactions(context, {
      offset: data.offset,
      limit: data.limit,
      userId: data.userId,
      type: data.type,
      source: data.source,
      orderNo: data.orderNo,
    }),
  );

const deletePointTxInputSchema = z.object({
  ids: z.array(z.string().min(1)).max(500),
});

/** 批量删除积分流水（按 id）。需 points.view 权限。 */
export const deletePointTransactionsFn = createServerFn({ method: "POST" })
  .middleware([requirePermission("points.view")])
  .inputValidator(deletePointTxInputSchema)
  .handler(({ data, context }) =>
    UserService.deletePointTransactions(context, data.ids),
  );

/** 清空全部积分流水。需 points.view 权限。不影响用户余额。 */
export const clearPointTransactionsFn = createServerFn({ method: "POST" })
  .middleware([requirePermission("points.view")])
  .handler(({ context }) => UserService.clearPointTransactions(context));
