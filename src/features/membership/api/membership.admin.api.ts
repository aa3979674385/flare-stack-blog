import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { recordAdminLog } from "@/features/admin-log/service/admin-log.service";
import { requirePermission } from "@/lib/middlewares";
import * as MembershipData from "../data/membership.data";

const planInputSchema = z.object({
  name: z.string().trim().min(1, "套餐名称不能为空").max(50),
  // 价格单位：分（客户端把「元」换算后传入）
  priceCents: z.number().int("价格必须为整数分").nonnegative("价格不能为负"),
  durationDays: z.number().int().positive("有效期必须为正整数").default(30),
  // 1=显示，0=隐藏
  visible: z.number().int().min(0).max(1).default(1),
  sortOrder: z.number().int().default(0),
  description: z.string().max(500).nullable().optional(),
});

const createInputSchema = planInputSchema;

const updateInputSchema = planInputSchema.extend({
  id: z.string().min(1),
});

const idOnlySchema = z.object({ id: z.string().min(1) });

const setVisibleSchema = z.object({
  id: z.string().min(1),
  visible: z.number().int().min(0).max(1),
});

export const listMembershipPlansFn = createServerFn()
  .middleware([requirePermission("membership.manage")])
  .handler(async ({ context }) => {
    return MembershipData.listMembershipPlans(context.db);
  });

/** 轻量套餐选项（id + 名称），供用户详情页等「user.manage」场景选择关联套餐使用。 */
export const listMembershipPlanOptionsFn = createServerFn()
  .middleware([requirePermission("user.manage")])
  .handler(async ({ context }) => {
    const plans = await MembershipData.listMembershipPlans(context.db);
    return plans.map((p) => ({ id: p.id, name: p.name }));
  });

export const createMembershipPlanFn = createServerFn({ method: "POST" })
  .middleware([requirePermission("membership.manage")])
  .inputValidator(createInputSchema)
  .handler(async ({ data, context }) => {
    const id = crypto.randomUUID();
    const plan = await MembershipData.insertMembershipPlan(context.db, {
      id,
      name: data.name,
      description: data.description ?? null,
      priceCents: data.priceCents,
      durationDays: data.durationDays,
      visible: data.visible,
      sortOrder: data.sortOrder,
    });
    await recordAdminLog(context.db, context.session.user, {
      action: "membership.create",
      targetType: "membership_plan",
      targetId: id,
      targetName: data.name,
      detail: null,
    });
    return plan;
  });

export const updateMembershipPlanFn = createServerFn({ method: "POST" })
  .middleware([requirePermission("membership.manage")])
  .inputValidator(updateInputSchema)
  .handler(async ({ data, context }) => {
    const existing = await MembershipData.getMembershipPlanById(
      context.db,
      data.id,
    );
    if (!existing) throw new Error("套餐不存在");

    const plan = await MembershipData.updateMembershipPlan(context.db, data.id, {
      name: data.name,
      description: data.description ?? null,
      priceCents: data.priceCents,
      durationDays: data.durationDays,
      visible: data.visible,
      sortOrder: data.sortOrder,
    });
    await recordAdminLog(context.db, context.session.user, {
      action: "membership.update",
      targetType: "membership_plan",
      targetId: data.id,
      targetName: data.name,
      detail: JSON.stringify({
        priceCents: data.priceCents,
        durationDays: data.durationDays,
        visible: data.visible,
      }),
    });
    return plan;
  });

export const deleteMembershipPlanFn = createServerFn({ method: "POST" })
  .middleware([requirePermission("membership.manage")])
  .inputValidator(idOnlySchema)
  .handler(async ({ data, context }) => {
    const existing = await MembershipData.getMembershipPlanById(
      context.db,
      data.id,
    );
    if (!existing) throw new Error("套餐不存在");

    await MembershipData.deleteMembershipPlan(context.db, data.id);
    await recordAdminLog(context.db, context.session.user, {
      action: "membership.delete",
      targetType: "membership_plan",
      targetId: data.id,
      targetName: existing.name,
      detail: null,
    });
  });

export const setMembershipPlanVisibleFn = createServerFn({ method: "POST" })
  .middleware([requirePermission("membership.manage")])
  .inputValidator(setVisibleSchema)
  .handler(async ({ data, context }) => {
    const existing = await MembershipData.getMembershipPlanById(
      context.db,
      data.id,
    );
    if (!existing) throw new Error("套餐不存在");

    await MembershipData.updateMembershipPlan(context.db, data.id, {
      visible: data.visible,
    });
    await recordAdminLog(context.db, context.session.user, {
      action: "membership.update",
      targetType: "membership_plan",
      targetId: data.id,
      targetName: existing.name,
      detail: JSON.stringify({ visible: data.visible }),
    });
  });
