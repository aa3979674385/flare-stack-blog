import { z } from "zod";
import { NullableJsonContentSchema } from "@/features/posts/schema/json-content.schema";

export const SearchQuerySchema = z.object({
  q: z.string().min(1),
  limit: z.number().optional().default(10),
  v: z.string(),
});

export const UpsertSearchDocSchema = z.object({
  id: z.number(),
  slug: z.string().min(1),
  title: z.string().min(1),
  summary: z.string().nullable().optional(),
  contentJson: NullableJsonContentSchema.optional(),
  tags: z.array(z.string()).optional(),
  // 封面图：仅随结果返回用于卡片展示，不进分词索引（避免 URL 片段污染搜索）
  coverImage: z.string().nullable().optional(),
  // 收费状态：来自关联下载资源，不进分词索引
  accessType: z.enum(["free", "member", "paid"]).nullable().optional(),
  // 分类名（取第一个分类），不进分词索引
  categoryName: z.string().nullable().optional(),
  // 分类 id（取第一个分类），用于卡片分类药丸跳转 /posts?categoryId=X，不进分词索引
  categoryId: z.number().nullable().optional(),
  // 发布时间，不进分词索引
  publishedAt: z.union([z.date(), z.string(), z.number()]).nullable().optional(),
});

export const DeleteSearchDocSchema = z.object({
  id: z.number(),
});

export type SearchQueryInput = z.infer<typeof SearchQuerySchema>;
export type UpsertSearchDocInput = z.infer<typeof UpsertSearchDocSchema>;
export type DeleteSearchDocInput = z.infer<typeof DeleteSearchDocSchema>;
