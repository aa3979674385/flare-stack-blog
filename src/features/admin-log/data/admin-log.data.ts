import { desc, inArray, like, or, sql } from "drizzle-orm";
import { getSystemConfig } from "@/features/config/data/config.data";
import type { DB } from "@/lib/db";
import { adminLog } from "@/lib/db/schema";

export type AdminLogRow = typeof adminLog.$inferSelect;

export interface CreateAdminLogInput {
  adminId: string;
  adminName: string;
  action: string;
  targetType: string;
  targetId?: string | null;
  targetName?: string | null;
  detail?: string | null;
}

export interface ListAdminLogsInput {
  offset: number;
  limit: number;
  search?: string;
}

export interface ListAdminLogsResult {
  items: AdminLogRow[];
  total: number;
}

export async function createAdminLog(
  db: DB,
  input: CreateAdminLogInput,
): Promise<void> {
  // 操作日志开关关闭时不记录（records.operationLog 缺省视为开启）
  const cfg = await getSystemConfig(db);
  if (cfg?.records?.operationLog === false) return;

  await db.insert(adminLog).values({
    id: crypto.randomUUID(),
    adminId: input.adminId,
    adminName: input.adminName,
    action: input.action,
    targetType: input.targetType,
    targetId: input.targetId ?? null,
    targetName: input.targetName ?? null,
    detail: input.detail ?? null,
  });
}

export async function listAdminLogs(
  db: DB,
  input: ListAdminLogsInput,
): Promise<ListAdminLogsResult> {
  const conditions = [];
  if (input.search && input.search.trim()) {
    const s = `%${input.search.trim()}%`;
    conditions.push(
      or(
        like(adminLog.adminName, s),
        like(adminLog.targetName, s),
        like(adminLog.action, s),
      ),
    );
  }

  const items = await db
    .select()
    .from(adminLog)
    .where(conditions.length ? or(...conditions) : undefined)
    .orderBy(desc(adminLog.createdAt))
    .limit(input.limit)
    .offset(input.offset);

  const [{ total }] = await db
    .select({ total: sql<number>`count(*)` })
    .from(adminLog)
    .where(conditions.length ? or(...conditions) : undefined);

  return { items, total: Number(total) };
}

/** 批量删除操作日志（按 id）。ids 为空时直接返回，避免误清空。 */
export async function deleteAdminLogs(db: DB, ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  await db.delete(adminLog).where(inArray(adminLog.id, ids));
}

/** 清空全部操作日志。 */
export async function clearAdminLogs(db: DB): Promise<void> {
  await db.delete(adminLog);
}
