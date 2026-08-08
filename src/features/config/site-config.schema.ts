import { z } from "zod";
import type { Messages } from "@/lib/i18n";
import { SOCIAL_PLATFORM_KEYS } from "./utils/social-platforms";

export const SocialLinkSchema = z.object({
  platform: z.enum(SOCIAL_PLATFORM_KEYS),
  url: z.string(),
  icon: z.string().optional(),
  label: z.string().optional(),
});

export const DEFAULT_THEME_OPACITY_MIN = 0;
export const DEFAULT_THEME_OPACITY_MAX = 0.4;
export const DEFAULT_THEME_BLUR_MIN = 0;
export const DEFAULT_THEME_BLUR_MAX = 32;
export const DEFAULT_THEME_TRANSITION_MIN = 0;
export const DEFAULT_THEME_TRANSITION_MAX = 1500;
export const FUWARI_THEME_HUE_MIN = 0;
export const FUWARI_THEME_HUE_MAX = 360;

function createSiteTextSchema(max: number) {
  return z.string().trim().max(max);
}

function createSiteTextFormSchema(max: number, messages: Messages) {
  return z
    .string()
    .trim()
    .max(max, messages.settings_site_validation_too_long({ max }));
}

function createAssetRefSchema() {
  return z.string().refine((value) => value === "" || value.startsWith("/"), {
    message: "Please enter a root-relative path",
  });
}

function createAssetRefFormSchema(messages: Messages) {
  return z.string().refine((value) => value === "" || value.startsWith("/"), {
    message: messages.settings_site_validation_invalid_asset_ref(),
  });
}

function isExternalImageUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function createBackgroundImageRefSchema() {
  return z
    .string()
    .trim()
    .refine(
      (value) =>
        value === "" || value.startsWith("/") || isExternalImageUrl(value),
      {
        message: "Please enter a root-relative path or http(s) URL",
      },
    );
}

function createBackgroundImageRefFormSchema(messages: Messages) {
  return z
    .string()
    .trim()
    .refine(
      (value) =>
        value === "" || value.startsWith("/") || isExternalImageUrl(value),
      {
        message:
          messages.settings_site_validation_invalid_background_image_ref(),
      },
    );
}

function createAssetPathSchema() {
  return z.string().refine((value) => value.startsWith("/"), {
    message: "Please enter a root-relative path",
  });
}

function createAssetPathFormSchema(messages: Messages) {
  return z.string().refine((value) => value.startsWith("/"), {
    message: messages.settings_site_validation_invalid_asset_path(),
  });
}

function createOptionalAssetPathSchema() {
  return z.union([createAssetPathSchema(), z.literal("")]);
}

function createOptionalAssetPathFormSchema(messages: Messages) {
  return z.union([createAssetPathFormSchema(messages), z.literal("")]);
}

function createOpacitySchema() {
  return z
    .number()
    .min(DEFAULT_THEME_OPACITY_MIN)
    .max(DEFAULT_THEME_OPACITY_MAX, {
      message: `Value must be between ${DEFAULT_THEME_OPACITY_MIN} and ${DEFAULT_THEME_OPACITY_MAX}`,
    });
}

function createOpacityFormSchema(messages: Messages) {
  return z
    .number()
    .min(DEFAULT_THEME_OPACITY_MIN)
    .max(DEFAULT_THEME_OPACITY_MAX, {
      message: messages.settings_site_validation_opacity_range(),
    });
}

function createBlurSchema() {
  return z
    .number()
    .int()
    .min(DEFAULT_THEME_BLUR_MIN)
    .max(DEFAULT_THEME_BLUR_MAX, {
      message: `Value must be between ${DEFAULT_THEME_BLUR_MIN} and ${DEFAULT_THEME_BLUR_MAX}`,
    });
}

function createBlurFormSchema(messages: Messages) {
  return z
    .number()
    .int()
    .min(DEFAULT_THEME_BLUR_MIN)
    .max(DEFAULT_THEME_BLUR_MAX, {
      message: messages.settings_site_validation_blur_range(),
    });
}

function createTransitionDurationSchema() {
  return z
    .number()
    .int()
    .min(DEFAULT_THEME_TRANSITION_MIN)
    .max(DEFAULT_THEME_TRANSITION_MAX, {
      message: `Value must be between ${DEFAULT_THEME_TRANSITION_MIN} and ${DEFAULT_THEME_TRANSITION_MAX}`,
    });
}

function createTransitionDurationFormSchema(messages: Messages) {
  return z
    .number()
    .int()
    .min(DEFAULT_THEME_TRANSITION_MIN)
    .max(DEFAULT_THEME_TRANSITION_MAX, {
      message: messages.settings_site_validation_transition_range(),
    });
}

function createHueSchema() {
  return z
    .number()
    .int()
    .min(FUWARI_THEME_HUE_MIN)
    .max(FUWARI_THEME_HUE_MAX, {
      message: `Value must be between ${FUWARI_THEME_HUE_MIN} and ${FUWARI_THEME_HUE_MAX}`,
    });
}

function createHueFormSchema(messages: Messages) {
  return z.number().int().min(FUWARI_THEME_HUE_MIN).max(FUWARI_THEME_HUE_MAX, {
    message: messages.settings_site_validation_hue_range(),
  });
}

function createDefaultThemeBackgroundSchema() {
  return z.object({
    homeImage: createBackgroundImageRefSchema(),
    globalImage: createBackgroundImageRefSchema(),
    light: z.object({
      opacity: createOpacitySchema(),
    }),
    dark: z.object({
      opacity: createOpacitySchema(),
    }),
    backdropBlur: createBlurSchema(),
    transitionDuration: createTransitionDurationSchema(),
  });
}

function createDefaultThemeBackgroundInputSchema() {
  return z.object({
    homeImage: createBackgroundImageRefSchema().optional(),
    globalImage: createBackgroundImageRefSchema().optional(),
    light: z
      .object({
        opacity: createOpacitySchema().optional(),
      })
      .optional(),
    dark: z
      .object({
        opacity: createOpacitySchema().optional(),
      })
      .optional(),
    backdropBlur: createBlurSchema().optional(),
    transitionDuration: createTransitionDurationSchema().optional(),
  });
}

function createDefaultThemeBackgroundInputFormSchema(messages: Messages) {
  return z.object({
    homeImage: createBackgroundImageRefFormSchema(messages).optional(),
    globalImage: createBackgroundImageRefFormSchema(messages).optional(),
    light: z
      .object({
        opacity: createOpacityFormSchema(messages).optional(),
      })
      .optional(),
    dark: z
      .object({
        opacity: createOpacityFormSchema(messages).optional(),
      })
      .optional(),
    backdropBlur: createBlurFormSchema(messages).optional(),
    transitionDuration: createTransitionDurationFormSchema(messages).optional(),
  });
}

function createDefaultThemeSiteConfigSchema() {
  return z.object({
    navBarName: createSiteTextSchema(60),
    background: createDefaultThemeBackgroundSchema().optional(),
  });
}

function createDefaultThemeSiteConfigInputSchema() {
  return z.object({
    navBarName: createSiteTextSchema(60).optional(),
    background: createDefaultThemeBackgroundInputSchema().optional(),
  });
}

function createDefaultThemeSiteConfigInputFormSchema(messages: Messages) {
  return z.object({
    navBarName: createSiteTextFormSchema(60, messages).optional(),
    background:
      createDefaultThemeBackgroundInputFormSchema(messages).optional(),
  });
}

function createFuwariThemeSiteConfigSchema() {
  return z.object({
    homeBg: createBackgroundImageRefSchema(),
    avatar: createAssetRefSchema(),
    primaryHue: createHueSchema(),
    footerBgLight: z.string().default("#f6f6fb"),
    footerBgDark: z.string().default("rgba(255, 255, 255, 0.04)"),
  });
}

function createFuwariThemeSiteConfigInputSchema() {
  return z.object({
    homeBg: createBackgroundImageRefSchema().optional(),
    avatar: createAssetRefSchema().optional(),
    primaryHue: createHueSchema().optional(),
    footerBgLight: z.string().optional(),
    footerBgDark: z.string().optional(),
  });
}

function createFuwariThemeSiteConfigInputFormSchema(messages: Messages) {
  return z.object({
    homeBg: createBackgroundImageRefFormSchema(messages).optional(),
    avatar: createAssetRefFormSchema(messages).optional(),
    primaryHue: createHueFormSchema(messages).optional(),
    footerBgLight: z.string().optional(),
    footerBgDark: z.string().optional(),
  });
}

function createMythemeHomeCategoryTabSchema() {
  return z.object({
    categoryId: z.number().int().positive(),
    label: createSiteTextSchema(30).optional(),
    postLimit: z.number().int().min(1).max(100),
  });
}

function createMythemeHomeCategoryTabInputSchema() {
  return z.object({
    categoryId: z.number().int().positive().optional(),
    label: createSiteTextSchema(30).optional(),
    postLimit: z.number().int().min(1).max(100).optional(),
  });
}

function createMythemeHomeCategoryTabInputFormSchema(messages: Messages) {
  return z.object({
    categoryId: z.number().int().positive().optional(),
    label: createSiteTextFormSchema(30, messages).optional(),
    postLimit: z.number().int().min(1).max(100).optional(),
  });
}

function createFloatingToolbarButtonSchema() {
  return z.object({
    id: z.string(),
    name: createSiteTextSchema(30),
    type: z.enum(["qq", "qqmail", "qqgroup", "wechat", "link", "image"]),
    icon: z.string().optional(),
    value: z.string().optional(),
    enabled: z.boolean().default(true),
    order: z.number().int().default(0),
  });
}

function createFloatingToolbarButtonInputSchema() {
  return z.object({
    id: z.string().optional(),
    name: createSiteTextSchema(30).optional(),
    type: z
      .enum(["qq", "qqmail", "qqgroup", "wechat", "link", "image"])
      .optional(),
    icon: z.string().optional(),
    value: z.string().optional(),
    enabled: z.boolean().optional(),
    order: z.number().int().optional(),
  });
}

function createFloatingToolbarButtonInputFormSchema(messages: Messages) {
  return z.object({
    id: z.string().optional(),
    name: createSiteTextFormSchema(30, messages).optional(),
    type: z
      .enum(["qq", "qqmail", "qqgroup", "wechat", "link", "image"])
      .optional(),
    icon: z.string().optional(),
    value: z.string().optional(),
    enabled: z.boolean().optional(),
    order: z.number().int().optional(),
  });
}

function createFloatingToolbarSchema() {
  return z.object({
    enabled: z.boolean(),
    showThemeToggle: z.boolean(),
    showBackToTop: z.boolean(),
    showOnMobile: z.boolean().default(true),
    fixedMode: z.enum(["fixed", "scroll"]),
    buttons: z.array(createFloatingToolbarButtonSchema()),
  });
}

function createFloatingToolbarInputSchema() {
  return z.object({
    enabled: z.boolean().optional(),
    showThemeToggle: z.boolean().optional(),
    showBackToTop: z.boolean().optional(),
    showOnMobile: z.boolean().optional(),
    fixedMode: z.enum(["fixed", "scroll"]).optional(),
    buttons: z.array(createFloatingToolbarButtonInputSchema()).optional(),
  });
}

function createFloatingToolbarInputFormSchema(messages: Messages) {
  return z.object({
    enabled: z.boolean().optional(),
    showThemeToggle: z.boolean().optional(),
    showBackToTop: z.boolean().optional(),
    showOnMobile: z.boolean().optional(),
    fixedMode: z.enum(["fixed", "scroll"]).optional(),
    buttons: z
      .array(createFloatingToolbarButtonInputFormSchema(messages))
      .optional(),
  });
}

function createMythemeThemeSiteConfigSchema() {
  return z.object({
    homeBg: createBackgroundImageRefSchema(),
    avatar: createAssetRefSchema(),
    primaryHue: createHueSchema(),
    footerBgLight: z.string().default("#f6f6fb"),
    footerBgDark: z.string().default("rgba(255, 255, 255, 0.04)"),
    recentPostsLimit: z.number().int().min(1).max(100),
    homeCategoryStyle: z.enum(["tabs", "stacked"]),
    homeCategoryTabs: z.array(createMythemeHomeCategoryTabSchema()),
    floatingToolbar: createFloatingToolbarSchema(),
    copyrightNotice: z.string().default(""),
  });
}

function createMythemeThemeSiteConfigInputSchema() {
  return z.object({
    homeBg: createBackgroundImageRefSchema().optional(),
    avatar: createAssetRefSchema().optional(),
    primaryHue: createHueSchema().optional(),
    footerBgLight: z.string().optional(),
    footerBgDark: z.string().optional(),
    recentPostsLimit: z.number().int().min(1).max(100).optional(),
    homeCategoryStyle: z.enum(["tabs", "stacked"]).optional(),
    homeCategoryTabs: z
      .array(createMythemeHomeCategoryTabInputSchema())
      .optional(),
    floatingToolbar: createFloatingToolbarInputSchema().optional(),
    copyrightNotice: z.string().optional(),
  });
}

function createMythemeThemeSiteConfigInputFormSchema(messages: Messages) {
  return z.object({
    homeBg: createBackgroundImageRefFormSchema(messages).optional(),
    avatar: createAssetRefFormSchema(messages).optional(),
    primaryHue: createHueFormSchema(messages).optional(),
    footerBgLight: z.string().optional(),
    footerBgDark: z.string().optional(),
    recentPostsLimit: z.number().int().min(1).max(100).optional(),
    homeCategoryStyle: z.enum(["tabs", "stacked"]).optional(),
    homeCategoryTabs: z
      .array(createMythemeHomeCategoryTabInputFormSchema(messages))
      .optional(),
    floatingToolbar: createFloatingToolbarInputFormSchema(messages).optional(),
    copyrightNotice: z.string().optional(),
  });
}

export const defaultThemeBackgroundSchema =
  createDefaultThemeBackgroundSchema();
export const defaultThemeBackgroundInputSchema =
  createDefaultThemeBackgroundInputSchema();
export const defaultThemeSiteConfigSchema =
  createDefaultThemeSiteConfigSchema();
export const defaultThemeSiteConfigInputSchema =
  createDefaultThemeSiteConfigInputSchema();
export const fuwariThemeSiteConfigSchema = createFuwariThemeSiteConfigSchema();
export const fuwariThemeSiteConfigInputSchema =
  createFuwariThemeSiteConfigInputSchema();
export const mythemeThemeSiteConfigSchema =
  createMythemeThemeSiteConfigSchema();
export const mythemeThemeSiteConfigInputSchema =
  createMythemeThemeSiteConfigInputSchema();

export const FullSiteConfigSchema = z.object({
  title: createSiteTextSchema(120),
  author: createSiteTextSchema(80),
  description: createSiteTextSchema(300),
  // 购买卡密链接：留空则不显示「前往购买卡密」入口（会员中心输入卡密处）
  cardKeyPurchaseUrl: z.string().default(""),
  // 文章 URL 格式：none=无后缀 / html=slug.html / id=id.html
  postUrlSuffix: z.enum(["none", "html", "id"]).default("html"),
  social: z.array(SocialLinkSchema),
  icons: z.object({
    faviconSvg: createAssetPathSchema(),
    faviconIco: createAssetPathSchema(),
    favicon96: createAssetPathSchema(),
    appleTouchIcon: createAssetPathSchema(),
    webApp192: createAssetPathSchema(),
    webApp512: createAssetPathSchema(),
  }),
  theme: z.object({
    default: defaultThemeSiteConfigSchema,
    fuwari: fuwariThemeSiteConfigSchema,
    mytheme: mythemeThemeSiteConfigSchema,
  }),
});

export function createSiteConfigInputFormSchema(messages: Messages) {
  return z.object({
    title: createSiteTextFormSchema(120, messages).optional(),
    author: createSiteTextFormSchema(80, messages).optional(),
    description: createSiteTextFormSchema(300, messages).optional(),
    cardKeyPurchaseUrl: z.string().max(500).optional(),
    postUrlSuffix: z.enum(["none", "html", "id"]).optional(),
    social: z.array(SocialLinkSchema).optional(),
    icons: z
      .object({
        faviconSvg: createOptionalAssetPathFormSchema(messages).optional(),
        faviconIco: createOptionalAssetPathFormSchema(messages).optional(),
        favicon96: createOptionalAssetPathFormSchema(messages).optional(),
        appleTouchIcon: createOptionalAssetPathFormSchema(messages).optional(),
        webApp192: createOptionalAssetPathFormSchema(messages).optional(),
        webApp512: createOptionalAssetPathFormSchema(messages).optional(),
      })
      .optional(),
    theme: z
      .object({
        default:
          createDefaultThemeSiteConfigInputFormSchema(messages).optional(),
        fuwari: createFuwariThemeSiteConfigInputFormSchema(messages).optional(),
        mytheme:
          createMythemeThemeSiteConfigInputFormSchema(messages).optional(),
      })
      .optional(),
  });
}

export const SiteConfigInputSchema = z.object({
  title: createSiteTextSchema(120).optional(),
  author: createSiteTextSchema(80).optional(),
    description: createSiteTextSchema(300).optional(),
    cardKeyPurchaseUrl: z.string().optional(),
    postUrlSuffix: z.enum(["none", "html", "id"]).optional(),
    social: z.array(SocialLinkSchema).optional(),
  icons: z
    .object({
      faviconSvg: createOptionalAssetPathSchema().optional(),
      faviconIco: createOptionalAssetPathSchema().optional(),
      favicon96: createOptionalAssetPathSchema().optional(),
      appleTouchIcon: createOptionalAssetPathSchema().optional(),
      webApp192: createOptionalAssetPathSchema().optional(),
      webApp512: createOptionalAssetPathSchema().optional(),
    })
    .optional(),
  theme: z
    .object({
      default: defaultThemeSiteConfigInputSchema.optional(),
      fuwari: fuwariThemeSiteConfigInputSchema.optional(),
      mytheme: mythemeThemeSiteConfigInputSchema.optional(),
    })
    .optional(),
});

export const SiteConfigSchema = SiteConfigInputSchema;

export type DefaultThemeSiteConfig = z.infer<
  typeof defaultThemeSiteConfigSchema
>;
export type DefaultThemeBackground = z.infer<
  typeof defaultThemeBackgroundSchema
>;
export type DefaultThemeSiteConfigInput = z.infer<
  typeof defaultThemeSiteConfigInputSchema
>;
export type FuwariThemeSiteConfig = z.infer<typeof fuwariThemeSiteConfigSchema>;
export type FuwariThemeSiteConfigInput = z.infer<
  typeof fuwariThemeSiteConfigInputSchema
>;
export type MythemeThemeSiteConfig = z.infer<
  typeof mythemeThemeSiteConfigSchema
>;
export type MythemeThemeSiteConfigInput = z.infer<
  typeof mythemeThemeSiteConfigInputSchema
>;
export type MythemeFloatingToolbarConfig = z.infer<
  ReturnType<typeof createFloatingToolbarSchema>
>;
export type MythemeFloatingToolbarButton = z.infer<
  ReturnType<typeof createFloatingToolbarButtonSchema>
>;
export type SiteConfig = z.infer<typeof FullSiteConfigSchema>;
export type SiteConfigInput = z.infer<typeof SiteConfigInputSchema>;
