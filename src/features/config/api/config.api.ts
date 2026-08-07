import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { parseSiteAssetUploadInput } from "@/features/config/config.asset.schema";
import { SystemConfigSchema } from "@/features/config/config.schema";
import * as ConfigService from "@/features/config/service/config.service";
import { recordAdminLog } from "@/features/admin-log/service/admin-log.service";
import { dbMiddleware, requirePermission } from "@/lib/middlewares";
import { m } from "@/paraglide/messages";

export const getSystemConfigFn = createServerFn()
  .middleware([requirePermission("config.manage")])
  .handler(({ context }) => ConfigService.getSystemConfig(context));

/** 公开读取双积分名称 + 资源计费配置（任何已登录用户均可调用，仅返回展示用配置，不含敏感信息） */
export const getPointConfigFn = createServerFn()
  .middleware([dbMiddleware])
  .handler(async ({ context }) => {
    const cfg = await ConfigService.getSystemConfig(context);
    return {
      pointsName: cfg.points?.pointsName ?? "普通积分",
      creditsName: cfg.points?.creditsName ?? "会员积分",
      pointsPerYuan: cfg.points?.pointsPerYuan ?? 10,
      paymentEnabled: cfg.points?.paymentEnabled ?? false,
    };
  });

/** 更新双积分名称 + 资源计费配置（仅 config.manage 权限） */
export const updatePointConfigFn = createServerFn({ method: "POST" })
  .middleware([requirePermission("config.manage")])
  .inputValidator(
    z.object({
      pointsName: z.string().min(1).max(20),
      creditsName: z.string().min(1).max(20),
      pointsPerYuan: z.number().int().positive().optional(),
      paymentEnabled: z.boolean().optional(),
    }),
  )
  .handler(async ({ context, data }) => {
    await ConfigService.updatePointsConfig(context, data);
    await recordAdminLog(context.db, context.session.user, {
      action: "config.update",
      targetType: "system",
      targetId: null,
      targetName: null,
      detail: "更新积分与计费配置",
    });
  });

export const updateSystemConfigFn = createServerFn({
  method: "POST",
})
  .middleware([requirePermission("config.manage")])
  .inputValidator(SystemConfigSchema)
  .handler(async ({ context, data }) => {
    await ConfigService.updateSystemConfig(context, data);
    await recordAdminLog(context.db, context.session.user, {
      action: "config.update",
      targetType: "system",
      targetId: null,
      targetName: null,
      detail: null,
    });
  });

const SiteAssetUploadInputSchema = z.instanceof(FormData);

export const uploadSiteAssetFn = createServerFn({
  method: "POST",
})
  .middleware([requirePermission("config.manage")])
  .inputValidator(SiteAssetUploadInputSchema)
  .handler(async ({ data, context }) => {
    const input = parseSiteAssetUploadInput(data, m);
    return ConfigService.uploadSiteAsset(context, input);
  });
