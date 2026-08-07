import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import {
  authMiddleware,
  createRateLimitMiddleware,
  turnstileMiddleware,
} from "@/lib/middlewares";
import {
  CardKeyError,
  redeemCardKey,
  type RedeemResult,
} from "../data/card-keys.data";

const redeemSchema = z.object({
  code: z.string().trim().min(1, "请输入卡密"),
});

/**
 * 前台兑换卡密（需登录 + 人机验证）。
 * - 限流：按客户端 IP 防脚本批量试错/探测
 * - Turnstile：人机验证（未配置 TURNSTILE_SECRET_KEY 时自动跳过）
 * - 鉴权：未登录直接返回 401（authMiddleware，而非 handler 内手动抛普通 Error）
 * 失败信息直接映射为：卡密不存在 / 卡密已兑换。
 */
export const redeemCardKeyFn = createServerFn({ method: "POST" })
  .middleware([
    // 防脚本批量试错/探测：按客户端 IP 限流（与评论接口一致的模式）
    createRateLimitMiddleware({
      capacity: 10,
      interval: "1m",
      key: "cardkey:redeem",
    }),
    // 人机验证：防脚本自动化兑换（未配置密钥时自动跳过）
    turnstileMiddleware,
    // 鉴权：强制登录，未登录返回规范 401
    authMiddleware,
  ])
  .inputValidator(redeemSchema)
  .handler(async ({ data, context }): Promise<RedeemResult> => {
    const sessionUser = context.session.user;
    try {
      return await redeemCardKey(context.db, {
        code: data.code,
        userId: sessionUser.id,
      });
    } catch (e) {
      if (e instanceof CardKeyError) {
        throw new Error(e.reason === "USED" ? "卡密已兑换" : "卡密不存在");
      }
      throw e;
    }
  });
