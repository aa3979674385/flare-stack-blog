import type { CSSProperties } from "react";
import type { SiteConfig } from "@/features/config/site-config.schema";

export function getMythemeThemeStyle(siteConfig: SiteConfig): CSSProperties {
  return {
    "--fuwari-hue": String(siteConfig.theme.mytheme.primaryHue),
    "--fuwari-footer-bg-light":
      siteConfig.theme.mytheme.footerBgLight || "#f6f6fb",
    "--fuwari-footer-bg-dark":
      siteConfig.theme.mytheme.footerBgDark || "rgba(255, 255, 255, 0.04)",
  } as CSSProperties;
}
