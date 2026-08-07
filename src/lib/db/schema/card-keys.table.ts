import { sql } from "drizzle-orm";
import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

/**
 * 卡密（兑换码）表。
 * - 一张卡密绑定一组奖励配置（会员时长 / 积分A=普通积分(points) / 积分B=会员积分(credits)），
 *   奖励配置永久绑定卡密，生成后不再变化。
 * - status：unused=未兑换，used=已兑换；单张卡密仅可兑换一次。
 * - 所有奖励字段均可空：空表示该项不发放。
 */
export const cardKeyStatus = ["unused", "used"] as const;
export type CardKeyStatus = (typeof cardKeyStatus)[number];

export const cardKey = sqliteTable(
  "card_key",
  {
    id: text("id").primaryKey(),
    // 卡密明文（展示与兑换用），全局唯一
    code: text("code").notNull().unique(),
    // 批次备注（记录用途），可空
    batchNote: text("batch_note"),
    // 会员时长（天），可空：空=不赠送会员
    membershipDays: integer("membership_days"),
    // 积分A数量（普通积分 points），可空：空=不发放
    pointsA: integer("points_a"),
    // 积分B数量（会员积分 credits），可空：空=不发放
    pointsB: integer("points_b"),
    status: text("status", { enum: cardKeyStatus })
      .notNull()
      .default("unused"),
    // 兑换用户 id，可空
    redeemedBy: text("redeemed_by"),
    // 兑换时间，可空
    redeemedAt: integer("redeemed_at", { mode: "timestamp_ms" }),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`),
  },
  (table) => [
    index("card_key_status_idx").on(table.status),
    index("card_key_created_at_idx").on(table.createdAt),
  ],
);

/**
 * 卡密兑换记录。每成功兑换一张卡密写一条，永久绑定「谁、何时、获得了哪些权益」，
 * 便于审计与对账。与 card_key 一对多（实际上每张卡密最多一条）。
 */
export const cardKeyRedemption = sqliteTable(
  "card_key_redemption",
  {
    id: text("id").primaryKey(),
    cardKeyId: text("card_key_id")
      .notNull()
      .references(() => cardKey.id, { onDelete: "cascade" }),
    userId: text("user_id").notNull(),
    // 实际发放值快照（与 card_key 配置一致；用途：即使卡密配置变动也能回溯）
    membershipDaysGranted: integer("membership_days_granted"),
    pointsAGranted: integer("points_a_granted"),
    pointsBGranted: integer("points_b_granted"),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`),
  },
  (table) => [index("card_key_redemption_user_id_idx").on(table.userId)],
);

export type CardKey = typeof cardKey.$inferSelect;
export type NewCardKey = typeof cardKey.$inferInsert;
export type CardKeyRedemption = typeof cardKeyRedemption.$inferSelect;
export type NewCardKeyRedemption = typeof cardKeyRedemption.$inferInsert;
