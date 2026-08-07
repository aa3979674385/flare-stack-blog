import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import * as PageviewService from "@/features/pageview/service/pageview.service";
import {
  FindPostByIdInputSchema,
  FindPostBySlugInputSchema,
  FindRelatedPostsInputSchema,
  GetPostsCursorInputSchema,
  GetPostsPagedInputSchema,
} from "@/features/posts/schema/posts.schema";
import * as PostService from "@/features/posts/services/posts.service";
import { dbMiddleware } from "@/lib/middlewares";

export const getPostsCursorFn = createServerFn()
  .middleware([dbMiddleware])
  .inputValidator(GetPostsCursorInputSchema)
  .handler(async ({ data, context }) => {
    return await PostService.getPostsCursor(context, data);
  });

export const getPostsPagedFn = createServerFn()
  .middleware([dbMiddleware])
  .inputValidator(GetPostsPagedInputSchema)
  .handler(async ({ data, context }) => {
    return await PostService.getPostsPaged(context, data);
  });

export const findPostBySlugFn = createServerFn()
  .middleware([dbMiddleware])
  .inputValidator(FindPostBySlugInputSchema)
  .handler(async ({ data, context }) => {
    return await PostService.findPostBySlug(context, data);
  });

// 公开「按 id 取文章」serverFn：仅 dbMiddleware，无 requirePermission。
// 供详情页 id 模式的 SSR 使用，使匿名访客整页刷新也能拿到已发布文章（不再走需登录的 admin 接口）。
// 未发布 / 草稿直接返回 null（公开页应 404），避免泄露未公开内容。
export const findPostByIdPublicFn = createServerFn()
  .middleware([dbMiddleware])
  .inputValidator(FindPostByIdInputSchema)
  .handler(async ({ data, context }) => {
    const post = await PostService.findPostById(context, data);
    if (!post || post.status !== "published") return null;
    return post;
  });

export const getRelatedPostsFn = createServerFn()
  .middleware([dbMiddleware])
  .inputValidator(FindRelatedPostsInputSchema)
  .handler(async ({ data, context }) => {
    return await PostService.getRelatedPosts(context, data);
  });

export const getPinnedPostsFn = createServerFn()
  .middleware([dbMiddleware])
  .handler(({ context }) => PostService.getPinnedPosts(context));

export const getPopularPostsFn = createServerFn()
  .middleware([dbMiddleware])
  .inputValidator(
    z.object({ limit: z.number().int().min(1).max(20).optional() }),
  )
  .handler(({ data, context }) =>
    PageviewService.getPopularPosts(context, data.limit),
  );
