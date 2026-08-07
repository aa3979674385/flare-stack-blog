import { sql } from "drizzle-orm";
import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

/**
 * VIP 会员套餐。
 * - priceCents：价格以「分」为单位存储，避免浮点误差；展示时除以 100。
 * - durationDays：套餐有效期（天），用于后续开通会员时计算到期时间。
 * - visible：是否在前台展示（1=显示，0=隐藏）。后台始终可管理。
 * - sortOrder：前台/后台排序权重，越小越靠前。
 */
export const membershipPlan = sqliteTable(
  "membership_plan",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    description: text("description"),
    priceCents: integer("price_cents").notNull(),
    durationDays: integer("duration_days").notNull().default(30),
    visible: integer("visible").default(1).notNull(),
    sortOrder: integer("sort_order").default(0).notNull(),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
      .notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" })
      .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (table) => [index("membership_plan_visible_idx").on(table.visible)],
);

export type MembershipPlan = typeof membershipPlan.$inferSelect;
export type NewMembershipPlan = typeof membershipPlan.$inferInsert;
