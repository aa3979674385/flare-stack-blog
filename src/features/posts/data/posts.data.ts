import {
  and,
  asc,
  count,
  desc,
  eq,
  inArray,
  isNotNull,
  like,
  lt,
  ne,
  notExists,
  or,
  sql,
} from "drizzle-orm";
import type { JSONContent } from "@tiptap/react";
import type { SortDirection, SortField } from "@/features/posts/data/helper";
import {
  buildPostOrderByClause,
  buildPostWhereClause,
} from "@/features/posts/data/helper";
import type { PostListItem } from "@/features/posts/schema/posts.schema";
import type { Category, PostStatus, Tag } from "@/lib/db/schema";
import {
  CategoriesTable,
  postResource,
  PostsTable,
  PostCategoriesTable,
  PostTagsTable,
  TagsTable,
} from "@/lib/db/schema";
import { getDescendantCategoryIds } from "@/features/categories/data/categories.data";

const DEFAULT_PAGE_SIZE = 12;
const DEFAULT_SITEMAP_BATCH_SIZE = 500;

/** 批量查询文章关联的 post_resource.access_type，避免子查询在 D1 上的潜在问题。 */
async function batchFetchAccessTypes(
  db: DB,
  items: Array<{ id: number; accessType?: unknown }>,
) {
  if (items.length === 0) return;
  const postIds = items.map((p) => p.id);
  const resources = await db
    .select({
      postId: postResource.postId,
      accessType: postResource.accessType,
    })
    .from(postResource)
    .where(inArray(postResource.postId, postIds));

  const accessByPostId = new Map<number, string>();
  for (const r of resources) {
    accessByPostId.set(r.postId, r.accessType);
  }

  for (const item of items) {
    (item as Record<string, unknown>).accessType =
      accessByPostId.get(item.id) ?? null;
  }
}

export type SitemapPostRow = {
  id: number;
  slug: string;
  createdAt: Date | null;
  updatedAt: Date | null;
  publishedAt: Date | null;
};

export async function insertPost(db: DB, data: typeof PostsTable.$inferInsert) {
  const [post] = await db.insert(PostsTable).values(data).returning();
  return post;
}

export async function getPosts(
  db: DB,
  options: {
    offset?: number;
    limit?: number;
    status?: PostStatus;
    publicOnly?: boolean;
    search?: string;
    sortDir?: SortDirection;
    sortBy?: SortField;
  } = {},
) {
  const {
    offset = 0,
    limit = DEFAULT_PAGE_SIZE,
    sortDir,
    sortBy,
    ...filters
  } = options;
  const whereClause = buildPostWhereClause(filters);
  const orderByClause = buildPostOrderByClause(sortDir, sortBy);

  const posts = await db
    .select({
      id: PostsTable.id,
      title: PostsTable.title,
      summary: PostsTable.summary,
      readTimeInMinutes: PostsTable.readTimeInMinutes,
      slug: PostsTable.slug,
      status: PostsTable.status,
      publishedAt: PostsTable.publishedAt,
      pinnedAt: PostsTable.pinnedAt,
      createdAt: PostsTable.createdAt,
      updatedAt: PostsTable.updatedAt,
    })
    .from(PostsTable)
    .limit(Math.min(limit, 50))
    .offset(offset)
    .orderBy(orderByClause)
    .where(whereClause);
  return posts;
}

export async function getPostsCount(
  db: DB,
  options: {
    status?: PostStatus;
    publicOnly?: boolean;
    search?: string;
  } = {},
) {
  const whereClause = buildPostWhereClause(options);
  const totalNumberofPosts = await db
    .select({ count: count() })
    .from(PostsTable)
    .where(whereClause);
  return totalNumberofPosts[0].count;
}

/**
 * Get posts with cursor-based pagination
 * @param cursor - The id of the last item from previous page
 * @param limit - Number of items per page
 */
export async function getPostsCursor(
  db: DB,
  options: {
    cursor?: number;
    limit?: number;
    publicOnly?: boolean;
    tagName?: string;
    /** 按真实分类（独立表）过滤，传分类 id */
    categoryId?: number;
    excludePinned?: boolean;
    /** 未分类视图：仅返回未归入任何分类的文章（与标签无关） */
    uncategorized?: boolean;
  } = {},
): Promise<{
  items: Array<PostListItem>;
  nextCursor: number | null;
}> {
  const {
    cursor,
    limit = DEFAULT_PAGE_SIZE,
    publicOnly,
    tagName,
    categoryId,
    excludePinned,
  } = options;

  // Build base conditions from helper
  const baseConditions = buildPostWhereClause({ publicOnly });

  // Add cursor condition if provided
  const conditions = [];
  if (baseConditions) {
    conditions.push(baseConditions);
  }

  if (cursor) {
    const reference = await db.query.PostsTable.findFirst({
      where: eq(PostsTable.id, cursor),
      columns: { publishedAt: true, id: true },
    });

    if (reference?.publishedAt) {
      conditions.push(
        or(
          lt(PostsTable.publishedAt, reference.publishedAt),
          and(
            eq(PostsTable.publishedAt, reference.publishedAt),
            lt(PostsTable.id, reference.id),
          ),
        ),
      );
    } else if (reference) {
      // Fallback if somehow publishedAt is null (shouldn't happen for published posts)
      conditions.push(lt(PostsTable.id, cursor));
    }
  }

  if (tagName) {
    conditions.push(eq(TagsTable.name, tagName));
  }

  if (categoryId !== undefined) {
    // 展开为「自身 + 所有后代分类」，实现按父分类查看含子分类文章
    const descendants = await getDescendantCategoryIds(db, categoryId);
    conditions.push(inArray(CategoriesTable.id, [categoryId, ...descendants]));
  }

  if (excludePinned) {
    conditions.push(sql`${PostsTable.pinnedAt} IS NULL`);
  }

  // 未分类视图：文章未关联任何分类（与标签无关）
  if (options.uncategorized) {
    conditions.push(
      notExists(
        db
          .select({ id: PostCategoriesTable.postId })
          .from(PostCategoriesTable)
          .where(eq(PostCategoriesTable.postId, PostsTable.id)),
      ),
    );
  }

  let query = db
    .select({
      id: PostsTable.id,
      title: PostsTable.title,
      summary: PostsTable.summary,
      readTimeInMinutes: PostsTable.readTimeInMinutes,
      slug: PostsTable.slug,
      status: PostsTable.status,
      publishedAt: PostsTable.publishedAt,
      pinnedAt: PostsTable.pinnedAt,
      createdAt: PostsTable.createdAt,
      updatedAt: PostsTable.updatedAt,
      coverImage: PostsTable.coverImage,
    })
    .from(PostsTable)
    .$dynamic();

  if (tagName) {
    query = query
      .innerJoin(PostTagsTable, eq(PostsTable.id, PostTagsTable.postId))
      .innerJoin(TagsTable, eq(PostTagsTable.tagId, TagsTable.id));
  }

  if (categoryId !== undefined) {
    query = query
      .innerJoin(
        PostCategoriesTable,
        eq(PostsTable.id, PostCategoriesTable.postId),
      )
      .innerJoin(
        CategoriesTable,
        eq(PostCategoriesTable.categoryId, CategoriesTable.id),
      );
  }

  const itemsWithPotentialNext = await query
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(PostsTable.publishedAt), desc(PostsTable.id))
    .limit(limit + 1);

  // Check if there's a next page
  const hasMore = itemsWithPotentialNext.length > limit;
  const items = itemsWithPotentialNext.slice(0, limit) as Array<PostListItem>;

  // Fetch tags for all items
  if (items.length > 0) {
    const postIds = items.map((p) => p.id);
    const tagsResults = await db
      .select({
        postId: PostTagsTable.postId,
        tag: {
          id: TagsTable.id,
          name: TagsTable.name,
          createdAt: TagsTable.createdAt,
        },
      })
      .from(PostTagsTable)
      .innerJoin(TagsTable, eq(PostTagsTable.tagId, TagsTable.id))
      .where(inArray(PostTagsTable.postId, postIds));

    // Map tags back to items
    const tagsByPostId = new Map<number, Array<Tag>>();
    for (const result of tagsResults) {
      const existing = tagsByPostId.get(result.postId) ?? [];
      existing.push(result.tag);
      tagsByPostId.set(result.postId, existing);
    }

    items.forEach((item) => {
      item.tags = tagsByPostId.get(item.id) ?? [];
    });
  }

  // Fetch categories for all items
  if (items.length > 0) {
    const postIds = items.map((p) => p.id);
    const categoriesResults = await db
      .select({
        postId: PostCategoriesTable.postId,
        category: {
          id: CategoriesTable.id,
          name: CategoriesTable.name,
          description: CategoriesTable.description,
          parentId: CategoriesTable.parentId,
          sortOrder: CategoriesTable.sortOrder,
          createdAt: CategoriesTable.createdAt,
          updatedAt: CategoriesTable.updatedAt,
        },
      })
      .from(PostCategoriesTable)
      .innerJoin(
        CategoriesTable,
        eq(PostCategoriesTable.categoryId, CategoriesTable.id),
      )
      .where(inArray(PostCategoriesTable.postId, postIds));

    // Map categories back to items
    const categoriesByPostId = new Map<number, Array<Category>>();
    for (const result of categoriesResults) {
      const existing = categoriesByPostId.get(result.postId) ?? [];
      existing.push(result.category);
      categoriesByPostId.set(result.postId, existing);
    }

    items.forEach((item) => {
      item.categories = categoriesByPostId.get(item.id) ?? [];
    });
  }

  // Batch-fetch access types from post_resource (avoiding D1 subquery issues)
  await batchFetchAccessTypes(db, items as Array<{ id: number; accessType?: unknown }>);

  const nextCursor = hasMore ? (items[items.length - 1]?.id ?? null) : null;

  return { items, nextCursor };
}

export async function getPostsPaged(
  db: DB,
  options: {
    page?: number;
    limit?: number;
    publicOnly?: boolean;
    tagName?: string;
    /** 按真实分类（独立表）过滤，传分类 id */
    categoryId?: number;
    excludePinned?: boolean;
    /** 未分类视图：仅返回未归入任何分类的文章（与标签无关） */
    uncategorized?: boolean;
    /** 排序字段：publishedAt | updatedAt | createdAt | title */
    sortBy?: "publishedAt" | "updatedAt" | "createdAt" | "title";
    /** 排序方向：asc | desc */
    sortDir?: "asc" | "desc";
  } = {},
): Promise<{
  items: Array<PostListItem>;
  totalCount: number;
  totalPages: number;
  page: number;
  pageSize: number;
}> {
  const {
    page = 1,
    limit = DEFAULT_PAGE_SIZE,
    publicOnly,
    tagName,
    categoryId,
    excludePinned,
    sortBy = "publishedAt",
    sortDir = "desc",
  } = options;

  const pageSize = Math.min(limit, 50);
  const offset = (page - 1) * pageSize;

  // Build base conditions from helper
  const baseConditions = buildPostWhereClause({ publicOnly });

  const conditions = [];
  if (baseConditions) {
    conditions.push(baseConditions);
  }

  if (tagName) {
    conditions.push(eq(TagsTable.name, tagName));
  }

  if (categoryId !== undefined) {
    // 展开为「自身 + 所有后代分类」，实现按父分类查看含子分类文章
    const descendants = await getDescendantCategoryIds(db, categoryId);
    conditions.push(inArray(CategoriesTable.id, [categoryId, ...descendants]));
  }

  if (excludePinned) {
    conditions.push(sql`${PostsTable.pinnedAt} IS NULL`);
  }

  // 未分类视图：文章未关联任何分类（与标签无关）
  if (options.uncategorized) {
    conditions.push(
      notExists(
        db
          .select({ id: PostCategoriesTable.postId })
          .from(PostCategoriesTable)
          .where(eq(PostCategoriesTable.postId, PostsTable.id)),
      ),
    );
  }

  let query = db
    .select({
      id: PostsTable.id,
      title: PostsTable.title,
      summary: PostsTable.summary,
      readTimeInMinutes: PostsTable.readTimeInMinutes,
      slug: PostsTable.slug,
      status: PostsTable.status,
      publishedAt: PostsTable.publishedAt,
      pinnedAt: PostsTable.pinnedAt,
      createdAt: PostsTable.createdAt,
      updatedAt: PostsTable.updatedAt,
      coverImage: PostsTable.coverImage,
    })
    .from(PostsTable)
    .$dynamic();

  let countQuery = db
    .select({
      count: sql<number>`count(distinct ${PostsTable.id})`,
    })
    .from(PostsTable)
    .$dynamic();

  if (tagName) {
    query = query
      .innerJoin(PostTagsTable, eq(PostsTable.id, PostTagsTable.postId))
      .innerJoin(TagsTable, eq(PostTagsTable.tagId, TagsTable.id));
    countQuery = countQuery
      .innerJoin(PostTagsTable, eq(PostsTable.id, PostTagsTable.postId))
      .innerJoin(TagsTable, eq(PostTagsTable.tagId, TagsTable.id));
  }

  if (categoryId !== undefined) {
    query = query
      .innerJoin(
        PostCategoriesTable,
        eq(PostsTable.id, PostCategoriesTable.postId),
      )
      .innerJoin(
        CategoriesTable,
        eq(PostCategoriesTable.categoryId, CategoriesTable.id),
      );
    countQuery = countQuery
      .innerJoin(
        PostCategoriesTable,
        eq(PostsTable.id, PostCategoriesTable.postId),
      )
      .innerJoin(
        CategoriesTable,
        eq(PostCategoriesTable.categoryId, CategoriesTable.id),
      );
  }

  const where = conditions.length > 0 ? and(...conditions) : undefined;

  // 动态排序：默认按发布时间倒序，可选更新时间/创建时间/标题
  const sortColumn =
    sortBy === "updatedAt"
      ? PostsTable.updatedAt
      : sortBy === "createdAt"
        ? PostsTable.createdAt
        : sortBy === "title"
          ? PostsTable.title
          : PostsTable.publishedAt;
  const sortOrderFn = sortDir === "asc" ? asc : desc;

  const [rawItems, totalResult] = await Promise.all([
    query
      .where(where)
      .orderBy(sortOrderFn(sortColumn), desc(PostsTable.id))
      .limit(pageSize)
      .offset(offset),
    countQuery.where(where),
  ]);
  const items = rawItems as Array<PostListItem>;

  const totalCount = totalResult[0]?.count ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));

  // Fetch tags for all items
  if (items.length > 0) {
    const postIds = items.map((p) => p.id);
    const tagsResults = await db
      .select({
        postId: PostTagsTable.postId,
        tag: {
          id: TagsTable.id,
          name: TagsTable.name,
          createdAt: TagsTable.createdAt,
        },
      })
      .from(PostTagsTable)
      .innerJoin(TagsTable, eq(PostTagsTable.tagId, TagsTable.id))
      .where(inArray(PostTagsTable.postId, postIds));

    const tagsByPostId = new Map<number, Array<Tag>>();
    for (const result of tagsResults) {
      const existing = tagsByPostId.get(result.postId) ?? [];
      existing.push(result.tag);
      tagsByPostId.set(result.postId, existing);
    }

    items.forEach((item) => {
      item.tags = tagsByPostId.get(item.id) ?? [];
    });
  }

  // Fetch categories for all items
  if (items.length > 0) {
    const postIds = items.map((p) => p.id);
    const categoriesResults = await db
      .select({
        postId: PostCategoriesTable.postId,
        category: {
          id: CategoriesTable.id,
          name: CategoriesTable.name,
          description: CategoriesTable.description,
          parentId: CategoriesTable.parentId,
          sortOrder: CategoriesTable.sortOrder,
          createdAt: CategoriesTable.createdAt,
          updatedAt: CategoriesTable.updatedAt,
        },
      })
      .from(PostCategoriesTable)
      .innerJoin(
        CategoriesTable,
        eq(PostCategoriesTable.categoryId, CategoriesTable.id),
      )
      .where(inArray(PostCategoriesTable.postId, postIds));

    const categoriesByPostId = new Map<number, Array<Category>>();
    for (const result of categoriesResults) {
      const existing = categoriesByPostId.get(result.postId) ?? [];
      existing.push(result.category);
      categoriesByPostId.set(result.postId, existing);
    }

    items.forEach((item) => {
      item.categories = categoriesByPostId.get(item.id) ?? [];
    });
  }

  // Batch-fetch access types from post_resource (avoiding D1 subquery issues)
  await batchFetchAccessTypes(db, items as Array<{ id: number; accessType?: unknown }>);

  return {
    items: items as Array<PostListItem>,
    totalCount,
    totalPages,
    page,
    pageSize,
  };
}

export async function getPublishedPostsForSitemapBatch(
  db: DB,
  options: {
    cursor?: {
      publishedAt: Date;
      id: number;
    };
    limit?: number;
  } = {},
): Promise<Array<SitemapPostRow>> {
  const { cursor, limit = DEFAULT_SITEMAP_BATCH_SIZE } = options;

  return await db
    .select({
      id: PostsTable.id,
      slug: PostsTable.slug,
      createdAt: PostsTable.createdAt,
      updatedAt: PostsTable.updatedAt,
      publishedAt: PostsTable.publishedAt,
    })
    .from(PostsTable)
    .where(
      and(
        eq(PostsTable.status, "published"),
        isNotNull(PostsTable.publishedAt),
        sql`date(${PostsTable.publishedAt}, 'unixepoch') <= date('now')`,
        cursor
          ? or(
              lt(PostsTable.publishedAt, cursor.publishedAt),
              and(
                eq(PostsTable.publishedAt, cursor.publishedAt),
                lt(PostsTable.id, cursor.id),
              ),
            )
          : undefined,
      ),
    )
    .orderBy(desc(PostsTable.publishedAt), desc(PostsTable.id))
    .limit(limit);
}

export async function findPostById(db: DB, id: number) {
  const post = await db.query.PostsTable.findFirst({
    where: eq(PostsTable.id, id),
    with: {
      postTags: {
        with: {
          tag: true,
        },
      },
    },
  });

  if (!post) return null;

  // Flatten tags
  const tags = post.postTags.map((pt) => pt.tag);
  const { postTags, ...rest } = post;

  // Categories (single post)
  const categoryRows = await db
    .select({
      category: {
        id: CategoriesTable.id,
        name: CategoriesTable.name,
        description: CategoriesTable.description,
        parentId: CategoriesTable.parentId,
        sortOrder: CategoriesTable.sortOrder,
        createdAt: CategoriesTable.createdAt,
        updatedAt: CategoriesTable.updatedAt,
      },
    })
    .from(PostCategoriesTable)
    .innerJoin(
      CategoriesTable,
      eq(PostCategoriesTable.categoryId, CategoriesTable.id),
    )
    .where(eq(PostCategoriesTable.postId, post.id));
  const categories = categoryRows.map((r) => r.category);

  return { ...rest, tags, categories };
}

export async function findPinnedPosts(db: DB) {
  const posts = await db.query.PostsTable.findMany({
    where: and(
      buildPostWhereClause({ publicOnly: true }),
      isNotNull(PostsTable.pinnedAt),
    ),
    orderBy: [desc(PostsTable.publishedAt)],
    columns: {
      id: true,
      title: true,
      summary: true,
      readTimeInMinutes: true,
      slug: true,
      status: true,
      publishedAt: true,
      pinnedAt: true,
      createdAt: true,
      updatedAt: true,
      coverImage: true,
    },
    with: {
      postTags: {
        with: { tag: true },
      },
    },
  });

  // Batch-fetch access types（保证置顶文章也带 accessType）
  await batchFetchAccessTypes(db, posts as Array<{ id: number; accessType?: unknown }>);

  return posts.map((p) => ({
    ...p,
    tags: p.postTags.map((pt) => pt.tag),
  }));
}

export async function findPostsBySlugs(db: DB, slugs: string[]) {
  if (slugs.length === 0) return [];

  const posts = await db.query.PostsTable.findMany({
    where: and(
      buildPostWhereClause({ publicOnly: true }),
      inArray(PostsTable.slug, slugs),
    ),
    columns: {
      id: true,
      title: true,
      summary: true,
      readTimeInMinutes: true,
      slug: true,
      status: true,
      publishedAt: true,
      pinnedAt: true,
      createdAt: true,
      updatedAt: true,
      coverImage: true,
    },
    with: {
      postTags: {
        with: { tag: true },
      },
    },
  });

  // Batch-fetch access types（热门/相关文章也带 accessType）
  await batchFetchAccessTypes(db, posts as Array<{ id: number; accessType?: unknown }>);

  return posts.map((p) => ({
    ...p,
    tags: p.postTags.map((pt) => pt.tag),
  }));
}

export async function findPostBySlug(
  db: DB,
  slug: string,
  options: { publicOnly?: boolean } = {},
) {
  const { publicOnly = false } = options;

  const whereClause = buildPostWhereClause({ publicOnly });
  const post = await db.query.PostsTable.findFirst({
    where: and(eq(PostsTable.slug, slug), whereClause),
    with: {
      postTags: {
        with: {
          tag: true,
        },
      },
    },
  });

  if (!post) return null;

  // Flatten tags
  const tags = post.postTags.map((pt) => pt.tag);
  const { postTags, ...rest } = post;

  // Categories (single post)
  const categoryRows = await db
    .select({
      category: {
        id: CategoriesTable.id,
        name: CategoriesTable.name,
        description: CategoriesTable.description,
        parentId: CategoriesTable.parentId,
        sortOrder: CategoriesTable.sortOrder,
        createdAt: CategoriesTable.createdAt,
        updatedAt: CategoriesTable.updatedAt,
      },
    })
    .from(PostCategoriesTable)
    .innerJoin(
      CategoriesTable,
      eq(PostCategoriesTable.categoryId, CategoriesTable.id),
    )
    .where(eq(PostCategoriesTable.postId, post.id));
  const categories = categoryRows.map((r) => r.category);

  return { ...rest, tags, categories };
}

/**
 * 从 TipTap 正文 JSON 中递归查找第一张「尺寸足够」的图片节点作为封面。
 * 跳过宽或高小于 minSize 的图片（避免把小图标/表情包当成封面）。
 * 节点若没有尺寸信息则无法判断，按候选处理（宽松策略）。
 */
export function extractCoverImage(
  content: JSONContent | null | undefined,
  minSize = 200,
): string | null {
  if (!content) return null;
  if (content.type === "image") {
    const attrs = content.attrs as
      | { src?: string; url?: string; width?: number; height?: number }
      | undefined;
    const src = attrs?.src || attrs?.url;
    if (!src) return null;
    if (
      typeof attrs?.width === "number" &&
      typeof attrs?.height === "number" &&
      (attrs.width < minSize || attrs.height < minSize)
    ) {
      return null;
    }
    return src;
  }
  if (Array.isArray(content.content)) {
    for (const child of content.content) {
      const found = extractCoverImage(child, minSize);
      if (found) return found;
    }
  }
  return null;
}

export async function updatePost(
  db: DB,
  id: number,
  data: Partial<Omit<typeof PostsTable.$inferInsert, "id" | "createdAt">>,
) {
  const updateData = { ...data };

  // 封面图兜底：
  // - 用户显式填写了封面（非空字符串）→ 使用用户填写的值
  // - 用户清空 / 留空（null 或空串）→ 自动从正文第一张尺寸足够的图抓取
  // - 用户未传该字段（undefined，例如其它字段的局部更新）→ 保留数据库现有值
  if (data.coverImage !== undefined) {
    if (data.coverImage && data.coverImage.trim() !== "") {
      updateData.coverImage = data.coverImage.trim();
    } else {
      updateData.coverImage = extractCoverImage(data.contentJson);
    }
  }

  await db.update(PostsTable).set(updateData).where(eq(PostsTable.id, id));
  return await findPostById(db, id);
}

export async function touchPostUpdatedAt(db: DB, id: number) {
  await db
    .update(PostsTable)
    .set({
      updatedAt: new Date(),
    })
    .where(eq(PostsTable.id, id));
}

export async function updatePublicContentSnapshot(
  db: DB,
  id: number,
  publicContentJson: typeof PostsTable.$inferInsert.publicContentJson,
) {
  await db
    .update(PostsTable)
    .set({
      publicContentJson,
      // Snapshot rebuilds should not affect editorial ordering/history.
      updatedAt: sql`${PostsTable.updatedAt}`,
    })
    .where(eq(PostsTable.id, id));
  return await findPostById(db, id);
}

export async function deletePost(db: DB, id: number) {
  await db.delete(PostsTable).where(eq(PostsTable.id, id));
}

/**
 * Check if a slug exists in the database
 * @param slug - The slug to check
 * @param excludeId - Optional post ID to exclude (for editing existing posts)
 */
export async function slugExists(
  db: DB,
  slug: string,
  options: { excludeId?: number } = {},
): Promise<boolean> {
  const { excludeId } = options;
  const conditions = [eq(PostsTable.slug, slug)];
  if (excludeId) {
    conditions.push(ne(PostsTable.id, excludeId));
  }
  const results = await db
    .select({ id: PostsTable.id })
    .from(PostsTable)
    .where(and(...conditions))
    .limit(1);
  return results.length > 0;
}

/**
 * 找出所有长得像 "baseSlug-%" 的 Slug
 */
export async function findSimilarSlugs(
  db: DB,
  baseSlug: string,
  options: { excludeId?: number } = {},
) {
  const conditions = [like(PostsTable.slug, `${baseSlug}-%`)];

  // 如果是编辑文章，要排除掉自己，防止把自己算作冲突
  if (options.excludeId) {
    conditions.push(ne(PostsTable.id, options.excludeId));
  }

  const results = await db
    .select({ slug: PostsTable.slug })
    .from(PostsTable)
    .where(and(...conditions));

  return results.map((r) => r.slug);
}

export async function getRelatedPostIds(
  db: DB,
  slug: string,
  options: { limit?: number } = {},
) {
  const { limit = 3 } = options;

  // 1. Get current post ID and its tags
  const currentPost = await db.query.PostsTable.findFirst({
    where: eq(PostsTable.slug, slug),
    with: {
      postTags: true,
    },
    columns: { id: true },
  });

  if (!currentPost || currentPost.postTags.length === 0) {
    return [];
  }

  const tagIds = currentPost.postTags.map((pt) => pt.tagId);

  // 2. Find posts that share at least one tag
  // Return only IDs, ordered by match count
  const matchingPosts = await db
    .select({
      id: PostsTable.id,
      matchCount: sql<number>`count(${PostTagsTable.tagId})`.as("match_count"),
    })
    .from(PostsTable)
    .innerJoin(PostTagsTable, eq(PostsTable.id, PostTagsTable.postId))
    .where(
      and(
        ne(PostsTable.id, currentPost.id),
        eq(PostsTable.status, "published"),
        inArray(PostTagsTable.tagId, tagIds),
      ),
    )
    .groupBy(PostsTable.id)
    .orderBy(desc(sql`match_count`), desc(PostsTable.publishedAt))
    .limit(limit);

  return matchingPosts.map((p) => p.id);
}

export async function getPublicPostsByIds(db: DB, ids: Array<number>) {
  if (ids.length === 0) return [];

  const whereClause = buildPostWhereClause({ publicOnly: true });

  const posts = await db
    .select({
      id: PostsTable.id,
      title: PostsTable.title,
      summary: PostsTable.summary,
      readTimeInMinutes: PostsTable.readTimeInMinutes,
      slug: PostsTable.slug,
      status: PostsTable.status,
      publishedAt: PostsTable.publishedAt,
      pinnedAt: PostsTable.pinnedAt,
      createdAt: PostsTable.createdAt,
      updatedAt: PostsTable.updatedAt,
      coverImage: PostsTable.coverImage,
    })
    .from(PostsTable)
    .where(and(inArray(PostsTable.id, ids), whereClause));

  // Batch-fetch access types（按 id 批量取文章也带 accessType）
  await batchFetchAccessTypes(db, posts as Array<{ id: number; accessType?: unknown }>);

  return posts;
}

/**
 * Fetch full post data (including tags and content) for export or other detailed use cases.
 * Uses Drizzle relational queries for efficiency.
 */
export async function findFullPosts(
  db: DB,
  options: {
    ids?: Array<number>;
    status?: PostStatus;
  } = {},
) {
  const { ids, status } = options;
  const conditions = [];

  if (ids && ids.length > 0) {
    conditions.push(inArray(PostsTable.id, ids));
  }
  if (status) {
    conditions.push(eq(PostsTable.status, status));
  }

  const results = await db.query.PostsTable.findMany({
    where: conditions.length > 0 ? and(...conditions) : undefined,
    with: {
      postTags: {
        with: {
          tag: true,
        },
      },
    },
    orderBy: [desc(PostsTable.createdAt)],
  });

  return results.map((post) => {
    const { postTags, ...rest } = post;
    return {
      ...rest,
      tags: postTags.map((pt) => pt.tag),
    };
  });
}
