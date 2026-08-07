import { z } from "zod";
import * as CacheService from "@/features/cache/cache.service";
import * as PostRepo from "@/features/posts/data/posts.data";
import { POSTS_CACHE_KEYS } from "@/features/posts/schema/posts.schema";
import { postPath } from "@/lib/post-url";
import * as CategoryRepo from "@/features/categories/data/categories.data";
import type {
  Category,
  CategoryWithCount,
  CreateCategoryInput,
  DeleteCategoryInput,
  GetCategoriesByPostIdInput,
  GetCategoriesInput,
  SetPostCategoriesInput,
  UpdateCategoryInput,
} from "@/features/categories/categories.schema";
import {
  CATEGORIES_CACHE_KEYS,
  CategoryWithCountSchema,
} from "@/features/categories/categories.schema";
import { err, ok } from "@/lib/errors";
import { purgeCDNCache } from "@/lib/invalidate";

/**
 * Get all categories (cached)
 */
export async function getCategories(
  context: DbContext,
  data: GetCategoriesInput = {},
): Promise<Array<Category | CategoryWithCount>> {
  const { sortBy = "sortOrder", sortDir = "asc", withCount = false } = data;

  if (withCount) {
    return await CategoryRepo.getAllCategoriesWithCount(context.db, {
      sortBy,
      sortDir,
    });
  }
  return await CategoryRepo.getAllCategories(context.db, {
    sortBy,
    sortDir,
  });
}

/**
 * Get public categories list (KV-cached, populated with counts).
 * Public site shows categories with their published post counts.
 */
export async function getPublicCategories(
  context: DbContext & { executionCtx: ExecutionContext },
) {
  return await CacheService.get(
    context,
    CATEGORIES_CACHE_KEYS.publicList,
    z.array(CategoryWithCountSchema),
    async () =>
      await CategoryRepo.getAllCategoriesWithCount(context.db, {
        publicOnly: true,
        sortBy: "sortOrder",
        sortDir: "asc",
      }),
    { ttl: "7d" },
  );
}

/**
 * Get categories for a specific post
 */
export async function getCategoriesByPostId(
  context: DbContext,
  data: GetCategoriesByPostIdInput,
) {
  return await CategoryRepo.getCategoriesByPostId(context.db, data.postId);
}

// ============ Admin Service Methods ============

async function invalidateCategoryRelatedCache(
  context: DbContext,
  affectedPosts: Array<{ id: number; slug: string }>,
) {
  await CacheService.deleteKey(context, CATEGORIES_CACHE_KEYS.publicList);

  if (affectedPosts.length > 0) {
    const tasks: Array<Promise<void>> = [];
    tasks.push(CacheService.bumpVersion(context, "posts:list"));
    const version = await CacheService.getVersion(context, "posts:detail");
    for (const post of affectedPosts) {
      tasks.push(
        CacheService.deleteKey(
          context,
          POSTS_CACHE_KEYS.detail(version, post.slug),
        ),
      );
    }
    const cdnUrls = ["/", "/posts"];
    for (const post of affectedPosts) {
      cdnUrls.push(postPath(post));
    }
    tasks.push(purgeCDNCache(context.env, { urls: cdnUrls }));
    await Promise.all(tasks);
  } else {
    await Promise.all([
      CacheService.bumpVersion(context, "posts:detail"),
      CacheService.bumpVersion(context, "posts:list"),
      purgeCDNCache(context.env, { urls: ["/", "/posts"] }),
    ]);
  }
}

export const createCategory = async (
  context: DbContext,
  data: CreateCategoryInput,
) => {
  const exists = await CategoryRepo.nameExists(context.db, data.name);
  if (exists) {
    return err({ reason: "CATEGORY_NAME_ALREADY_EXISTS" });
  }

  const all = await CategoryRepo.getAllCategories(context.db);
  const nextSort = all.length;

  const category = await CategoryRepo.insertCategory(context.db, {
    name: data.name,
    description: data.description ?? null,
    sortOrder: nextSort,
    parentId: data.parentId ?? null,
  });

  await CacheService.deleteKey(context, CATEGORIES_CACHE_KEYS.publicList);

  return ok(category);
};

export async function updateCategory(
  context: DbContext & { executionCtx: ExecutionContext },
  data: UpdateCategoryInput,
) {
  const existing = await CategoryRepo.findCategoryById(context.db, data.id);
  if (!existing) {
    return err({ reason: "CATEGORY_NOT_FOUND" });
  }

  if (data.data.name && data.data.name !== existing.name) {
    const exists = await CategoryRepo.nameExists(context.db, data.data.name, {
      excludeId: data.id,
    });
    if (exists) {
      return err({ reason: "CATEGORY_NAME_ALREADY_EXISTS" });
    }
  }

  const affectedPosts = await CategoryRepo.getPublishedPostsByCategoryId(
    context.db,
    data.id,
  );

  // 仅把「显式提供」的字段写入，未提供的保持原值（避免 drizzle 把 undefined 当成置空）
  const updatePayload: Record<string, unknown> = {};
  if (data.data.name !== undefined) updatePayload.name = data.data.name;
  if (data.data.description !== undefined)
    updatePayload.description = data.data.description;
  if (data.data.sortOrder !== undefined)
    updatePayload.sortOrder = data.data.sortOrder;
  if (data.data.parentId !== undefined)
    updatePayload.parentId = data.data.parentId;

  const category = await CategoryRepo.updateCategory(
    context.db,
    data.id,
    updatePayload,
  );

  context.executionCtx.waitUntil(
    invalidateCategoryRelatedCache(context, affectedPosts),
  );

  return ok(category);
}

export async function deleteCategory(
  context: DbContext & { executionCtx: ExecutionContext },
  data: DeleteCategoryInput,
) {
  const category = await CategoryRepo.findCategoryById(context.db, data.id);
  if (!category) {
    return err({ reason: "CATEGORY_NOT_FOUND" });
  }

  // Fetch published posts associated with this category BEFORE deleting
  // (so we can invalidate their caches). The post_categories rows are
  // removed automatically via ON DELETE CASCADE — posts fall into 「未分类」.
  const affectedPosts = await CategoryRepo.getPublishedPostsByCategoryId(
    context.db,
    data.id,
  );

  await CategoryRepo.deleteCategory(context.db, data.id);

  context.executionCtx.waitUntil(
    invalidateCategoryRelatedCache(context, affectedPosts),
  );

  return ok({ success: true });
}

/**
 * Set categories for a post (edit only, no cache invalidation).
 * KV is only refreshed on "publish".
 */
export async function setPostCategories(
  context: DbContext,
  data: SetPostCategoriesInput,
) {
  await CategoryRepo.setPostCategories(
    context.db,
    data.postId,
    data.categoryIds,
  );
  await PostRepo.touchPostUpdatedAt(context.db, data.postId);
}
