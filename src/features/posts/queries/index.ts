import { infiniteQueryOptions, queryOptions } from "@tanstack/react-query";
import type {
  GetPostsCountInput,
  GetPostsInput,
  PostWithToc,
} from "@/features/posts/schema/posts.schema";
import {
  normalizePostTagName,
  PostItemSchema,
  PostListResponseSchema,
  PostPagedResponseSchema,
  PostWithTocSchema,
} from "@/features/posts/schema/posts.schema";
import { apiClient } from "@/lib/api-client";
import { isSSR } from "@/lib/utils";
import { generateTableOfContents } from "@/features/posts/utils/toc";
import {
  getPostRevisionFn,
  listPostRevisionsFn,
} from "../api/post-revisions.admin.api";
import { findPostByIdFn } from "../api/posts.admin.api";
import {
  findPostBySlugFn,
  getPinnedPostsFn,
  getPopularPostsFn,
  getPostsCursorFn,
  getPostsPagedFn,
  getRelatedPostsFn,
} from "../api/posts.public.api";

export const POSTS_KEYS = {
  all: ["posts"] as const,

  // Parent keys (static arrays for prefix invalidation)
  pinned: ["posts", "pinned"] as const,
  lists: ["posts", "list"] as const,
  details: ["posts", "detail"] as const,
  recent: ["posts", "recent"] as const,
  popular: ["posts", "popular"] as const,
  adminLists: ["posts", "admin-list"] as const,
  counts: ["posts", "count"] as const,
  revisions: ["posts", "revisions"] as const,
  revisionDetails: ["posts", "revision-detail"] as const,

  // Child keys (functions for specific queries)
  list: (
    filters: {
      tagName?: string;
      categoryId?: number;
      limit?: number;
      uncategorized?: boolean;
    } = {},
  ) =>
    [
      "posts",
      "list",
      {
        ...filters,
        tagName: normalizePostTagName(filters.tagName),
      },
    ] as const,
  detail: (idOrSlug: number | string) => ["posts", "detail", idOrSlug] as const,
  related: (slug: string, limit?: number) =>
    ["posts", "related", slug, limit] as const,
  adminList: (params: GetPostsInput) =>
    ["posts", "admin-list", params] as const,
  count: (params: GetPostsCountInput) => ["posts", "count", params] as const,
  paged: (
    filters: {
      page?: number;
      tagName?: string;
      categoryId?: number;
      limit?: number;
      uncategorized?: boolean;
      sortBy?: string;
      sortDir?: string;
    } = {},
  ) =>
    [
      "posts",
      "list",
      "paged",
      {
        ...filters,
        tagName: normalizePostTagName(filters.tagName),
      },
    ] as const,
  revisionList: (postId: number) => ["posts", "revisions", postId] as const,
  revisionDetail: (postId: number, revisionId: number) =>
    ["posts", "revision-detail", postId, revisionId] as const,
};

export function recentPostsQuery(limit: number) {
  return queryOptions({
    queryKey: [...POSTS_KEYS.recent, limit],
    queryFn: async () => {
      if (isSSR) {
        const result = await getPostsCursorFn({ data: { limit } });
        return result.items;
      }
      const res = await apiClient.posts.$get({
        query: { limit: String(limit) },
      });
      if (!res.ok) throw new Error("Failed to fetch posts");
      return PostListResponseSchema.parse(await res.json()).items;
    },
  });
}

export function postsInfiniteQueryOptions(
  filters: {
    tagName?: string;
    categoryId?: number;
    limit?: number;
    uncategorized?: boolean;
  } = {},
) {
  const pageSize = filters.limit ?? 12;
  const tagName = normalizePostTagName(filters.tagName);
  const uncategorized = filters.uncategorized;
  const categoryId = filters.categoryId;
  return infiniteQueryOptions({
    queryKey: POSTS_KEYS.list({ ...filters, tagName, uncategorized, categoryId }),
    queryFn: async ({ pageParam }) => {
      if (isSSR) {
        return await getPostsCursorFn({
          data: {
            cursor: pageParam,
            limit: pageSize,
            tagName,
            categoryId,
            uncategorized,
          },
        });
      }
      const res = await apiClient.posts.$get({
        query: {
          cursor: pageParam?.toString(),
          limit: String(pageSize),
          tagName,
          ...(categoryId !== undefined
            ? { categoryId: String(categoryId) }
            : {}),
          ...(uncategorized ? { uncategorized: "1" } : {}),
        },
      });
      if (!res.ok) throw new Error("Failed to fetch posts");
      return PostListResponseSchema.parse(await res.json());
    },
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    initialPageParam: undefined as number | undefined,
  });
}

export function postsPagedQueryOptions(
  filters: {
    page?: number;
    tagName?: string;
    categoryId?: number;
    limit?: number;
    uncategorized?: boolean;
    sortBy?: "publishedAt" | "updatedAt" | "createdAt" | "title";
    sortDir?: "asc" | "desc";
  } = {},
) {
  const page = Math.max(1, filters.page ?? 1);
  const pageSize = filters.limit ?? 12;
  const tagName = normalizePostTagName(filters.tagName);
  const categoryId = filters.categoryId;
  const uncategorized = filters.uncategorized;
  const sortBy = filters.sortBy ?? "publishedAt";
  const sortDir = filters.sortDir ?? "desc";

  return queryOptions({
    queryKey: POSTS_KEYS.paged({
      ...filters,
      page,
      tagName,
      categoryId,
      uncategorized,
      sortBy,
      sortDir,
    }),
    queryFn: async () => {
      const result = await getPostsPagedFn({
        data: {
          page,
          limit: pageSize,
          tagName,
          categoryId,
          uncategorized,
          sortBy,
          sortDir,
        },
      });
      return PostPagedResponseSchema.parse(result);
    },
  });
}

export function postBySlugQuery(slug: string) {
  return queryOptions({
    queryKey: POSTS_KEYS.detail(slug),
    queryFn: async () => {
      if (isSSR) {
        return await findPostBySlugFn({ data: { slug } });
      }
      const res = await apiClient.post[":slug"].$get({ param: { slug } });
      if (!res.ok) throw new Error("Failed to fetch post");
      return PostWithTocSchema.parse(await res.json());
    },
  });
}

export function postByIdQuery(id: number) {
  return queryOptions({
    queryKey: POSTS_KEYS.detail(id),
    queryFn: async () => {
      const res = await findPostByIdFn({ data: { id } });
      if (!res) return null;
      // findPostById 不返回 toc，这里补齐成 PostWithToc，保证详情页目录正常
      return {
        ...PostWithTocSchema.parse({ ...res, toc: generateTableOfContents(res.contentJson) }),
        isSynced: res.isSynced,
        hasPublicCache: res.hasPublicCache,
      } as PostWithToc & { isSynced: boolean; hasPublicCache: boolean };
    },
  });
}

/**
 * 按分类 id 拉取已发布文章的最新 N 篇（首页分类标签使用）。
 * 内部走 `getPostsCursorFn({categoryId, limit})`，只取首页一页。
 */
export function postsByCategoryQuery(categoryId: number, limit: number) {
  return queryOptions({
    queryKey: ["posts", "by-category", categoryId, limit],
    queryFn: async () => {
      if (isSSR) {
        const result = await getPostsCursorFn({
          data: { limit, categoryId },
        });
        return result.items;
      }
      const res = await apiClient.posts.$get({
        query: {
          limit: String(limit),
          categoryId: String(categoryId),
        },
      });
      if (!res.ok) throw new Error("Failed to fetch category posts");
      return PostListResponseSchema.parse(await res.json()).items;
    },
  });
}

export function relatedPostsQuery(slug: string, limit?: number) {
  return queryOptions({
    queryKey: POSTS_KEYS.related(slug, limit),
    queryFn: async () => {
      if (isSSR) {
        return await getRelatedPostsFn({ data: { slug, limit } });
      }
      const res = await apiClient.post[":slug"].related.$get({
        param: { slug },
        query: { limit: limit != null ? String(limit) : undefined },
      });
      if (!res.ok) throw new Error("Failed to fetch related posts");
      const json = await res.json();
      const result = PostItemSchema.array().safeParse(json);
      if (!result.success) {
        console.error(
          JSON.stringify({
            message: "related posts response parse failed",
            error: result.error.message,
            received: typeof json,
          }),
        );
        return [];
      }
      return result.data;
    },
  });
}

export function postRevisionListQuery(postId: number) {
  return queryOptions({
    queryKey: POSTS_KEYS.revisionList(postId),
    queryFn: () => listPostRevisionsFn({ data: { postId } }),
  });
}

export function postRevisionDetailQuery(postId: number, revisionId: number) {
  return queryOptions({
    queryKey: POSTS_KEYS.revisionDetail(postId, revisionId),
    queryFn: async () =>
      (await getPostRevisionFn({ data: { postId, revisionId } })) ?? null,
  });
}

export const pinnedPostsQuery = queryOptions({
  queryKey: POSTS_KEYS.pinned,
  queryFn: () => getPinnedPostsFn(),
});

export function popularPostsQuery(limit?: number) {
  return queryOptions({
    queryKey: [...POSTS_KEYS.popular, limit],
    queryFn: () => getPopularPostsFn({ data: { limit } }),
  });
}
