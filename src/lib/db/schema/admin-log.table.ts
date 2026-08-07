import { sql } from "drizzle-orm";
import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

/**
 * 管理员操作日志表。
 * 记录所有管理员在后台的操作（用户管理、配置更新等），用于审计。
 */
export const adminLog = sqliteTable(
  "admin_log",
  {
    id: text("id").primaryKey(),
    adminId: text("admin_id").notNull(),
    adminName: text("admin_name").notNull(),
    action: text("action").notNull(),
    targetType: text("target_type").notNull(),
    targetId: text("target_id"),
    targetName: text("target_name"),
    detail: text("detail"),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`),
  },
  (table) => [index("admin_log_created_at_idx").on(table.createdAt)],
);
