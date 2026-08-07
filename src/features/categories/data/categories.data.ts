import { and, asc, count, desc, eq, gt, ne, sql } from "drizzle-orm";
import type { BatchItem } from "drizzle-orm/batch";
import {
  CategoriesTable,
  PostCategoriesTable,
  PostsTable,
} from "@/lib/db/schema";
import type { DB } from "@/lib/db";

/**
 * Get all categories, optionally sorted
 */
export async function getAllCategories(
  db: DB,
  options: {
    sortBy?: "name" | "createdAt" | "sortOrder";
    sortDir?: "asc" | "desc";
  } = {},
) {
  const { sortBy = "sortOrder", sortDir = "asc" } = options;

  const orderFn = sortDir === "asc" ? asc : desc;
  const orderColumn =
    sortBy === "createdAt"
      ? CategoriesTable.createdAt
      : sortBy === "name"
        ? CategoriesTable.name
        : CategoriesTable.sortOrder;

  return await db
    .select()
    .from(CategoriesTable)
    .orderBy(orderFn(orderColumn), asc(CategoriesTable.id));
}

/**
 * Get all categories with their post counts
 */
export async function getAllCategoriesWithCount(
  db: DB,
  options: {
    sortBy?: "name" | "createdAt" | "sortOrder" | "postCount";
    sortDir?: "asc" | "desc";
    publicOnly?: boolean;
  } = {},
) {
  const { sortBy = "sortOrder", sortDir = "asc", publicOnly = false } = options;

  const query = db
    .select({
      id: CategoriesTable.id,
      name: CategoriesTable.name,
      description: CategoriesTable.description,
      parentId: CategoriesTable.parentId,
      sortOrder: CategoriesTable.sortOrder,
      createdAt: CategoriesTable.createdAt,
      updatedAt: CategoriesTable.updatedAt,
      postCount: count(PostCategoriesTable.postId).as("postCount"),
    })
    .from(CategoriesTable)
    .leftJoin(
      PostCategoriesTable,
      eq(CategoriesTable.id, PostCategoriesTable.categoryId),
    )
    .groupBy(CategoriesTable.id)
    .$dynamic();

  if (publicOnly) {
    query
      .innerJoin(PostsTable, eq(PostCategoriesTable.postId, PostsTable.id))
      .where(
        and(
          eq(PostsTable.status, "published"),
          sql`date(${PostsTable.publishedAt}, 'unixepoch') <= date('now')`,
        ),
      )
      .having(gt(count(PostCategoriesTable.postId), 0));
  }

  const orderFn = sortDir === "asc" ? asc : desc;

  if (sortBy === "postCount") {
    query.orderBy(orderFn(sql`postCount`), asc(CategoriesTable.id));
  } else if (sortBy === "createdAt") {
    query.orderBy(orderFn(CategoriesTable.createdAt), asc(CategoriesTable.id));
  } else if (sortBy === "name") {
    query.orderBy(orderFn(CategoriesTable.name), asc(CategoriesTable.id));
  } else {
    query.orderBy(
      orderFn(CategoriesTable.sortOrder),
      asc(CategoriesTable.id),
    );
  }

  return await query;
}

/**
 * Find a category by ID
 */
export async function findCategoryById(db: DB, id: number) {
  return await db.query.CategoriesTable.findFirst({
    where: eq(CategoriesTable.id, id),
  });
}

/**
 * Find a category by name
 */
export async function findCategoryByName(db: DB, name: string) {
  return await db.query.CategoriesTable.findFirst({
    where: eq(CategoriesTable.name, name),
  });
}

/**
 * Insert a new category
 */
export async function insertCategory(
  db: DB,
  data: typeof CategoriesTable.$inferInsert,
) {
  const result = await db.insert(CategoriesTable).values(data).returning();
  const category = (result as unknown as {
    results: (typeof CategoriesTable.$inferSelect)[];
  }).results[0];
  return category ?? undefined;
}

/**
 * Update a category
 */
export async function updateCategory(
  db: DB,
  id: number,
  data: Partial<Omit<typeof CategoriesTable.$inferInsert, "id" | "createdAt">>,
) {
  const [category] = await db
    .update(CategoriesTable)
    .set(data)
    .where(eq(CategoriesTable.id, id))
    .returning();
  return category;
}

/**
 * Delete a category (post_categories rows are removed by ON DELETE CASCADE)
 */
export async function deleteCategory(db: DB, id: number) {
  await db.delete(CategoriesTable).where(eq(CategoriesTable.id, id));
}

/**
 * Get categories for a specific post
 */
export async function getCategoriesByPostId(db: DB, postId: number) {
  const results = await db
    .select({
      id: CategoriesTable.id,
      name: CategoriesTable.name,
      description: CategoriesTable.description,
      parentId: CategoriesTable.parentId,
      sortOrder: CategoriesTable.sortOrder,
      createdAt: CategoriesTable.createdAt,
      updatedAt: CategoriesTable.updatedAt,
    })
    .from(PostCategoriesTable)
    .innerJoin(
      CategoriesTable,
      eq(PostCategoriesTable.categoryId, CategoriesTable.id),
    )
    .where(eq(PostCategoriesTable.postId, postId))
    .orderBy(asc(CategoriesTable.sortOrder), asc(CategoriesTable.name));

  return results;
}

/**
 * Set categories for a post (replace all existing associations).
 * Uses db.batch() to execute delete + insert in a single roundtrip.
 */
export async function setPostCategories(
  db: DB,
  postId: number,
  categoryIds: Array<number>,
) {
  const batchQueries: Array<BatchItem<"sqlite">> = [];

  // 1. 删除所有现有关联
  const deleteQuery = db
    .delete(PostCategoriesTable)
    .where(eq(PostCategoriesTable.postId, postId));

  // 2. 插入新关联
  if (categoryIds.length > 0) {
    batchQueries.push(
      db.insert(PostCategoriesTable).values(
        categoryIds.map((categoryId) => ({
          postId,
          categoryId,
        })),
      ),
    );
  }

  // 3. 批量执行 - 单次 roundtrip
  await db.batch([deleteQuery, ...batchQueries]);
}

/**
 * Check if a category name exists
 */
export async function nameExists(
  db: DB,
  name: string,
  options: { excludeId?: number } = {},
): Promise<boolean> {
  const { excludeId } = options;
  const conditions = [eq(CategoriesTable.name, name)];
  if (excludeId) {
    conditions.push(ne(CategoriesTable.id, excludeId));
  }
  const results = await db
    .select({ id: CategoriesTable.id })
    .from(CategoriesTable)
    .where(and(...conditions))
    .limit(1);
  return results.length > 0;
}

/**
 * Delete all category associations for a post.
 */
export async function deletePostCategoryAssociations(
  db: DB,
  postId: number,
) {
  await db
    .delete(PostCategoriesTable)
    .where(eq(PostCategoriesTable.postId, postId));
}

/**
 * Get published posts associated with a category (for cache invalidation)
 */
export async function getPublishedPostsByCategoryId(db: DB, categoryId: number) {
  const results = await db
    .select({
      id: PostsTable.id,
      slug: PostsTable.slug,
    })
    .from(PostCategoriesTable)
    .innerJoin(PostsTable, eq(PostCategoriesTable.postId, PostsTable.id))
    .where(
      and(
        eq(PostCategoriesTable.categoryId, categoryId),
        eq(PostsTable.status, "published"),
        sql`date(${PostsTable.publishedAt}, 'unixepoch') <= date('now')`,
      ),
    );

  return results;
}

/**
 * Count posts that belong to NO category (the "未分类" fallback bucket).
 */
export async function countUncategorizedPosts(db: DB) {
  const result = await db
    .select({ count: count() })
    .from(PostsTable)
    .leftJoin(
      PostCategoriesTable,
      eq(PostsTable.id, PostCategoriesTable.postId),
    )
    .where(
      and(
        eq(PostsTable.status, "published"),
        sql`date(${PostsTable.publishedAt}, 'unixepoch') <= date('now')`,
        sql`${PostCategoriesTable.postId} IS NULL`,
      ),
    );
  return result[0]?.count ?? 0;
}

/**
 * 返回某分类的所有后代分类 id（不含自身）。
 * 用于「按父分类过滤文章时，连带显示其全部子分类下的文章」。
 * 在内存中按 parentId 做 BFS，避免递归 CTE，分类数量少、开销可忽略。
 */
export async function getDescendantCategoryIds(
  db: DB,
  rootId: number,
): Promise<Array<number>> {
  const all = await db
    .select({
      id: CategoriesTable.id,
      parentId: CategoriesTable.parentId,
    })
    .from(CategoriesTable);

  const childrenMap = new Map<number | null, Array<number>>();
  for (const c of all) {
    const key = c.parentId ?? null;
    const list = childrenMap.get(key) ?? [];
    list.push(c.id);
    childrenMap.set(key, list);
  }

  const result: Array<number> = [];
  const queue: Array<number> = [rootId];
  while (queue.length > 0) {
    const current = queue.shift() as number;
    const children = childrenMap.get(current) ?? [];
    for (const childId of children) {
      if (!result.includes(childId)) {
        result.push(childId);
        queue.push(childId);
      }
    }
  }
  return result;
}
