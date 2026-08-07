import { sql } from "drizzle-orm";
import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { user } from "./auth.table";

/**
 * 积分流水表（point_transaction）。
 * 记录每一次积分变动（签到 / 后台调整 / 充值 / 消费 等），
 * 用于：前台「我的积分记录」、后台「积分动态」审计。
 * amount 为带符号整数：正数=增加，负数=扣减。
 */
export const pointTransaction = sqliteTable(
  "point_transaction",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    // 变动的积分类型：points=普通积分，credits=会员积分
    type: text("type", { enum: ["points", "credits"] }).notNull(),
    // 变动量（带符号）
    amount: integer("amount").notNull(),
    // 变动后的该类型积分余额（快照，便于对账）
    balanceAfter: integer("balance_after").notNull(),
    // 来源：checkin=签到，admin_adjust=后台调整，recharge=充值，consume=消费，other=其他
    source: text("source", {
      enum: ["checkin", "admin_adjust", "recharge", "consume", "other"],
    })
      .notNull()
      .default("other"),
    // 关联单据（如充值订单号）
    refId: text("ref_id"),
    // 关联订单号（资源购买产生的积分扣减时，关联 post_resource_order.order_no；便于按订单号检索积分流水）
    orderNo: text("order_no"),
    // 操作人（后台调整时记录管理员 id）
    operatorId: text("operator_id"),
    // 备注 / 原因
    reason: text("reason"),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`),
  },
  (table) => [
    index("point_txn_user_id_idx").on(table.userId),
    index("point_txn_created_at_idx").on(table.createdAt),
    index("point_txn_order_no_idx").on(table.orderNo),
  ],
);
