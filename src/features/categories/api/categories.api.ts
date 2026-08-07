import { createServerFn } from "@tanstack/react-start";
import * as CategoryRepo from "@/features/categories/data/categories.data";
import {
  CreateCategoryInputSchema,
  DeleteCategoryInputSchema,
  GetCategoriesByPostIdInputSchema,
  GetCategoriesInputSchema,
  SetPostCategoriesInputSchema,
  UpdateCategoryInputSchema,
} from "@/features/categories/categories.schema";
import * as CategoryService from "@/features/categories/categories.service";
import { dbMiddleware, requirePermission } from "@/lib/middlewares";

// ============ Public API ============

export const getCategoriesFn = createServerFn()
  .middleware([dbMiddleware])
  .handler(async ({ context }) => {
    return await CategoryService.getPublicCategories(context);
  });

// ============ Admin API ============

export const getCategoriesAdminFn = createServerFn()
  .middleware([requirePermission("config.manage")])
  .inputValidator(GetCategoriesInputSchema)
  .handler(async ({ data, context }) => {
    return await CategoryService.getCategories(context, data);
  });

export const createCategoryFn = createServerFn({
  method: "POST",
})
  .middleware([requirePermission("config.manage")])
  .inputValidator(CreateCategoryInputSchema)
  .handler(({ data, context }) => CategoryService.createCategory(context, data));

export const updateCategoryFn = createServerFn({
  method: "POST",
})
  .middleware([requirePermission("config.manage")])
  .inputValidator(UpdateCategoryInputSchema)
  .handler(({ data, context }) => CategoryService.updateCategory(context, data));

export const deleteCategoryFn = createServerFn({
  method: "POST",
})
  .middleware([requirePermission("config.manage")])
  .inputValidator(DeleteCategoryInputSchema)
  .handler(({ data, context }) => CategoryService.deleteCategory(context, data));

export const setPostCategoriesFn = createServerFn({
  method: "POST",
})
  .middleware([requirePermission("config.manage")])
  .inputValidator(SetPostCategoriesInputSchema)
  .handler(({ data, context }) =>
    CategoryService.setPostCategories(context, data),
  );

export const getCategoriesByPostIdFn = createServerFn()
  .middleware([requirePermission("config.manage")])
  .inputValidator(GetCategoriesByPostIdInputSchema)
  .handler(({ data, context }) =>
    CategoryService.getCategoriesByPostId(context, data),
  );

export const getCategoriesWithCountAdminFn = createServerFn()
  .middleware([requirePermission("config.manage")])
  .inputValidator(GetCategoriesInputSchema)
  .handler(async ({ data, context }) => {
    return await CategoryService.getCategories(context, {
      ...data,
      withCount: true,
    });
  });

/** 未分类兜底桶的文章数量（无分类归属的已发布文章） */
export const getUncategorizedCountFn = createServerFn()
  .middleware([requirePermission("config.manage")])
  .handler(async ({ context }) => {
    return await CategoryRepo.countUncategorizedPosts(context.db);
  });
