import { z } from "zod";
import { blogConfig } from "@/blog.config";
import {
  createSiteConfigInputFormSchema,
  type SiteConfigInput,
  SiteConfigInputSchema,
} from "@/features/config/site-config.schema";
import { webhookEndpointSchema } from "@/features/webhook/webhook.schema";
import {
  DEFAULT_HOME_NAV_ITEM,
  navMenuItemSchema,
} from "@/features/navigation/navigation.schema";
import type { Messages } from "@/lib/i18n";

export const SystemConfigSchema = z.object({
  email: z
    .object({
      apiKey: z.string().optional(),
      host: z.string().optional(),
      port: z.number().int().positive().optional(),
      username: z.string().optional(),
      password: z.string().optional(),
      senderName: z.string().optional(),
      senderAddress: z.union([z.email(), z.literal("")]).optional(),
    })
    .optional(),
  notification: z
    .object({
      admin: z
        .object({
          channels: z
            .object({
              email: z.boolean().optional(),
              webhook: z.boolean().optional(),
            })
            .optional(),
        })
        .optional(),
      user: z
        .object({
          emailEnabled: z.boolean().optional(),
        })
        .optional(),
      webhooks: z.array(webhookEndpointSchema).optional(),
    })
    .optional(),
  site: SiteConfigInputSchema.optional(),
  auth: z
    .object({
      methods: z.enum(["email", "oauth", "both"]).default("email"),
      requireEmailVerification: z.boolean().default(false),
    })
    .optional(),
  // 双积分名称 + 资源计费（前台展示/换算用，可后台配置）
  points: z
    .object({
      pointsName: z.string().max(20).default("普通积分"),
      creditsName: z.string().max(20).default("会员积分"),
      // 多少积分 = 1 元（用于「积分不足时自动折算成人民币」）
      pointsPerYuan: z.number().int().positive().default(10),
      // 是否已接入支付网关（接入后，积分不足可自动折算为人民币并调起支付）
      paymentEnabled: z.boolean().default(false),
    })
    .optional(),
  // 每日下载限制：普通用户 / 会员用户分别限制每天可下载的「不同文章」篇数（免费/收费均计入）；0 = 不限
  downloadLimit: z
    .object({
      normalUserDaily: z.number().int().min(0).default(0),
      memberDaily: z.number().int().min(0).default(0),
    })
    .optional(),
  // 前台导航菜单（后台可管理：首页 / 自定义链接 / 分类）
  navMenu: z.array(navMenuItemSchema).optional(),
  // 各类后台记录是否记录（关闭后对应记录不再写入，用于减少库表 clutter / 隐私）
  records: z
    .object({
      /** 操作日志（管理员后台操作审计） */
      operationLog: z.boolean().default(true),
      /** 积分动态（积分流水） */
      pointsLog: z.boolean().default(true),
      /** 购买记录（资源订单） */
      purchaseLog: z.boolean().default(true),
      /** 附件下载记录 */
      downloadLog: z.boolean().default(true),
    })
    .optional(),
});

export type AuthMethod = "email" | "oauth" | "both";

export const createSystemConfigFormSchema = (messages: Messages) =>
  z.object({
    email: SystemConfigSchema.shape.email,
    notification: SystemConfigSchema.shape.notification,
    site: createSiteConfigInputFormSchema(messages).optional(),
    auth: SystemConfigSchema.shape.auth,
  });

export type SystemConfig = z.infer<typeof SystemConfigSchema>;
export type {
  SiteConfig,
  SiteConfigInput,
} from "@/features/config/site-config.schema";

export const DEFAULT_CONFIG: SystemConfig = {
  email: {
    host: "",
    port: 465,
    username: "",
    password: "",
    senderName: "",
    senderAddress: "",
  },
  notification: {
    admin: {
      channels: {
        email: true,
        webhook: true,
      },
    },
    user: {
      emailEnabled: true,
    },
    webhooks: [],
  },
  site: blogConfig satisfies SiteConfigInput,
  auth: { methods: "email", requireEmailVerification: false },
  points: { pointsName: "普通积分", creditsName: "会员积分", pointsPerYuan: 10, paymentEnabled: false },
  downloadLimit: { normalUserDaily: 0, memberDaily: 0 },
  navMenu: [DEFAULT_HOME_NAV_ITEM],
  records: {
    operationLog: true,
    pointsLog: true,
    purchaseLog: true,
    downloadLog: true,
  },
};

export const CONFIG_CACHE_KEYS = {
  system: ["system"] as const,
} as const;
