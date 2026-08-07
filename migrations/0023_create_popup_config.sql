-- 弹窗广告配置（单行配置表，固定 id=1）
CREATE TABLE IF NOT EXISTS "popup_config" (
  "id" integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  "config_json" text,
  "updated_at" integer NOT NULL DEFAULT (unixepoch())
);
