import { createServerFn } from "@tanstack/react-start";
import * as PopupService from "../popup.service";
import { dbMiddleware } from "@/lib/middlewares";

// 公开接口：前端弹窗组件读取配置（无需登录）
export const getPopupConfigFn = createServerFn()
  .middleware([dbMiddleware])
  .handler(async ({ context }) => {
    return await PopupService.getPopupConfig(context);
  });
