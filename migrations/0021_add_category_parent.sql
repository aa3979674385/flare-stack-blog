-- 0021: 分类支持父子嵌套（二级/多级分类）
-- 为 categories 表新增 parent_id 自引用字段；删除父级分类时，子级自动回到顶级（ON DELETE SET NULL）。
-- 已有分类的 parent_id 默认 NULL（顶级分类）。

ALTER TABLE "categories" ADD COLUMN "parent_id" integer REFERENCES "categories"("id") ON DELETE SET NULL;
CREATE INDEX "categories_parent_idx" ON "categories"("parent_id");
