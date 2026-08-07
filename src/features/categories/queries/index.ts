import { queryOptions } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { isSSR } from "@/lib/utils";
import {
  getCategoriesAdminFn,
  getCategoriesByPostIdFn,
  getCategoriesFn,
  getCategoriesWithCountAdminFn,
} from "../api/categories.api";
import type { GetCategoriesInput } from "../categories.schema";

export const CATEGORIES_KEYS = {
  all: ["categories"] as const,
  public: ["categories", "public"] as const,
  admin: ["categories", "admin"] as const,
  adminWithCount: ["categories", "admin", "with-count"] as const,
  postCategories: (postId: number) => ["post", postId, "categories"] as const,
};

export const categoriesQueryOptions = queryOptions({
  queryKey: CATEGORIES_KEYS.public,
  queryFn: async () => {
    if (isSSR) {
      return await getCategoriesFn();
    }
    const res = await apiClient.categories.$get();
    if (!res.ok) throw new Error("加载分类失败");
    return res.json();
  },
});

export function categoriesAdminQueryOptions(options: GetCategoriesInput = {}) {
  return queryOptions({
    queryKey: [...CATEGORIES_KEYS.admin, options],
    queryFn: () => getCategoriesAdminFn({ data: options }),
    staleTime: Infinity,
  });
}

export function categoriesByPostIdQueryOptions(postId: number) {
  return queryOptions({
    queryKey: CATEGORIES_KEYS.postCategories(postId),
    queryFn: () => getCategoriesByPostIdFn({ data: { postId } }),
  });
}

export function categoriesWithCountAdminQueryOptions(
  options: GetCategoriesInput = {},
) {
  return queryOptions({
    queryKey: [...CATEGORIES_KEYS.adminWithCount, options],
    queryFn: () => getCategoriesWithCountAdminFn({ data: options }),
    staleTime: Infinity,
  });
}
