import { relations } from "drizzle-orm";
import {
  index,
  integer,
  primaryKey,
  sqliteTable,
  text,
  type SQLiteColumn,
} from "drizzle-orm/sqlite-core";
import { createdAt, id, updatedAt } from "./helper";
import { PostsTable } from "./posts.table";

/**
 * 真实独立的「分类」表 —— 与标签（tags）完全解耦。
 * 文章通过 post_categories 中间表归属到分类，一篇文章可属于多个分类。
 */
export const CategoriesTable = sqliteTable("categories", {
  id,
  name: text().notNull().unique(),
  description: text(),
  /** 父分类 id（可空）；自引用，删除父级时子级自动回到顶级（ON DELETE SET NULL） */
  parentId: integer("parent_id").references((): SQLiteColumn => CategoriesTable.id, {
    onDelete: "set null",
  }),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt,
  updatedAt,
});

export const PostCategoriesTable = sqliteTable(
  "post_categories",
  {
    postId: integer("post_id")
      .notNull()
      .references(() => PostsTable.id, { onDelete: "cascade" }),
    categoryId: integer("category_id")
      .notNull()
      .references(() => CategoriesTable.id, { onDelete: "cascade" }),
  },
  (table) => [
    primaryKey({ columns: [table.postId, table.categoryId] }),
    index("post_categories_category_idx").on(table.categoryId),
  ],
);

// ==================== relations ====================
export const categoriesRelations = relations(CategoriesTable, ({ many }) => ({
  postCategories: many(PostCategoriesTable),
}));

export const postCategoriesRelations = relations(PostCategoriesTable, ({ one }) => ({
  post: one(PostsTable, {
    fields: [PostCategoriesTable.postId],
    references: [PostsTable.id],
  }),
  category: one(CategoriesTable, {
    fields: [PostCategoriesTable.categoryId],
    references: [CategoriesTable.id],
  }),
}));

// ==================== types ====================
export type Category = typeof CategoriesTable.$inferSelect;
export type CategoryInsert = typeof CategoriesTable.$inferInsert;
