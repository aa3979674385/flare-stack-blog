import {
  createInsertSchema,
  createSelectSchema,
  createUpdateSchema,
} from "drizzle-zod";
import { z } from "zod";
import { CategoriesTable } from "@/lib/db/schema";

// Date fields need to accept both Date objects and ISO strings (for JSON serialization)
const coercedDate = z.union([z.date(), z.string().pipe(z.coerce.date())]);

export const CategorySelectSchema = createSelectSchema(CategoriesTable, {
  createdAt: coercedDate,
  updatedAt: coercedDate,
});
export const CategoryInsertSchema = createInsertSchema(CategoriesTable);
export const CategoryUpdateSchema = createUpdateSchema(CategoriesTable);

export const CategoryWithCountSchema = CategorySelectSchema.extend({
  postCount: z.number(),
});

// API Input Schemas
export const CreateCategoryInputSchema = z.object({
  name: z.string().min(1).max(50),
  description: z.string().max(200).optional(),
  /** 父分类 id（可空，顶级分类为 null）；支持二级/多级嵌套 */
  parentId: z.number().int().nullable().optional(),
});

export const UpdateCategoryInputSchema = z.object({
  id: z.number(),
  data: z.object({
    name: z.string().min(1).max(50).optional(),
    description: z.string().max(200).optional(),
    sortOrder: z.number().int().optional(),
    parentId: z.number().int().nullable().optional(),
  }),
});

export const DeleteCategoryInputSchema = z.object({
  id: z.number(),
});

export const GetCategoriesInputSchema = z.object({
  sortBy: z.enum(["name", "createdAt", "sortOrder"]).optional(),
  sortDir: z.enum(["asc", "desc"]).optional(),
  withCount: z.boolean().optional(),
  publicOnly: z.boolean().optional(),
});

export const SetPostCategoriesInputSchema = z.object({
  postId: z.number(),
  categoryIds: z.array(z.number()),
});

export const GetCategoriesByPostIdInputSchema = z.object({
  postId: z.number(),
});

// Type exports
export type Category = z.infer<typeof CategorySelectSchema>;
export type CreateCategoryInput = z.infer<typeof CreateCategoryInputSchema>;
export type UpdateCategoryInput = z.infer<typeof UpdateCategoryInputSchema>;
export type DeleteCategoryInput = z.infer<typeof DeleteCategoryInputSchema>;
export type GetCategoriesInput = z.infer<typeof GetCategoriesInputSchema>;
export type SetPostCategoriesInput = z.infer<typeof SetPostCategoriesInputSchema>;
export type GetCategoriesByPostIdInput = z.infer<
  typeof GetCategoriesByPostIdInputSchema
>;
export type CategoryWithCount = z.infer<typeof CategoryWithCountSchema>;

export const CATEGORIES_CACHE_KEYS = {
  publicList: ["public", "categories", "list"] as const,
} as const;
