import { createServerFn } from "@tanstack/react-start";
import { authMiddleware, sessionMiddleware } from "@/lib/middlewares";
import * as MembershipData from "../data/membership.data";

export type { PublicMembershipPlan, MyMembershipStatus } from "../data/membership.data";

/**
 * 前台公开：列出 visible=1 的会员套餐，供会员中心「会员套餐」页展示与卡密激活引导。
 * 仅需登录态（sessionMiddleware），未登录也可调用（用于展示，下单/激活仍受各自接口约束）。
 */
export const listPublicMembershipPlansFn = createServerFn()
  .middleware([sessionMiddleware])
  .handler(async ({ context }): Promise<MembershipData.PublicMembershipPlan[]> => {
    return MembershipData.listPublicMembershipPlans(context.db);
  });

/**
 * 前台：查询当前登录用户的会员状态（是否会员、到期时间、套餐名）。
 * 必须登录（authMiddleware），未登录返回规范 401。
 */
export const getMyMembershipStatusFn = createServerFn()
  .middleware([authMiddleware])
  .handler(async ({ context }): Promise<MembershipData.MyMembershipStatus> => {
    return MembershipData.getMyMembershipStatus(
      context.db,
      context.session.user.id,
    );
  });
