import {
  createInsertSchema,
  createSelectSchema,
  createUpdateSchema,
} from "drizzle-zod";
import { z } from "zod";
import { TagSelectSchema } from "@/features/tags/tags.schema";
import { CategorySelectSchema } from "@/features/categories/categories.schema";
import type { Category, Post, PostStatus, Tag } from "@/lib/db/schema";
import { POST_STATUSES, PostsTable } from "@/lib/db/schema";
import { NullableJsonContentSchema } from "./json-content.schema";

// Date fields need to accept both Date objects and ISO strings (for JSON serialization)
const coercedDate = z.union([z.date(), z.string().pipe(z.coerce.date())]);
const coercedDateNullable = coercedDate.nullable();

export const PostSelectSchema = createSelectSchema(PostsTable, {
  publishedAt: coercedDateNullable,
  pinnedAt: coercedDateNullable,
  createdAt: coercedDate,
  updatedAt: coercedDate,
  // 封面图字段在某些查询/缓存中可能缺失，显式允许 undefined，避免详情页 parse 崩溃。
  coverImage: z.string().nullable().optional(),
}).omit({
  publicContentJson: true,
});
export const PostInsertSchema = createInsertSchema(PostsTable);
export const PostUpdateSchema = createUpdateSchema(PostsTable, {
  contentJson: NullableJsonContentSchema.optional(),
  publicContentJson: NullableJsonContentSchema.optional(),
}).omit({
  publicContentJson: true,
});

export const PostItemSchema = PostSelectSchema.omit({
  contentJson: true,
}).extend({
  // 封面图是可选兜底字段：用户未填时后端自动抓取，纯文字文章可为 null/undefined。
  // 因此在列表 schema 中允许缺省，避免构造列表项时硬性要求该字段。
  coverImage: z.string().nullable().optional(),
  tags: z.array(TagSelectSchema).optional(),
  categories: z.array(CategorySelectSchema).optional(),
  // 收费状态来自文章关联的下载资源（post_resource.access_type）；无资源默认免费。
  // 收费状态来自文章关联的下载资源（post_resource.access_type）；无资源默认免费。
  // 列表查询统一通过 batchFetchAccessTypes 批量填充（见 posts.data.ts），运行时字段必然存在；
  // 此处保留 .optional()：Drizzle findMany 的返回类型推断不含该字段，强制必填会触发无谓的编译错误。
  accessType: z.enum(["free", "member", "paid"]).nullable().optional(),
});
export const PostListResponseSchema = z.object({
  items: z.array(PostItemSchema),
  nextCursor: z.number().nullable(),
});
export const PostPagedResponseSchema = z.object({
  items: z.array(PostItemSchema),
  totalCount: z.number(),
  totalPages: z.number(),
  page: z.number(),
  pageSize: z.number(),
});
export const PostWithTocSchema = PostSelectSchema.extend({
  tags: z.array(TagSelectSchema).optional(),
  toc: z.array(
    z.object({
      id: z.string(),
      text: z.string(),
      level: z.number(),
    }),
  ),
}).nullable();

export function normalizePostTagName(
  tagName: string | undefined,
): string | undefined {
  return tagName === "" ? undefined : tagName;
}

export const PostTagNameSchema = z
  .string()
  .transform(normalizePostTagName)
  .optional();

export const GetPostsCursorInputSchema = z.object({
  cursor: z.number().optional(),
  limit: z.number().optional(),
  tagName: PostTagNameSchema,
  /** 按真实分类（独立表）过滤，传分类 id */
  categoryId: z.coerce.number().optional(),
  excludePinned: z.boolean().optional(),
  /** 未分类视图：仅返回未归入任何分类的文章（与标签无关） */
  uncategorized: z.coerce.boolean().optional(),
});

/** 公开文章列表可排序字段（对应 posts 表已建索引/常用列） */
export const POST_SORT_FIELDS = ["publishedAt", "updatedAt", "createdAt", "title"] as const;
export type PostSortField = (typeof POST_SORT_FIELDS)[number];
export const POST_SORT_DIRECTIONS = ["asc", "desc"] as const;
export type PostSortDirection = (typeof POST_SORT_DIRECTIONS)[number];

export const GetPostsPagedInputSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(12),
  tagName: PostTagNameSchema,
  /** 按真实分类（独立表）过滤，传分类 id */
  categoryId: z.coerce.number().optional(),
  /** 未分类视图：仅返回未归入任何分类的文章（与标签无关） */
  uncategorized: z.coerce.boolean().optional(),
  /** 排序字段（默认按发布时间倒序） */
  sortBy: z.enum(POST_SORT_FIELDS).optional().default("publishedAt"),
  /** 排序方向（默认倒序） */
  sortDir: z.enum(POST_SORT_DIRECTIONS).optional().default("desc"),
});

export const FindPostBySlugInputSchema = z.object({
  slug: z.string(),
});

export const FindRelatedPostsInputSchema = z.object({
  slug: z.string(),
  limit: z.number().optional(),
});

export type GetPostsCursorInput = z.infer<typeof GetPostsCursorInputSchema>;
export type GetPostsPagedInput = z.infer<typeof GetPostsPagedInputSchema>;
export type FindPostBySlugInput = z.infer<typeof FindPostBySlugInputSchema>;
export type FindRelatedPostsInput = z.infer<typeof FindRelatedPostsInputSchema>;

// Admin API Schemas
export const GenerateSlugInputSchema = z.object({
  title: z.string().optional(),
  excludeId: z.number().optional(),
});

export const GetPostsInputSchema = z.object({
  offset: z.number().optional(),
  limit: z.number().optional(),
  status: z.custom<PostStatus>().optional(),
  publicOnly: z.boolean().optional(),
  search: z.string().optional(),
  sortDir: z.enum(["ASC", "DESC"]).optional(),
  sortBy: z.enum(["publishedAt", "updatedAt"]).optional(),
});

export const GetPostsCountInputSchema = GetPostsInputSchema.omit({
  offset: true,
  limit: true,
  sortDir: true,
});

export const FindPostByIdInputSchema = z.object({ id: z.number() });

export const UpdatePostInputSchema = z.object({
  id: z.number(),
  data: PostUpdateSchema,
});

export const DeletePostInputSchema = z.object({ id: z.number() });

export const PreviewSummaryInputSchema = PostSelectSchema.pick({
  contentJson: true,
});

export const StartPostProcessInputSchema = z.object({
  id: z.number(),
  status: z.enum(POST_STATUSES),
  clientToday: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

export type GenerateSlugInput = z.infer<typeof GenerateSlugInputSchema>;
export type GetPostsInput = z.infer<typeof GetPostsInputSchema>;
export type GetPostsCountInput = z.infer<typeof GetPostsCountInputSchema>;
export type FindPostByIdInput = z.infer<typeof FindPostByIdInputSchema>;
export type UpdatePostInput = z.infer<typeof UpdatePostInputSchema>;
export type DeletePostInput = z.infer<typeof DeletePostInputSchema>;
export type PreviewSummaryInput = z.infer<typeof PreviewSummaryInputSchema>;
export type StartPostProcessInput = z.infer<typeof StartPostProcessInputSchema>;
export type PostListItem = Omit<
  Post,
  "contentJson" | "publicContentJson" | "coverImage"
> & {
  /** 封面图：列表查询已读取该列；未显式设置时可为空（后端保存时会自动兜底）。 */
  coverImage?: string | null;
  tags?: Array<Tag>;
  categories?: Array<Category>;
  /** 收费状态：free=免费，member=会员专享，paid=收费；来自关联下载资源，无资源为 free。 */
  accessType?: "free" | "member" | "paid" | null;
};

export type PostListResponse = z.infer<typeof PostListResponseSchema>;
export type PostItem = z.infer<typeof PostItemSchema>;
export type PostWithToc = z.infer<typeof PostWithTocSchema>;

export const POSTS_CACHE_KEYS = {
  list: (
    version: string,
    limit: number,
    cursor: number,
    tagName?: string,
    uncategorized?: boolean,
    categoryId?: number,
  ) => {
    const parts: Array<string | number> = [
      "posts",
      "list",
      version,
      limit,
      cursor,
    ];
    if (categoryId !== undefined) parts.push("category", categoryId);
    if (tagName !== undefined) parts.push("tag", tagName);
    parts.push(uncategorized ? "uncategorized" : "all");
    return parts;
  },
  paged: (
    version: string,
    page: number,
    limit: number,
    tagName?: string,
    uncategorized?: boolean,
    categoryId?: number,
    sortBy?: string,
    sortDir?: string,
  ) => {
    const parts: Array<string | number> = [
      "posts",
      "paged",
      version,
      page,
      limit,
      `sort:${sortBy ?? "publishedAt"}:${sortDir ?? "desc"}`,
    ];
    if (categoryId !== undefined) parts.push("category", categoryId);
    if (tagName !== undefined) parts.push("tag", tagName);
    parts.push(uncategorized ? "uncategorized" : "all");
    return parts;
  },
  detail: (version: string, slug: string) => [version, "post", slug] as const,
  related: (slug: string, limit?: number) =>
    ["posts", "related-ids", slug, limit] as const,
  syncHash: (id: number) => `post_hash:${id}` as const,
  pinned: (version: string) => [version, "posts", "pinned"] as const,
} as const;
