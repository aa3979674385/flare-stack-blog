import { createServerFn } from "@tanstack/react-start";
import * as CacheService from "@/features/cache/cache.service";
import { requirePermission } from "@/lib/middlewares";

export const invalidateSiteCacheFn = createServerFn()
  .middleware([requirePermission("cache.manage")])
  .handler(async ({ context }) => CacheService.invalidateSiteCache(context));
