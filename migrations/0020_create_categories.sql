-- 0020: 真实独立分类（与标签解耦）
-- categories：分类主表；post_categories：文章-分类多对多中间表。
-- 删除分类时，中间表行随 ON DELETE CASCADE 自动清除，文章落入「未分类」兜底。

CREATE TABLE "categories" (
  "id" integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  "name" text NOT NULL,
  "description" text,
  "sort_order" integer NOT NULL DEFAULT 0,
  "created_at" integer NOT NULL DEFAULT (unixepoch()),
  "updated_at" integer NOT NULL DEFAULT (unixepoch())
);
CREATE UNIQUE INDEX "categories_name_idx" ON "categories"("name");

CREATE TABLE "post_categories" (
  "post_id" integer NOT NULL REFERENCES "posts"("id") ON DELETE CASCADE,
  "category_id" integer NOT NULL REFERENCES "categories"("id") ON DELETE CASCADE
);
CREATE UNIQUE INDEX "post_categories_pk" ON "post_categories"("post_id", "category_id");
CREATE INDEX "post_categories_category_idx" ON "post_categories"("category_id");
