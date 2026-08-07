import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useQuery } from "@tanstack/react-query";
import {
  Award,
  Bell,
  Crown,
  Gift,
  Heart,
  Info,
  Mail,
  Megaphone,
  Rocket,
  Send,
  Smile,
  Sparkles,
  Star,
  Tag,
  ThumbsUp,
  X,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { authClient } from "@/lib/auth/auth.client";
import { isUserMember } from "@/features/post-resources/data/post-resources.data";
import { popupConfigQueryOptions } from "../queries";
import {
  POPUP_SIZE_WIDTH,
  POPUP_HEADER_GRADIENT,
  POPUP_BUTTON_COLOR_BG,
  POPUP_BUTTON_COLOR_HOVER,
  type PopupButton,
} from "../popup.schema";

const COOKIE_NAME = "showed_popup_notice";
const COOKIE_ATTR = "path=/; SameSite=Lax";

function getDismissAt(): number | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(
    new RegExp(`(?:^|; )${COOKIE_NAME}=([^;]+)`),
  );
  if (!match) return null;
  // 兼容旧格式「时间戳|版本」，取第一段即可
  const v = Number(match[1].split("|")[0]);
  return Number.isFinite(v) ? v : null;
}

function setDismissed(expiresHours: number) {
  if (typeof document === "undefined") return;
  const maxAge = expiresHours > 0 ? expiresHours * 3600 : 0;
  // 存关闭时刻的时间戳（毫秒），供下次计算周期窗口；
  // Max-Age 同时兜底，让过期 Cookie 自动清理。
  // biome-ignore lint/suspicious/noDocumentCookie: 弹窗关闭状态需持久化到客户端 cookie（函数开头已有 typeof document 守卫）
  document.cookie = `${COOKIE_NAME}=${Date.now()}; Max-Age=${maxAge}; ${COOKIE_ATTR}`;
}

/**
 * 标题图标：支持常用 lucide 图标名（heart/star/gift/bell/info/crown/sparkles/zap/
 * smile/rocket/mail/send/tag/award/megaphone/thumbs-up），未命中回退 Heart。
 * 采用具名 import 映射，避免把整个 lucide 图标库打进公开页。
 */
const ICON_MAP: Record<string, LucideIcon> = {
  heart: Heart,
  star: Star,
  gift: Gift,
  bell: Bell,
  info: Info,
  crown: Crown,
  sparkles: Sparkles,
  zap: Zap,
  smile: Smile,
  rocket: Rocket,
  mail: Mail,
  send: Send,
  tag: Tag,
  award: Award,
  megaphone: Megaphone,
  "thumbs-up": ThumbsUp,
};
function getIcon(name: string): LucideIcon {
  return ICON_MAP[name] ?? Heart;
}

/**
 * 前台弹窗组件（仿子比主题「弹窗通知」）。
 * 卡片底色/文字/边框对接项目自带的明暗模式（bg-background / text-foreground / border-border），
 * 跟随 ThemeProvider 的 light/dark/system 自动切换，不写死白/黑。
 * 炫彩标题头部（titleStyle=colorful）为彩色渐变，强制彩色渲染；按钮为彩色实心圆角按钮。
 */
export function PopupModal() {
  const [mounted, setMounted] = useState(false);
  const [visible, setVisible] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { data: sessionData } = authClient.useSession();
  const { data: config } = useQuery({
    ...popupConfigQueryOptions(),
    enabled: mounted,
  });

  const sessionUser = sessionData?.user;
  const isLoggedIn = !!sessionUser;
  const isMember = isUserMember(sessionUser as never);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!config || !config.enabled) return;

    if (config.policy === "signin" && isLoggedIn) return;
    if (config.policy === "member" && (isLoggedIn && isMember)) return;

    if (config.expiresHours > 0) {
      const dismissedAt = getDismissAt();
      if (
        dismissedAt !== null &&
        Date.now() - dismissedAt < config.expiresHours * 3600000
      ) {
        return;
      }
    }

    const delay = Math.max(0, config.delayMs);
    timerRef.current = setTimeout(() => setVisible(true), delay);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [config, isLoggedIn, isMember]);

  useEffect(() => {
    if (typeof document === "undefined") return;
    if (!visible) return;
    const scrollbarWidth =
      window.innerWidth - document.documentElement.clientWidth;
    const prevOverflow = document.body.style.overflow;
    const prevPaddingRight = document.body.style.paddingRight;
    document.body.style.overflow = "hidden";
    if (scrollbarWidth > 0) {
      document.body.style.paddingRight = `${scrollbarWidth}px`;
    }
    return () => {
      document.body.style.overflow = prevOverflow;
      document.body.style.paddingRight = prevPaddingRight;
    };
  }, [visible]);

  if (!mounted || !visible || !config) return null;

  const close = () => {
    setDismissed(config.expiresHours);
    setVisible(false);
  };

  const onMaskClick = () => {
    if (config.maskCloseable) close();
  };

  const onButtonClick = (btn: PopupButton) => {
    if (btn.link) {
      const isExternal = /^(https?:)?\/\//.test(btn.link);
      if (isExternal) {
        window.open(btn.link, "_blank", "noopener,noreferrer");
      } else {
        window.location.href = btn.link;
      }
    }
    close();
  };

  const Icon = getIcon(config.titleIcon);
  const maxWidth =
    config.width > 0 ? config.width : POPUP_SIZE_WIDTH[config.size];
  const headerGradient = POPUP_HEADER_GRADIENT[config.headerClass];
  const showColorfulHeader = config.titleStyle === "colorful";

  const btnBg = (c: PopupButton["color"]) => POPUP_BUTTON_COLOR_BG[c];
  const btnHover = (c: PopupButton["color"]) => POPUP_BUTTON_COLOR_HOVER[c];

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
    >
      <div
        className="absolute inset-0 bg-black/50 animate-in fade-in duration-300"
        onClick={onMaskClick}
      />
      <div
        className="relative w-full overflow-y-auto rounded-xl bg-background text-foreground shadow-2xl animate-in zoom-in-95 duration-300"
        style={{ maxWidth: `${maxWidth}px`, maxHeight: "90vh" }}
      >
        {/* 炫彩标题头部（子比 modal-colorful-header）：渐变背景 + 图标 + 标题 + 关闭 */}
        {showColorfulHeader ? (
          <div
            className="relative overflow-hidden px-6 py-7 text-center text-white"
            style={{ background: headerGradient }}
          >
            {config.showClose && (
              <button
                type="button"
                onClick={close}
                className="absolute right-3 top-3 z-20 flex h-8 w-8 items-center justify-center rounded-full text-white/90 transition-colors hover:bg-white/20"
                aria-label="关闭"
              >
                <X size={18} />
              </button>
            )}
            <div className="mb-2 flex justify-center">
              <Icon size={34} fill="currentColor" />
            </div>
            {config.title && (
              <h2 className="text-lg font-bold drop-shadow-sm">
                {config.title}
              </h2>
            )}
          </div>
        ) : (
          <div className="flex items-start justify-between border-b border-border px-6 py-4">
            {config.title && (
              <h2 className="text-base font-semibold text-foreground">
                {config.title}
              </h2>
            )}
            {config.showClose && (
              <button
                type="button"
                onClick={close}
                className="ml-4 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                aria-label="关闭"
              >
                <X size={16} />
              </button>
            )}
          </div>
        )}

        {/* 内容区：跟随明暗模式 */}
        <div className="px-6 pb-2 pt-5">
          {config.content && (
            <div
              className="popup-content text-sm leading-relaxed text-foreground/90 [&_a]:text-sky-500 [&_a]:underline"
              dangerouslySetInnerHTML={{ __html: config.content }}
            />
          )}
        </div>

        {/* 按钮区：彩色实心圆角按钮，右对齐 */}
        {config.buttons.length > 0 && (
          <div className="flex flex-wrap items-center justify-end gap-3 px-6 pb-5 pt-3">
            {config.buttons.map((btn, i) => (
              <button
                key={i}
                type="button"
                onClick={() => onButtonClick(btn)}
                className={`${config.buttonRadius ? "rounded-lg" : "rounded-none"} px-5 py-2 text-sm font-medium text-white transition-colors`}
                style={{ backgroundColor: btnBg(btn.color) }}
                onMouseEnter={(e) =>
                  (e.currentTarget.style.backgroundColor = btnHover(btn.color))
                }
                onMouseLeave={(e) =>
                  (e.currentTarget.style.backgroundColor = btnBg(btn.color))
                }
              >
                {btn.text}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}
