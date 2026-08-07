-- 0017: 文章下载资源（下载框）+ 用户会员状态字段
-- 用户会员状态：关联套餐 id 与到期时间，用于下载权益判定
ALTER TABLE "user" ADD COLUMN "membership_plan_id" text;
ALTER TABLE "user" ADD COLUMN "membership_expires_at" integer;

-- 文章下载资源（下载框）
CREATE TABLE "post_resource" (
  "id" text PRIMARY KEY NOT NULL,
  "post_id" integer NOT NULL,
  "title" text NOT NULL,
  "description" text,
  "links" text NOT NULL,
  "access_type" text DEFAULT 'free' NOT NULL,
  "price_type" text DEFAULT 'rmb' NOT NULL,
  "price_amount" integer DEFAULT 0 NOT NULL,
  "member_access" text DEFAULT 'none' NOT NULL,
  "sort_order" integer DEFAULT 0 NOT NULL,
  "created_at" integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
  "updated_at" integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
  FOREIGN KEY ("post_id") REFERENCES "posts"("id") ON DELETE cascade ON UPDATE no action
);
CREATE INDEX "post_resource_post_idx" ON "post_resource" ("post_id","sort_order");

-- 资源购买 / 解锁记录
CREATE TABLE "post_resource_order" (
  "id" text PRIMARY KEY NOT NULL,
  "resource_id" text NOT NULL,
  "user_id" text NOT NULL,
  "price_type" text,
  "amount" integer,
  "status" text DEFAULT 'paid' NOT NULL,
  "created_at" integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
  FOREIGN KEY ("resource_id") REFERENCES "post_resource"("id") ON DELETE cascade ON UPDATE no action
);
CREATE INDEX "post_resource_order_resource_idx" ON "post_resource_order" ("resource_id","user_id");
CREATE INDEX "post_resource_order_user_idx" ON "post_resource_order" ("user_id");
