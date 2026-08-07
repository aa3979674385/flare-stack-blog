import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requirePermission } from "@/lib/middlewares";
import * as AdminLogService from "../service/admin-log.service";

const listInputSchema = z.object({
  offset: z.number().int().nonnegative(),
  limit: z.number().int().positive(),
  search: z.string().optional(),
});

export const listAdminLogsFn = createServerFn()
  .middleware([requirePermission("log.view")])
  .inputValidator(listInputSchema)
  .handler(({ data, context }) => AdminLogService.listAdminLogs(context, data));

const deleteAdminLogsInputSchema = z.object({
  ids: z.array(z.string().min(1)).max(500),
});

/** 批量删除操作日志（按 id）。需 log.view 权限。 */
export const deleteAdminLogsFn = createServerFn({ method: "POST" })
  .middleware([requirePermission("log.view")])
  .inputValidator(deleteAdminLogsInputSchema)
  .handler(({ data, context }) =>
    AdminLogService.deleteAdminLogs(context, data.ids),
  );

/** 清空全部操作日志。需 log.view 权限。 */
export const clearAdminLogsFn = createServerFn({ method: "POST" })
  .middleware([requirePermission("log.view")])
  .handler(({ context }) => AdminLogService.clearAdminLogs(context));
