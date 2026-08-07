import type { CSSProperties } from "react";
import type { SiteConfig } from "@/features/config/site-config.schema";

export function getMythemeThemeStyle(siteConfig: SiteConfig): CSSProperties {
  return {
    "--fuwari-hue": String(siteConfig.theme.mytheme.primaryHue),
  } as CSSProperties;
}
