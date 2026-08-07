import { blogConfig } from "@/blog.config";
import * as CacheService from "@/features/cache/cache.service";
import type { SiteConfig, SystemConfig } from "@/features/config/config.schema";
import {
  CONFIG_CACHE_KEYS,
  DEFAULT_CONFIG,
  SystemConfigSchema,
} from "@/features/config/config.schema";
import * as ConfigRepo from "@/features/config/data/config.data";
import { FullSiteConfigSchema } from "@/features/config/site-config.schema";
import type { SocialLink } from "@/features/config/utils/social-platforms";
import * as Storage from "@/features/media/data/media.storage";
import { purgeSiteCDNCache } from "@/lib/invalidate";

const DEFAULT_SMTP_PORT = 465;
const RESEND_SMTP_HOST = "smtp.resend.com";
const RESEND_SMTP_USERNAME = "resend";

function resolveEmailConfig(config: SystemConfig | null | undefined) {
  const email = config?.email;
  const legacyApiKey = email?.apiKey?.trim() || "";
  const password = email?.password?.trim() || legacyApiKey;
  const host = email?.host?.trim() || (legacyApiKey ? RESEND_SMTP_HOST : "");
  const username =
    email?.username?.trim() || (legacyApiKey ? RESEND_SMTP_USERNAME : "");

  return {
    host,
    port: email?.port ?? DEFAULT_SMTP_PORT,
    username,
    password,
    senderName: email?.senderName ?? "",
    senderAddress: email?.senderAddress ?? "",
  };
}

export function resolveSystemConfig(
  config: SystemConfig | null | undefined,
): SystemConfig {
  return {
    ...DEFAULT_CONFIG,
    ...config,
    points: {
      pointsName:
        config?.points?.pointsName ?? DEFAULT_CONFIG.points!.pointsName,
      creditsName:
        config?.points?.creditsName ?? DEFAULT_CONFIG.points!.creditsName,
      pointsPerYuan:
        config?.points?.pointsPerYuan ?? DEFAULT_CONFIG.points!.pointsPerYuan,
      paymentEnabled:
        config?.points?.paymentEnabled ?? DEFAULT_CONFIG.points!.paymentEnabled,
    },
    downloadLimit: {
      normalUserDaily:
        config?.downloadLimit?.normalUserDaily ??
        DEFAULT_CONFIG.downloadLimit!.normalUserDaily,
      memberDaily:
        config?.downloadLimit?.memberDaily ??
        DEFAULT_CONFIG.downloadLimit!.memberDaily,
    },
    email: resolveEmailConfig(config),
    notification: {
      ...DEFAULT_CONFIG.notification,
      ...config?.notification,
      admin: {
        ...DEFAULT_CONFIG.notification?.admin,
        ...config?.notification?.admin,
        channels: {
          ...DEFAULT_CONFIG.notification?.admin?.channels,
          ...config?.notification?.admin?.channels,
        },
      },
      user: {
        ...DEFAULT_CONFIG.notification?.user,
        ...config?.notification?.user,
      },
      webhooks:
        config?.notification?.webhooks ?? DEFAULT_CONFIG.notification?.webhooks,
    },
    site: resolveSiteConfig(config),
    records: {
      operationLog:
        config?.records?.operationLog ?? DEFAULT_CONFIG.records!.operationLog,
      pointsLog:
        config?.records?.pointsLog ?? DEFAULT_CONFIG.records!.pointsLog,
      purchaseLog:
        config?.records?.purchaseLog ?? DEFAULT_CONFIG.records!.purchaseLog,
      downloadLog:
        config?.records?.downloadLog ?? DEFAULT_CONFIG.records!.downloadLog,
    },
  };
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * 深度合并配置：override 中提供的字段覆盖 base，override 未提供的字段保留 base 原值。
 * 用于「部分字段更新」场景（如后台只保存站点/主题某几个字段），避免把未提交的字段
 * （如导航菜单 navMenu、积分 points、通知 notification 等）误清空成默认值。
 */
function deepMergeConfig<T>(base: T, override: T): T {
  if (isPlainObject(base) && isPlainObject(override)) {
    const result: Record<string, unknown> = {
      ...(base as Record<string, unknown>),
    };
    for (const key of Object.keys(override)) {
      const baseVal = (base as Record<string, unknown>)[key];
      const overrideVal = (override as Record<string, unknown>)[key];
      if (overrideVal === undefined) continue;
      result[key] =
        isPlainObject(baseVal) && isPlainObject(overrideVal)
          ? deepMergeConfig(baseVal, overrideVal)
          : overrideVal;
    }
    return result as T;
  }
  return override;
}

function migrateSocial(social: unknown): SocialLink[] {
  // New format — already an array
  if (Array.isArray(social)) return social;

  // Old format — { github?: string, email?: string }
  if (social && typeof social === "object") {
    const old = social as { github?: string; email?: string };
    const migrated: SocialLink[] = [];
    if (old.github) migrated.push({ platform: "github", url: old.github });
    if (old.email)
      migrated.push({ platform: "email", url: `mailto:${old.email}` });
    return migrated;
  }

  // Fallback to blogConfig defaults
  return [...blogConfig.social];
}

export function resolveSiteConfig(
  config: SystemConfig | null | undefined,
): SiteConfig {
  const configDefaultBackground = config?.site?.theme?.default?.background;

  return FullSiteConfigSchema.parse({
    title: config?.site?.title ?? blogConfig.title,
    author: config?.site?.author ?? blogConfig.author,
    description: config?.site?.description ?? blogConfig.description,
    cardKeyPurchaseUrl:
      config?.site?.cardKeyPurchaseUrl ?? blogConfig.cardKeyPurchaseUrl,
    social: migrateSocial(config?.site?.social),
    icons: {
      faviconSvg:
        config?.site?.icons?.faviconSvg || blogConfig.icons.faviconSvg,
      faviconIco:
        config?.site?.icons?.faviconIco || blogConfig.icons.faviconIco,
      favicon96: config?.site?.icons?.favicon96 || blogConfig.icons.favicon96,
      appleTouchIcon:
        config?.site?.icons?.appleTouchIcon || blogConfig.icons.appleTouchIcon,
      webApp192: config?.site?.icons?.webApp192 || blogConfig.icons.webApp192,
      webApp512: config?.site?.icons?.webApp512 || blogConfig.icons.webApp512,
    },
    theme: {
      default: {
        navBarName:
          config?.site?.theme?.default?.navBarName ??
          blogConfig.theme.default.navBarName,
        background: configDefaultBackground
          ? {
              homeImage: configDefaultBackground.homeImage ?? "",
              globalImage: configDefaultBackground.globalImage ?? "",
              light: {
                opacity: configDefaultBackground.light?.opacity ?? 0.15,
              },
              dark: {
                opacity: configDefaultBackground.dark?.opacity ?? 0.1,
              },
              backdropBlur: configDefaultBackground.backdropBlur ?? 8,
              transitionDuration:
                configDefaultBackground.transitionDuration ?? 600,
            }
          : undefined,
      },
      fuwari: {
        homeBg:
          config?.site?.theme?.fuwari?.homeBg ?? blogConfig.theme.fuwari.homeBg,
        avatar:
          config?.site?.theme?.fuwari?.avatar ?? blogConfig.theme.fuwari.avatar,
        primaryHue:
          config?.site?.theme?.fuwari?.primaryHue ??
          blogConfig.theme.fuwari.primaryHue,
      },
      mytheme: {
        homeBg:
          config?.site?.theme?.mytheme?.homeBg ??
          blogConfig.theme.mytheme.homeBg,
        avatar:
          config?.site?.theme?.mytheme?.avatar ??
          blogConfig.theme.mytheme.avatar,
        primaryHue:
          config?.site?.theme?.mytheme?.primaryHue ??
          blogConfig.theme.mytheme.primaryHue,
        recentPostsLimit:
          config?.site?.theme?.mytheme?.recentPostsLimit ??
          blogConfig.theme.mytheme.recentPostsLimit,
        homeCategoryStyle:
          config?.site?.theme?.mytheme?.homeCategoryStyle ??
          blogConfig.theme.mytheme.homeCategoryStyle,
        homeCategoryTabs: (
          config?.site?.theme?.mytheme?.homeCategoryTabs ?? []
        ).map((t) => ({
          categoryId: t.categoryId,
          label: t.label,
          postLimit: t.postLimit ?? 24,
        })),
        floatingToolbar:
          config?.site?.theme?.mytheme?.floatingToolbar ??
          blogConfig.theme.mytheme.floatingToolbar,
        copyrightNotice:
          config?.site?.theme?.mytheme?.copyrightNotice ??
          blogConfig.theme.mytheme.copyrightNotice,
      },
    },
  });
}

function hasSiteConfigChanged(
  currentConfig: SystemConfig | null | undefined,
  nextConfig: SystemConfig | null | undefined,
) {
  return (
    JSON.stringify(resolveSiteConfig(currentConfig)) !==
    JSON.stringify(resolveSiteConfig(nextConfig))
  );
}

export async function getSystemConfig(
  context: DbContext & { executionCtx: ExecutionContext },
) {
  const config = await CacheService.get(
    context,
    CONFIG_CACHE_KEYS.system,
    SystemConfigSchema,
    async () =>
      resolveSystemConfig(await ConfigRepo.getSystemConfig(context.db)),
    { ttl: "7d" },
  );

  const normalizedConfig = resolveSystemConfig(config);

  if (JSON.stringify(config) !== JSON.stringify(normalizedConfig)) {
    context.executionCtx.waitUntil(
      CacheService.set(
        context,
        CONFIG_CACHE_KEYS.system,
        JSON.stringify(normalizedConfig),
        { ttl: "7d" },
      ),
    );
  }

  return normalizedConfig;
}

export async function getSiteConfig(
  context: DbContext & { executionCtx: ExecutionContext },
) {
  const config = await getSystemConfig(context);
  return resolveSiteConfig(config);
}

export async function updateSystemConfig(
  context: DbContext & { executionCtx: ExecutionContext },
  data: SystemConfig,
) {
  const currentConfig = await ConfigRepo.getSystemConfig(context.db);
  // 与数据库现有配置深度合并：只覆盖 data 中提供的字段，保留其余字段（如 navMenu）。
  const mergedConfig = currentConfig
    ? deepMergeConfig(currentConfig, data)
    : data;
  const nextConfig = resolveSystemConfig(mergedConfig);

  await ConfigRepo.upsertSystemConfig(context.db, nextConfig);
  await CacheService.deleteKey(context, CONFIG_CACHE_KEYS.system);

  if (hasSiteConfigChanged(currentConfig, nextConfig)) {
    await purgeSiteCDNCache(context.env);
  }

  return { success: true };
}

export async function updatePointsConfig(
  context: DbContext & { executionCtx: ExecutionContext },
  input: {
    pointsName: string;
    creditsName: string;
    pointsPerYuan?: number;
    paymentEnabled?: boolean;
  },
) {
  const current = await ConfigRepo.getSystemConfig(context.db);
  const resolved = resolveSystemConfig(current);
  const next: SystemConfig = {
    ...resolved,
    points: {
      pointsName: input.pointsName?.trim() || DEFAULT_CONFIG.points!.pointsName,
      creditsName:
        input.creditsName?.trim() || DEFAULT_CONFIG.points!.creditsName,
      pointsPerYuan:
        input.pointsPerYuan && input.pointsPerYuan > 0
          ? Math.floor(input.pointsPerYuan)
          : resolved.points!.pointsPerYuan,
      paymentEnabled: input.paymentEnabled ?? resolved.points!.paymentEnabled,
    },
  };
  await ConfigRepo.upsertSystemConfig(context.db, next);
  await CacheService.deleteKey(context, CONFIG_CACHE_KEYS.system);
  return { success: true };
}

export async function uploadSiteAsset(
  context: { env: Env },
  input: { file: File; assetPath: string },
): Promise<{ url: string }> {
  const { url } = await Storage.putSiteAsset(
    context.env,
    input.file,
    input.assetPath,
  );

  const timestamp = Math.floor(Date.now() / 1000);
  const isFavicon = input.assetPath.startsWith("favicon/");
  const finalUrl = isFavicon
    ? `${url}?original=true&v=${timestamp}`
    : `${url}?v=${timestamp}`;

  return { url: finalUrl };
}
