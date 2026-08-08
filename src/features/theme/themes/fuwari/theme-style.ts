import type { CSSProperties } from "react";
import type { SiteConfig } from "@/features/config/site-config.schema";

export function getFuwariThemeStyle(siteConfig: SiteConfig): CSSProperties {
  return {
    "--fuwari-hue": String(siteConfig.theme.fuwari.primaryHue),
    "--fuwari-footer-bg-light":
      siteConfig.theme.fuwari.footerBgLight || "#f6f6fb",
    "--fuwari-footer-bg-dark":
      siteConfig.theme.fuwari.footerBgDark || "rgba(255, 255, 255, 0.04)",
  } as CSSProperties;
}
