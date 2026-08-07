import type { DB } from "@/lib/db";
import * as AdminLogRepo from "../data/admin-log.data";

export async function createAdminLog(
  context: DbContext,
  input: AdminLogRepo.CreateAdminLogInput,
) {
  return AdminLogRepo.createAdminLog(context.db, input);
}

export async function listAdminLogs(
  context: DbContext,
  input: AdminLogRepo.ListAdminLogsInput,
) {
  return AdminLogRepo.listAdminLogs(context.db, input);
}

export async function deleteAdminLogs(context: DbContext, ids: string[]) {
  return AdminLogRepo.deleteAdminLogs(context.db, ids);
}

export async function clearAdminLogs(context: DbContext) {
  return AdminLogRepo.clearAdminLogs(context.db);
}

export interface RecordAdminLogInput {
  action: string;
  targetType: string;
  targetId?: string | null;
  targetName?: string | null;
  detail?: string | null;
}

/**
 * 在任何管理员操作成功后调用，记录一条操作日志。
 * 该调用被 try/catch 包裹，写入失败不影响主业务流程。
 */
export async function recordAdminLog(
  db: DB,
  admin: { id: string; name: string },
  input: RecordAdminLogInput,
): Promise<void> {
  try {
    await AdminLogRepo.createAdminLog(db, {
      adminId: admin.id,
      adminName: admin.name,
      ...input,
    });
  } catch (e) {
    // 日志写入失败不应影响主业务流程
    console.error("[admin-log] 写入操作日志失败", e);
  }
}
