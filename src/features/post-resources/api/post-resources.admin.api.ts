import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { recordAdminLog } from "@/features/admin-log/service/admin-log.service";
import { bumpVersion } from "@/features/cache/cache.service";
import * as Storage from "@/features/media/data/media.storage";
import { requirePermission } from "@/lib/middlewares";
import * as PostResourcesData from "../data/post-resources.data";

const linkSchema = z.object({
  type: z.string().trim().min(1, "请选择网盘类型").max(20),
  // 允许外链(http/https) 或站点内相对路径（如上传本地附件后得到的 /images/...）
  url: z
    .string()
    .trim()
    .min(1, "请填写链接")
    .max(2000)
    .refine(
      (v) => /^https?:\/\//i.test(v) || v.startsWith("/"),
      "链接格式不正确（需为 http(s) 链接或站点内相对路径 /...）",
    ),
  password: z.string().max(50).nullable().optional(),
});

const resourceInputSchema = z.object({
  postId: z.number().int().positive(),
  title: z.string().trim().max(100).default(""),
  extractCode: z.string().max(500).nullable().optional(),
  hideCodeWhenPaid: z.boolean().default(false),
  links: z.array(linkSchema).min(1, "至少添加一个网盘链接").max(20),
  accessType: z.enum(["free", "member", "paid"]).default("free"),
  // 资源以「积分」计价（系统无人民币充值，人民币由积分按比例折算）；可选普通积分或会员积分
  priceType: z.enum(["points", "credits"]).default("points"),
  priceAmount: z
    .number()
    .int("积分数必须为整数")
    .nonnegative("积分数不能为负")
    .default(0),
  memberAccess: z
    .enum(["none", "free", "required", "discount"])
    .default("none"),
  // 会员折扣系数 1-10（memberAccess=discount 时生效）：1=1折 … 10=不打折
  memberDiscount: z.number().int().min(1).max(10).default(10),
  sortOrder: z.number().int().default(0),
});

const idOnlySchema = z.object({ id: z.string().min(1) });

const updateSchema = resourceInputSchema
  .partial()
  .extend({ id: z.string().min(1) });

const reorderSchema = z.object({
  orderedIds: z.array(z.string().min(1)).min(1),
});

export const listPostResourcesFn = createServerFn()
  .middleware([requirePermission("post.manage")])
  .inputValidator(z.object({ postId: z.number().int().positive() }))
  .handler(async ({ data, context }) => {
    return PostResourcesData.listResourcesByPost(context.db, data.postId);
  });

export const createPostResourceFn = createServerFn({ method: "POST" })
  .middleware([requirePermission("post.manage")])
  .inputValidator(resourceInputSchema)
  .handler(async ({ data, context }) => {
    const id = crypto.randomUUID();
    const row = await PostResourcesData.insertResource(context.db, {
      id,
      ...data,
    });
    // 资源创建会改变文章 accessType，需刷新列表缓存
    await bumpVersion(context, "posts:list");
    await recordAdminLog(context.db, context.session.user, {
      action: "post_resource.create",
      targetType: "post_resource",
      targetId: id,
      targetName: data.title,
      detail: null,
    });
    return row;
  });

export const updatePostResourceFn = createServerFn({ method: "POST" })
  .middleware([requirePermission("post.manage")])
  .inputValidator(updateSchema)
  .handler(async ({ data, context }) => {
    const { id, ...rest } = data;
    const existing = await PostResourcesData.getResourceById(context.db, id);
    if (!existing) throw new Error("资源不存在");
    await PostResourcesData.updateResource(context.db, id, rest);
    // 资源修改可能改变文章 accessType，需刷新列表缓存
    await bumpVersion(context, "posts:list");
    await recordAdminLog(context.db, context.session.user, {
      action: "post_resource.update",
      targetType: "post_resource",
      targetId: id,
      targetName: existing.title,
      detail: null,
    });
  });

export const deletePostResourceFn = createServerFn({ method: "POST" })
  .middleware([requirePermission("post.manage")])
  .inputValidator(idOnlySchema)
  .handler(async ({ data, context }) => {
    const existing = await PostResourcesData.getResourceById(
      context.db,
      data.id,
    );
    if (!existing) throw new Error("资源不存在");
    await PostResourcesData.deleteResource(context.db, data.id);
    // 资源删除会改变文章 accessType（回归免费），需刷新列表缓存
    await bumpVersion(context, "posts:list");
    await recordAdminLog(context.db, context.session.user, {
      action: "post_resource.delete",
      targetType: "post_resource",
      targetId: data.id,
      targetName: existing.title,
      detail: null,
    });
  });

export const reorderPostResourcesFn = createServerFn({ method: "POST" })
  .middleware([requirePermission("post.manage")])
  .inputValidator(reorderSchema)
  .handler(async ({ data, context }) => {
    await PostResourcesData.reorderResources(context.db, data.orderedIds);
  });

/* ======================= 购买记录 / 下载记录（后台审计） ======================= */

const listPurchaseOrdersSchema = z.object({
  offset: z.number().int().nonnegative(),
  limit: z.number().int().positive().max(100),
  orderNo: z.string().optional(),
  userId: z.string().optional(),
  keyword: z.string().optional(),
});

/** 后台：购买记录列表（支持按订单号 / 用户 / 关键字搜索）。需 post.manage 权限。 */
export const listPurchaseOrdersFn = createServerFn()
  .middleware([requirePermission("post.manage")])
  .inputValidator(listPurchaseOrdersSchema)
  .handler(async ({ data, context }) =>
    PostResourcesData.listPurchaseOrders(context.db, {
      offset: data.offset,
      limit: data.limit,
      orderNo: data.orderNo,
      userId: data.userId,
      keyword: data.keyword,
    }),
  );

const listResourceDownloadsSchema = z.object({
  offset: z.number().int().nonnegative(),
  limit: z.number().int().positive().max(100),
  keyword: z.string().optional(),
});

/** 后台：附件下载记录列表（支持关键字搜索）。需 post.manage 权限。 */
export const listResourceDownloadsFn = createServerFn()
  .middleware([requirePermission("post.manage")])
  .inputValidator(listResourceDownloadsSchema)
  .handler(async ({ data, context }) =>
    PostResourcesData.listResourceDownloads(context.db, {
      offset: data.offset,
      limit: data.limit,
      keyword: data.keyword,
    }),
  );

/* ======================= 删除 / 清空（后台审计） ======================= */

const deleteByIdsSchema = z.object({
  ids: z.array(z.string().min(1)).max(500),
});

/** 批量删除购买记录（按 id）。需 post.manage 权限。 */
export const deletePurchaseOrdersFn = createServerFn({ method: "POST" })
  .middleware([requirePermission("post.manage")])
  .inputValidator(deleteByIdsSchema)
  .handler(async ({ data, context }) =>
    PostResourcesData.deletePurchaseOrders(context.db, data.ids),
  );

/** 清空全部购买记录。需 post.manage 权限。 */
export const clearPurchaseOrdersFn = createServerFn({ method: "POST" })
  .middleware([requirePermission("post.manage")])
  .handler(async ({ context }) =>
    PostResourcesData.clearPurchaseOrders(context.db),
  );

/** 批量删除附件下载记录（按 id）。需 post.manage 权限。 */
export const deleteResourceDownloadsFn = createServerFn({ method: "POST" })
  .middleware([requirePermission("post.manage")])
  .inputValidator(deleteByIdsSchema)
  .handler(async ({ data, context }) =>
    PostResourcesData.deleteResourceDownloads(context.db, data.ids),
  );

/** 清空全部附件下载记录。需 post.manage 权限。 */
export const clearResourceDownloadsFn = createServerFn({ method: "POST" })
  .middleware([requirePermission("post.manage")])
  .handler(async ({ context }) =>
    PostResourcesData.clearResourceDownloads(context.db),
  );

/**
 * 上传「本地附件」：将文件存入 R2，返回站点内可访问的相对路径（/images/...）。
 * 与媒体库 uploadImageFn 不同：不限制文件类型（任意附件），仅限制大小（50MB），
 * 所需权限为 post.manage（与资源编辑弹窗一致）。
 */
export const uploadResourceAttachmentFn = createServerFn({ method: "POST" })
  .middleware([requirePermission("post.manage")])
  .inputValidator(z.instanceof(FormData))
  .handler(async ({ data, context }) => {
    const file = data.get("file");
    if (!(file instanceof File)) {
      throw new Error("请提供要上传的附件文件");
    }
    const MAX = 50 * 1024 * 1024; // 50MB
    if (file.size > MAX) {
      throw new Error("附件大小不能超过 50MB");
    }
    const uploaded = await Storage.putToR2(context.env, file);
    return {
      url: uploaded.url,
      fileName: uploaded.fileName,
      mimeType: uploaded.mimeType,
      sizeInBytes: uploaded.sizeInBytes,
    };
  });
