import * as CacheService from "@/features/cache/cache.service";
import * as PopupRepo from "./data/popup.data";
import { POPUP_CACHE_KEYS, type PopupConfig, PopupConfigSchema } from "./popup.schema";

export async function getPopupConfig(
  context: DbContext & { executionCtx: ExecutionContext },
): Promise<PopupConfig> {
  return CacheService.get(
    context,
    POPUP_CACHE_KEYS.config,
    PopupConfigSchema,
    () => PopupRepo.getPopupConfig(context.db),
    { ttl: "1d" },
  );
}

export async function savePopupConfig(
  context: DbContext & { executionCtx: ExecutionContext },
  config: PopupConfig,
): Promise<PopupConfig> {
  const saved = await PopupRepo.savePopupConfig(context.db, config);
  // 保存后立即失效缓存，保证前台下次读取拿到最新配置
  await CacheService.deleteKey(context, POPUP_CACHE_KEYS.config);
  return saved;
}
