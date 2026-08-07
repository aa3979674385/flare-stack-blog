import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requirePermission } from "@/lib/middlewares";
import * as CardKeysData from "../data/card-keys.data";

const generateSchema = z
  .object({
    count: z.number().int().positive().max(1000).default(1),
    batchNote: z.string().max(200).nullable().optional(),
    membershipDays: z.number().int().positive().nullable().optional(),
    pointsA: z.number().int().positive().nullable().optional(),
    pointsB: z.number().int().positive().nullable().optional(),
  })
  .refine(
    (d) =>
      (d.membershipDays ?? 0) > 0 ||
      (d.pointsA ?? 0) > 0 ||
      (d.pointsB ?? 0) > 0,
    { message: "至少填写一项奖励（会员时长 / 积分A / 积分B）" },
  );

const listSchema = z.object({
  keyword: z.string().max(200).optional(),
  status: z.enum(["unused", "used"]).optional(),
  offset: z.number().int().nonnegative().default(0),
  limit: z.number().int().positive().max(200).default(20),
});

const exportSchema = z.object({
  keyword: z.string().max(200).optional(),
  status: z.enum(["unused", "used"]).optional(),
});

/** 批量生成卡密（后台） */
export const generateCardKeysFn = createServerFn({ method: "POST" })
  .middleware([requirePermission("cardkey.manage")])
  .inputValidator(generateSchema)
  .handler(async ({ data, context }) => {
    return CardKeysData.generateCardKeys(context.db, {
      count: data.count,
      batchNote: data.batchNote ?? null,
      membershipDays: data.membershipDays ?? null,
      pointsA: data.pointsA ?? null,
      pointsB: data.pointsB ?? null,
    });
  });

/** 卡密列表（后台，支持筛选/分页） */
export const listCardKeysFn = createServerFn()
  .middleware([requirePermission("cardkey.manage")])
  .inputValidator(listSchema)
  .handler(async ({ data, context }) => {
    return CardKeysData.listCardKeys(context.db, data);
  });

/** 卡密导出（后台，返回筛选后全部） */
export const exportCardKeysFn = createServerFn()
  .middleware([requirePermission("cardkey.manage")])
  .inputValidator(exportSchema)
  .handler(async ({ data, context }) => {
    return CardKeysData.exportCardKeys(context.db, data);
  });
