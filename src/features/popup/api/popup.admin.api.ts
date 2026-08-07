import { createServerFn } from "@tanstack/react-start";
import * as PopupService from "../popup.service";
import { PopupConfigSchema } from "../popup.schema";
import { requirePermission } from "@/lib/middlewares";

// 后台接口：保存弹窗配置（需 config.manage 权限）
export const savePopupConfigFn = createServerFn({ method: "POST" })
  .middleware([requirePermission("config.manage")])
  .inputValidator(PopupConfigSchema)
  .handler(async ({ data, context }) => {
    return await PopupService.savePopupConfig(context, data);
  });
