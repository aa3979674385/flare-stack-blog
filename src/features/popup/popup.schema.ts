import { z } from "zod";

/* ============ 仿子比主题「弹窗通知」配置项 ============ */

/** 标题显示样式：默认样式 / 炫彩背景（对应子比 system_notice_title_style） */
export const POPUP_TITLE_STYLES = ["default", "colorful"] as const;
export type PopupTitleStyle = (typeof POPUP_TITLE_STYLES)[number];
export const POPUP_TITLE_STYLE_LABELS: Record<PopupTitleStyle, string> = {
  default: "默认样式",
  colorful: "炫彩背景",
};

/** 窗口尺寸：mini / 小 / 中 / 大（对应子比 system_notice_size） */
export const POPUP_SIZES = ["mini", "sm", "md", "lg"] as const;
export type PopupSize = (typeof POPUP_SIZES)[number];
export const POPUP_SIZE_LABELS: Record<PopupSize, string> = {
  mini: "mini",
  sm: "小",
  md: "中",
  lg: "大",
};
/** 各尺寸最大宽度（px），mini 接近子比 modal-sm，md 为默认中等 */
export const POPUP_SIZE_WIDTH: Record<PopupSize, number> = {
  mini: 320,
  sm: 420,
  md: 560,
  lg: 760,
};

/** 显示策略（对应子比 system_notice_policy） */
export const POPUP_POLICIES = [
  "always",
  "signin",
  "member",
] as const;
export type PopupPolicy = (typeof POPUP_POLICIES)[number];
export const POPUP_POLICY_LABELS: Record<PopupPolicy, string> = {
  always: "一直显示",
  signin: "登录后不显示",
  member: "会员不显示",
};

/** 炫彩标题背景主题（对应子比 jb-* 调色板，取常用几色） */
export const POPUP_HEADER_CLASSES = [
  "jb-yellow",
  "jb-blue",
  "jb-green",
  "jb-red",
  "jb-purple",
  "jb-pink",
  "jb-cyan",
] as const;
export type PopupHeaderClass = (typeof POPUP_HEADER_CLASSES)[number];
export const POPUP_HEADER_CLASS_LABELS: Record<PopupHeaderClass, string> = {
  "jb-yellow": "橙黄",
  "jb-blue": "蓝",
  "jb-green": "绿",
  "jb-red": "红",
  "jb-purple": "紫",
  "jb-pink": "粉",
  "jb-cyan": "青",
};
/** 子比 jb-* 真实渐变（来源 css/main.css） */
export const POPUP_HEADER_GRADIENT: Record<PopupHeaderClass, string> = {
  "jb-yellow": "linear-gradient(135deg, #f59f54 10%, #ff6922 100%)",
  "jb-blue": "linear-gradient(135deg, #59c3fb 10%, #268df7 100%)",
  "jb-green": "linear-gradient(135deg, #60e464 10%, #5cb85b 100%)",
  "jb-red": "linear-gradient(135deg, #fd7a64 10%, #fb2d2d 100%)",
  "jb-purple": "linear-gradient(135deg, #f98dfb 10%, #ea00f9 100%)",
  "jb-pink": "linear-gradient(135deg, #ff5e7f 30%, #ff967e 100%)",
  "jb-cyan": "linear-gradient(140deg, #039ab3 10%, #58dbcf 90%)",
};

/** 按钮颜色（对应子比 c-* 文字色，来源 css/main.css） */
export const POPUP_BUTTON_COLORS = [
  "c-blue",
  "c-green",
  "c-yellow",
  "c-red",
  "c-purple",
  "c-cyan",
] as const;
export type PopupButtonColor = (typeof POPUP_BUTTON_COLORS)[number];
export const POPUP_BUTTON_COLOR_LABELS: Record<PopupButtonColor, string> = {
  "c-blue": "蓝",
  "c-green": "绿",
  "c-yellow": "橙",
  "c-red": "红",
  "c-purple": "紫",
  "c-cyan": "青",
};
export const POPUP_BUTTON_COLOR_TEXT: Record<PopupButtonColor, string> = {
  "c-blue": "#2997f7",
  "c-green": "#18a52a",
  "c-yellow": "#ff6f06",
  "c-red": "#ff5473",
  "c-purple": "#e434e1",
  "c-cyan": "#09a4a1",
};

/** 按钮实心背景色（用于截图中的彩色实心按钮风格） */
export const POPUP_BUTTON_COLOR_BG: Record<PopupButtonColor, string> = {
  "c-blue": "#2997f7",
  "c-green": "#22c55e",
  "c-yellow": "#f97316",
  "c-red": "#f43f5e",
  "c-purple": "#d946ef",
  "c-cyan": "#14b8a6",
};

/** 按钮 hover 时的背景色 */
export const POPUP_BUTTON_COLOR_HOVER: Record<PopupButtonColor, string> = {
  "c-blue": "#1d7aed",
  "c-green": "#16a34a",
  "c-yellow": "#ea580c",
  "c-red": "#e11d48",
  "c-purple": "#c026d3",
  "c-cyan": "#0d9488",
};

/** 单个弹窗按钮（对应子比 system_notice_button 组内一项，最多 4 个） */
export const PopupButtonSchema = z.object({
  text: z.string().default(""),
  link: z.string().default(""),
  color: z.enum(POPUP_BUTTON_COLORS).default("c-green"),
});
export type PopupButton = z.infer<typeof PopupButtonSchema>;

export const PopupConfigSchema = z.object({
  /** 总开关（对应 system_notice_s） */
  enabled: z.boolean().default(false),
  /** 显示策略（对应 system_notice_policy） */
  policy: z.enum(POPUP_POLICIES).default("always"),
  /** 窗口尺寸（对应 system_notice_size） */
  size: z.enum(POPUP_SIZES).default("sm"),
  /** 自定义宽度(px)：>0 时覆盖「窗口尺寸」，0 = 按窗口尺寸预设 */
  width: z.number().int().min(0).max(1200).default(0),
  /** 标题显示样式（对应 system_notice_title_style） */
  titleStyle: z.enum(POPUP_TITLE_STYLES).default("colorful"),
  /** 标题文字（对应 system_notice_title） */
  title: z.string().default(""),
  /** 标题图标（lucide 图标名，对应 system_notice_title_icon，默认 heart） */
  titleIcon: z.string().default("heart"),
  /** 炫彩标题背景主题（对应 system_notice_title_class，默认 jb-yellow） */
  headerClass: z.enum(POPUP_HEADER_CLASSES).default("jb-yellow"),
  /** 正文，支持 HTML（对应 system_notice_content） */
  content: z.string().default(""),
  /** 按钮组，最多 4 个（对应 system_notice_button） */
  buttons: z.array(PopupButtonSchema).max(4).default([]),
  /** 按钮圆角（对应 system_notice_radius） */
  buttonRadius: z.boolean().default(false),
  /** 页面加载后延迟多少毫秒弹出（子比固定 ~500ms，这里可配） */
  delayMs: z.number().int().min(0).max(60000).default(500),
  /** 弹窗周期（小时，对应 system_notice_expires，0 = 每次刷新都弹） */
  expiresHours: z.number().min(0).max(2000).default(24),
  /** 是否显示关闭按钮（始终显示于炫彩头部，这里保留兼容） */
  showClose: z.boolean().default(true),
  /** 点击遮罩是否关闭 */
  maskCloseable: z.boolean().default(true),
});

export type PopupConfig = z.infer<typeof PopupConfigSchema>;

export const DEFAULT_POPUP_CONFIG: PopupConfig = {
  enabled: false,
  policy: "always",
  size: "sm",
  width: 0,
  titleStyle: "colorful",
  title: "",
  titleIcon: "heart",
  headerClass: "jb-yellow",
  content: "",
  buttons: [],
  buttonRadius: false,
  delayMs: 500,
  expiresHours: 24,
  showClose: true,
  maskCloseable: true,
};

/** KV 缓存 key（弹窗配置，短 TTL 即可，保存时主动失效） */
export const POPUP_CACHE_KEYS = {
  config: ["popup", "config"] as const,
};
