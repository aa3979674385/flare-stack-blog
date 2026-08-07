-- 0019: 购买记录增加订单号（order_no）+ 新增附件下载记录表 + 积分流水关联订单号
-- 同时把历史订单回填一个稳定的伪订单号，保证「每个订单都有订单号、可被搜索」。

ALTER TABLE "post_resource_order" ADD COLUMN "order_no" text;
UPDATE "post_resource_order" SET "order_no" = 'PR' || substr("id", 1, 12) WHERE "order_no" IS NULL;
CREATE UNIQUE INDEX "post_resource_order_no_idx" ON "post_resource_order"("order_no");

ALTER TABLE "point_transaction" ADD COLUMN "order_no" text;
CREATE INDEX "point_txn_order_no_idx" ON "point_transaction"("order_no");

CREATE TABLE "post_resource_download" (
  "id" text PRIMARY KEY NOT NULL,
  "order_id" text,
  "resource_id" text NOT NULL REFERENCES "post_resource"("id") ON DELETE CASCADE,
  "user_id" text NOT NULL,
  "file_url" text NOT NULL,
  "file_name" text,
  "created_at" integer NOT NULL DEFAULT (cast(unixepoch('subsecond') * 1000 as integer))
);
CREATE INDEX "post_resource_download_resource_idx" ON "post_resource_download"("resource_id", "user_id");
CREATE INDEX "post_resource_download_user_idx" ON "post_resource_download"("user_id");
