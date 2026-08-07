import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import * as UserService from "@/features/users/service/users.service";
import { authMiddleware, sessionMiddleware } from "@/lib/middlewares";
import { eq } from "drizzle-orm";
import { user } from "@/lib/db/schema";

/**
 * 返回当前登录用户自身的双积分余额（普通积分 points + 会员积分 credits）。
 * 仅需要已登录会话；未登录返回 0/0。
 */
export const getMyPointsFn = createServerFn()
  .middleware([sessionMiddleware])
  .handler(async ({ context }) => {
    const u =
      context.session?.user
        ? await context.db.query.user.findFirst({
            where: eq(user.id, context.session.user.id),
            columns: { points: true, credits: true },
          })
        : null;
    return {
      points: u?.points ?? 0,
      credits: u?.credits ?? 0,
    };
  });

/** 当前登录用户自己的积分流水（分页） */
export const getMyPointTransactionsFn = createServerFn()
  .middleware([authMiddleware])
  .inputValidator(
    z.object({
      offset: z.number().int().nonnegative(),
      limit: z.number().int().positive().max(100),
    }),
  )
  .handler(async ({ data, context }) =>
    UserService.listUserPointTransactions(context, {
      userId: context.session.user.id,
      offset: data.offset,
      limit: data.limit,
    }),
  );

/** 当前用户签到状态（最近签到时间 / 连续天数 / 今日是否可签到） */
export const getMyCheckInStatusFn = createServerFn()
  .middleware([authMiddleware])
  .handler(async ({ context }) =>
    UserService.getCheckInStatus(context, context.session.user.id),
  );

/** 执行每日签到：发放普通积分并记录流水（服务端校验「今日未签」） */
export const checkInFn = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .handler(async ({ context }) =>
    UserService.performCheckIn(context, context.session.user.id),
  );
