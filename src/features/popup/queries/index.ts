import { queryOptions } from "@tanstack/react-query";
import { getPopupConfigFn } from "../api/popup.public.api";
import { PopupConfigSchema } from "../popup.schema";

export function popupConfigQueryOptions() {
  return queryOptions({
    queryKey: ["popup", "config"],
    queryFn: async () => {
      const result = await getPopupConfigFn();
      return PopupConfigSchema.parse(result);
    },
    // 弹窗配置不常变，前端缓存 5 分钟
    staleTime: 1000 * 60 * 5,
  });
}
