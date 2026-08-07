import { createServerFn } from "@tanstack/react-start";
import {
  DeletePostInputSchema,
  FindPostByIdInputSchema,
  FindPostBySlugInputSchema,
  GenerateSlugInputSchema,
  GetPostsCountInputSchema,
  GetPostsInputSchema,
  PreviewSummaryInputSchema,
  StartPostProcessInputSchema,
  UpdatePostInputSchema,
} from "@/features/posts/schema/posts.schema";
import * as PostService from "@/features/posts/services/posts.service";
import { requirePermission } from "@/lib/middlewares";

export const generateSlugFn = createServerFn()
  .middleware([requirePermission("post.create")])
  .inputValidator(GenerateSlugInputSchema)
  .handler(({ data, context }) => PostService.generateSlug(context, data));

export const createEmptyPostFn = createServerFn({
  method: "POST",
})
  .middleware([requirePermission("post.create")])
  .handler(({ context }) => PostService.createEmptyPost(context));

export const getPostsFn = createServerFn()
  .middleware([requirePermission("post.view")])
  .inputValidator(GetPostsInputSchema)
  .handler(({ data, context }) => PostService.getPosts(context, data));

export const getPostsCountFn = createServerFn()
  .middleware([requirePermission("post.view")])
  .inputValidator(GetPostsCountInputSchema)
  .handler(({ data, context }) => PostService.getPostsCount(context, data));

export const findPostBySlugFn = createServerFn()
  .middleware([requirePermission("post.view")])
  .inputValidator(FindPostBySlugInputSchema)
  .handler(({ data, context }) =>
    PostService.findPostBySlugAdmin(context, data),
  );

export const findPostByIdFn = createServerFn()
  .middleware([requirePermission("post.view")])
  .inputValidator(FindPostByIdInputSchema)
  .handler(({ data, context }) => PostService.findPostById(context, data));

export const updatePostFn = createServerFn({
  method: "POST",
})
  .middleware([requirePermission("post.create")])
  .inputValidator(UpdatePostInputSchema)
  .handler(({ data, context }) => PostService.updatePost(context, data));

export const deletePostFn = createServerFn({
  method: "POST",
})
  .middleware([requirePermission("post.manage")])
  .inputValidator(DeletePostInputSchema)
  .handler(({ data, context }) => PostService.deletePost(context, data));

export const previewSummaryFn = createServerFn({
  method: "POST",
})
  .middleware([requirePermission("post.create")])
  .inputValidator(PreviewSummaryInputSchema)
  .handler(({ data, context }) => PostService.previewSummary(context, data));

export const startPostProcessWorkflowFn = createServerFn()
  .middleware([requirePermission("post.create")])
  .inputValidator(StartPostProcessInputSchema)
  .handler(({ data, context }) =>
    PostService.startPostProcessWorkflow(context, data),
  );
