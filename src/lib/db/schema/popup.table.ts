import { sqliteTable, text } from "drizzle-orm/sqlite-core";
import type { PopupConfig } from "@/features/popup/popup.schema";
import { id, updatedAt } from "./helper";

/**
 * 弹窗广告配置：单行配置表，固定使用 id=1 这一行存放全部配置（JSON）。
 */
export const PopupConfigTable = sqliteTable("popup_config", {
  id,
  configJson: text("config_json", { mode: "json" }).$type<PopupConfig>(),
  updatedAt,
});
