import { createServerFn } from "@tanstack/react-start";
import * as CacheService from "@/features/cache/cache.service";
import * as DashboardService from "@/features/dashboard/service/dashboard.service";
import { PAGEVIEW_CACHE_KEYS } from "@/features/pageview/pageview.schema";
import { requirePermission } from "@/lib/middlewares";

export const getDashboardStatsFn = createServerFn()
  .middleware([requirePermission("dashboard.view")])
  .handler(({ context }) => DashboardService.getDashboardStats(context));

export const refreshDashboardCacheFn = createServerFn()
  .middleware([requirePermission("cache.manage")])
  .handler(async ({ context }) => {
    await CacheService.deleteKey(context, PAGEVIEW_CACHE_KEYS.traffic);
    return DashboardService.getDashboardStats(context);
  });
