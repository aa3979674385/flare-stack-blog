import { Link, useRouteContext } from "@tanstack/react-router";
import {
  resolveSocialHref,
  SOCIAL_PLATFORMS,
  type SocialLink,
} from "@/features/config/utils/social-platforms";

export function Footer() {
  const { siteConfig } = useRouteContext({ from: "__root__" });
  const siteName = siteConfig.title?.trim() || siteConfig.author || "站点";
  const socials = siteConfig.social ?? [];

  const topLinks = [
    { label: "友链申请", to: "/friend-links" },
    { label: "广告合作", to: "#" },
    { label: "版权声明", to: "#" },
    { label: "联系我们", to: "#" },
  ];

  return (
    <footer className="relative mt-20 border-t border-border/60 bg-(--fuwari-footer-bg)">
      <div className="mx-auto grid max-w-6xl grid-cols-1 gap-8 px-6 py-14 md:grid-cols-[200px_1fr_120px] md:gap-10">
        {/* 左侧：品牌区（窄/短） */}
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-(--fuwari-primary) text-base font-bold text-white shadow-sm">
              {siteName.slice(0, 1)}
            </div>
            <span className="text-base font-bold tracking-tight">{siteName}</span>
          </div>
          <p className="text-sm leading-relaxed text-muted-foreground">
            {siteConfig.description?.trim() ||
              "分享技术与生活的个人博客，记录我的折腾、思考与值得收藏的资源。"}
          </p>
        </div>

        {/* 中间：链接 + 版权说明 + 社交（抻开） */}
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground">
            {topLinks.map((link, index) => (
              <span key={link.label} className="flex items-center gap-2">
                {link.to === "#" ? (
                  <span className="cursor-default">{link.label}</span>
                ) : (
                  <Link
                    to={link.to}
                    className="transition-colors hover:text-(--fuwari-primary)"
                  >
                    {link.label}
                  </Link>
                )}
                {index < topLinks.length - 1 && (
                  <span className="opacity-40">·</span>
                )}
              </span>
            ))}
          </div>
          <p className="text-sm leading-relaxed text-muted-foreground">
            创作实属不易，若条件允许，建议前往正版渠道支持原创开发者，本站始终坚定维护原创版权。同时也欢迎各位玩家加入QQ交流群，一起交流资源、分享心得。
          </p>
          <div className="flex flex-wrap gap-2">
            {socials
              .filter((link: SocialLink) => link.url)
              .map((link: SocialLink, i: number) => {
                const href = resolveSocialHref(link.platform, link.url);
                const label =
                  link.platform !== "custom"
                    ? SOCIAL_PLATFORMS[link.platform].label
                    : (link.label ?? "链接");
                const Icon =
                  link.platform !== "custom"
                    ? SOCIAL_PLATFORMS[link.platform].icon
                    : null;
                return (
                  <a
                    key={`${link.platform}-${i}`}
                    href={href}
                    target={link.platform === "email" ? undefined : "_blank"}
                    rel={link.platform === "email" ? undefined : "noreferrer"}
                    aria-label={label}
                    className="flex h-9 w-9 items-center justify-center rounded-xl border border-border/60 text-muted-foreground transition-all hover:-translate-y-0.5 hover:border-(--fuwari-primary) hover:bg-(--fuwari-primary) hover:text-white"
                  >
                    {Icon ? (
                      <Icon size={18} />
                    ) : link.icon ? (
                      <img src={link.icon} alt={label} className="h-4 w-4 rounded-sm" />
                    ) : null}
                  </a>
                );
              })}
          </div>
        </div>

        {/* 右侧：二维码展示区 */}
        <div className="flex flex-col items-center gap-2 text-center">
          <div className="overflow-hidden rounded-xl border border-border/40 bg-background p-1 shadow-sm">
            <img
              src="/images/qq-group-qr.svg"
              alt="QQ群二维码"
              className="h-24 w-24 object-contain"
            />
          </div>
          <span className="text-sm text-muted-foreground">扫码加QQ群</span>
        </div>
      </div>
    </footer>
  );
}
