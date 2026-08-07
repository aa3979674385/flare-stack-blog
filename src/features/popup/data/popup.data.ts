import { eq } from "drizzle-orm";
import type { DB } from "@/lib/db";
import { PopupConfigTable } from "@/lib/db/schema";
import {
  DEFAULT_POPUP_CONFIG,
  type PopupConfig,
  PopupConfigSchema,
} from "../popup.schema";

/** 弹窗配置固定使用单行（id=1） */
const ROW_ID = 1;

export async function getPopupConfig(db: DB): Promise<PopupConfig> {
  const row = await db.query.PopupConfigTable.findFirst({
    where: eq(PopupConfigTable.id, ROW_ID),
  });
  if (!row?.configJson) return DEFAULT_POPUP_CONFIG;
  const parsed = PopupConfigSchema.safeParse(row.configJson);
  if (!parsed.success) return DEFAULT_POPUP_CONFIG;
  // 与默认值深合并，保证后续新增字段始终有兜底
  return { ...DEFAULT_POPUP_CONFIG, ...parsed.data };
}

export async function savePopupConfig(
  db: DB,
  config: PopupConfig,
): Promise<PopupConfig> {
  const validated = PopupConfigSchema.parse(config);
  await db
    .insert(PopupConfigTable)
    .values({
      id: ROW_ID,
      configJson: validated,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: PopupConfigTable.id,
      set: {
        configJson: validated,
        updatedAt: new Date(),
      },
    });
  return validated;
}
