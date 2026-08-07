import { ClientOnly, Link, useRouteContext } from "@tanstack/react-router";
import {
  resolveSocialHref,
  SOCIAL_PLATFORMS,
  type SocialLink,
} from "@/features/config/utils/social-platforms";
import type { NavOption } from "@/features/theme/contract/layouts";
import { m } from "@/paraglide/messages";

interface FooterProps {
  navOptions: Array<NavOption>;
}

export function Footer({ navOptions }: FooterProps) {
  const { siteConfig } = useRouteContext({ from: "__root__" });

  return (
    <footer className="border-t border-border/40 bg-background/50 py-16 mt-32">
      <div className="max-w-3xl mx-auto px-6 md:px-0 flex flex-col md:flex-row justify-between items-center gap-8">
        {/* Brand / Copyright */}
        <div className="flex flex-col items-center md:items-start gap-2">
          <span className="font-serif text-lg font-bold tracking-tighter text-foreground">
            [ {siteConfig.theme.default.navBarName} ]
          </span>
          <span className="font-mono text-[10px] text-muted-foreground tracking-widest uppercase">
            <ClientOnly fallback="-">
              {m.footer_copyright({
                year: new Date().getFullYear().toString(),
                author: siteConfig.author,
              })}
            </ClientOnly>
          </span>
        </div>

        {/* Minimalist Links */}
        <nav className="flex items-center gap-8 text-[11px] font-medium uppercase tracking-widest text-muted-foreground/60">
          {navOptions.flatMap((option) => {
            const self = option.external && option.href ? (
              <a
                key={option.id}
                href={option.href}
                target="_blank"
                rel="noreferrer"
                className="hover:text-foreground transition-colors"
              >
                {option.label}
              </a>
            ) : (
              <Link
                key={option.id}
                to={option.to ?? "/"}
                search={option.search}
                className="hover:text-foreground transition-colors"
              >
                {option.label}
              </Link>
            );
            const kids = (option.children ?? []).map((child) =>
              child.external && child.href ? (
                <a
                  key={child.id}
                  href={child.href}
                  target="_blank"
                  rel="noreferrer"
                  className="hover:text-foreground transition-colors"
                >
                  {child.label}
                </a>
              ) : (
                <Link
                  key={child.id}
                  to={child.to ?? "/"}
                  search={child.search}
                  className="hover:text-foreground transition-colors"
                >
                  {child.label}
                </Link>
              ),
            );
            return [self, ...kids];
          })}
          {siteConfig.social
            .filter((link: SocialLink) => link.url)
            .map((link: SocialLink, i: number) => {
              const href = resolveSocialHref(link.platform, link.url);
              const label =
                link.platform !== "custom"
                  ? SOCIAL_PLATFORMS[link.platform].label
                  : (link.label ?? "");
              return (
                <a
                  key={`${link.platform}-${i}`}
                  href={href}
                  target={link.platform === "email" ? undefined : "_blank"}
                  rel={link.platform === "email" ? undefined : "noreferrer"}
                  className="hover:text-foreground transition-colors"
                >
                  {label}
                </a>
              );
            })}
        </nav>
      </div>
    </footer>
  );
}
