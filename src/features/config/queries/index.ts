import { queryOptions, useQuery } from "@tanstack/react-query";
import { getSystemConfigFn } from "../api/config.api";
import { getPointConfigFn } from "../api/config.api";
import { getSiteConfigFn, getSiteDomainFn } from "../api/site.api";

export const CONFIG_KEYS = {
  all: ["config"] as const,

  // Leaf keys (static arrays - no child queries)
  system: ["config", "system"] as const,
  site: ["config", "site"] as const,
  siteDomain: ["config", "siteDomain"] as const,
  points: ["config", "points"] as const,
};

export const systemConfigQuery = queryOptions({
  queryKey: CONFIG_KEYS.system,
  queryFn: () => getSystemConfigFn(),
});

export const siteConfigQuery = queryOptions({
  queryKey: CONFIG_KEYS.site,
  queryFn: () => getSiteConfigFn(),
});

export const siteDomainQuery = queryOptions({
  queryKey: CONFIG_KEYS.siteDomain,
  queryFn: () => getSiteDomainFn(),
});

export const pointConfigQuery = queryOptions({
  queryKey: CONFIG_KEYS.points,
  queryFn: () => getPointConfigFn(),
});

/** 读取双积分显示名称（普通积分 / 会员积分），前台后台通用 */
export function usePointConfig() {
  return useQuery(pointConfigQuery);
}
