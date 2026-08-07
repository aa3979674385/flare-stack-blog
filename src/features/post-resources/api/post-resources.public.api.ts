import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { user } from "@/lib/db/schema";
import type { ResourceLink } from "@/lib/db/schema/post-resources.table";
import { authMiddleware, sessionMiddleware } from "@/lib/middlewares";
import { getSystemConfig } from "@/features/config/service/config.service";
import * as PostResourcesData from "../data/post-resources.data";

const postIdSchema = z.object({ postId: z.number().int().positive() });

const myOrdersSchema = z.object({
  offset: z.number().int().min(0).default(0),
  limit: z.number().int().min(1).max(100).default(20),
});

export interface PublicResourceView {
  id: string;
  title: string;
  /** 解压码（压缩包密码）。原「说明」字段改造而来。当「收费时隐藏解压码」开启且资源为收费且用户未解锁时，此处为 null（不下发）。 */
  extractCode: string | null;
  accessType: "free" | "member" | "paid";
  /** 结算用的积分类型：points=普通积分，credits=会员积分 */
  priceType: "points" | "credits";
  access: {
    accessible: boolean;
    /** 应付积分（0=免费） */
    userPrice: number;
    /** 折算人民币（元），仅用于展示与支付兜底 */
    rmbEquivalent: number;
    reason: PostResourcesData.AccessReason;
    locked: boolean;
  };
  /** 仅当 accessible 时返回真实网盘链接，避免泄露给无权用户 */
  links: ResourceLink[];
  isMember: boolean;
  /** 全局配置：多少积分 = 1 元 */
  pointsPerYuan: number;
  /** 全局配置：是否已接入支付网关 */
  paymentEnabled: boolean;
}

/**
 * 公开列表：返回文章的下载资源，并基于当前用户（会员/已购）计算可见性与应付积分价。
 * 关键安全点：locked 资源的 links 一律为空，真实链接不会泄露给无权限用户。
 */
export const listPublicPostResourcesFn = createServerFn()
  .middleware([sessionMiddleware])
  .inputValidator(postIdSchema)
  .handler(async ({ data, context }): Promise<PublicResourceView[]> => {
    const resources = await PostResourcesData.listResourcesByPost(
      context.db,
      data.postId,
    );
    if (resources.length === 0) return [];

    const cfg = await getSystemConfig(context);
    const pointsPerYuan = cfg.points?.pointsPerYuan ?? 10;
    const paymentEnabled = cfg.points?.paymentEnabled ?? false;

    const sessionUser = context.session?.user;
    const notLoggedIn = !sessionUser;

    let isMember = false;
    const orderStatus = new Map<string, string>();
    if (sessionUser) {
      const u = await context.db.query.user.findFirst({
        where: eq(user.id, sessionUser.id),
        columns: { membershipPlanId: true, membershipExpiresAt: true },
      });
      isMember = PostResourcesData.isUserMember(u);
      const orders = await PostResourcesData.listOrdersByUser(
        context.db,
        sessionUser.id,
        resources.map((r) => r.id),
      );
      for (const o of orders) orderStatus.set(o.resourceId, o.status);
    }

    return resources.map((r) => {
      const access = PostResourcesData.computeAccess(r, {
        isMember,
        orderStatus: notLoggedIn ? null : (orderStatus.get(r.id) ?? null),
        pointsPerYuan,
      });
      // 未登录：一律按「需登录」处理，不暴露任何真实链接（含本地附件直链与外链）。
      const accessible = !notLoggedIn && access.accessible;
      const reason: PostResourcesData.AccessReason = notLoggedIn
        ? "login_required"
        : access.reason;
      // 「收费时隐藏解压码」：仅当资源为收费(paid)且开关开启时，未解锁（含未登录）用户看不到解压码。
      // 与 links 同策略——接口 JSON 里直接置 null，前端 / 审查元素均拿不到，解锁后才下发。
      const hideCode = r.accessType === "paid" && r.hideCodeWhenPaid === 1;
      const extractCodeValue = hideCode && !accessible ? null : (r.extractCode ?? null);
      return {
        id: r.id,
        title: r.title,
        extractCode: extractCodeValue,
        accessType: r.accessType,
        priceType: r.priceType,
        access: {
          accessible,
          userPrice: access.userPrice,
          rmbEquivalent: access.rmbEquivalent,
          reason,
          locked: access.locked,
        },
        // 仅在登录且已解锁时下发链接；外链（非本地附件）重写为本站 /dl/... 中转路径，
        // 真实网盘地址只在服务端中转时下发，前端 / 审查元素 / 接口 JSON 均拿不到。
        links: accessible
          ? r.links.map((l, idx) =>
              l.type === "本地附件" ? l : { ...l, url: `/dl/${r.id}/${idx}` },
            )
          : [],
        isMember,
        pointsPerYuan,
        paymentEnabled,
      };
    });
  });

/** 解锁（积分兑换 / 人民币支付兜底）：必须登录。 */
export const unlockPostResourceFn = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .inputValidator(z.object({ resourceId: z.string().min(1) }))
  .handler(async ({ data, context }): Promise<PostResourcesData.UnlockResult> => {
    const resource = await PostResourcesData.getResourceById(
      context.db,
      data.resourceId,
    );
    if (!resource) throw new Error("资源不存在");
    const u = await context.db.query.user.findFirst({
      where: eq(user.id, context.session.user.id),
      columns: { membershipPlanId: true, membershipExpiresAt: true },
    });
    const isMember = PostResourcesData.isUserMember(u);
    const cfg = await getSystemConfig(context);
    return PostResourcesData.unlockResource(context.db, {
      resource,
      userId: context.session.user.id,
      isMember,
      pointsPerYuan: cfg.points?.pointsPerYuan ?? 10,
      paymentEnabled: cfg.points?.paymentEnabled ?? false,
    });
  });

/**
 * 前台：当前登录用户自己的购买记录（分页）。
 * 仅返回本人订单，绝不泄露他人数据。必须登录（authMiddleware）。
 */
export const listMyPurchaseOrdersFn = createServerFn()
  .middleware([authMiddleware])
  .inputValidator(myOrdersSchema)
  .handler(
    async ({ data, context }): Promise<PostResourcesData.ListPurchaseOrdersResult> => {
      return PostResourcesData.listPurchaseOrders(context.db, {
        offset: data.offset,
        limit: data.limit,
        userId: context.session.user.id,
      });
    },
  );

const logDownloadSchema = z.object({
  resourceId: z.string().min(1),
  fileUrl: z.string().min(1),
  fileName: z.string().max(200).nullable().optional(),
});

/**
 * 前台：用户点击「本地附件」下载时记录一次下载。
 * 仅当该用户对该资源具有访问权限（已购买 / 会员免费 / 免费资源）时才记录，
 * 否则抛错——避免未授权用户借此探测下载行为。未登录用户（免费资源游客）不会触发记录。
 */
export const logResourceDownloadFn = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .inputValidator(logDownloadSchema)
  .handler(async ({ data, context }) => {
    const resource = await PostResourcesData.getResourceById(
      context.db,
      data.resourceId,
    );
    if (!resource) throw new Error("资源不存在");
    const u = await context.db.query.user.findFirst({
      where: eq(user.id, context.session.user.id),
      columns: { membershipPlanId: true, membershipExpiresAt: true },
    });
    const isMember = PostResourcesData.isUserMember(u);
    const order = await PostResourcesData.getOrder(
      context.db,
      context.session.user.id,
      data.resourceId,
    );
    const access = PostResourcesData.computeAccess(resource, {
      isMember,
      orderStatus: order?.status ?? null,
      pointsPerYuan: 10,
    });
    if (!access.accessible) throw new Error("无权下载该资源");
    await PostResourcesData.logResourceDownload(context.db, {
      orderId: order?.id ?? null,
      resourceId: data.resourceId,
      userId: context.session.user.id,
      fileUrl: data.fileUrl,
      fileName: data.fileName ?? null,
    });
    return { ok: true as const };
  });

/**
 * 前台：查询当前登录用户今日已下载的「不同文章」篇数 + 上限。
 * 普通用户取 normalUserDaily，会员用户取 memberDaily（来自后台 downloadLimit 配置）。
 * 用于下载框展示「今日剩余 N 篇」并做前端拦截。unlimited=true 表示后台未设上限。
 */
export const getMyDailyDownloadQuotaFn = createServerFn()
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const userId = context.session.user.id;
    const u = await context.db.query.user.findFirst({
      where: eq(user.id, userId),
      columns: { membershipPlanId: true, membershipExpiresAt: true },
    });
    const isMember = PostResourcesData.isUserMember(u);
    const cfg = await getSystemConfig(context);
    const limit = isMember
      ? cfg.downloadLimit?.memberDaily ?? 0
      : cfg.downloadLimit?.normalUserDaily ?? 0;
    const { dayStartMs, dayEndMs } = PostResourcesData.getDayWindow();
    const used = await PostResourcesData.countDistinctDailyArticleDownloads(
      context.db,
      userId,
      dayStartMs,
      dayEndMs,
    );
    return {
      used,
      limit,
      unlimited: limit === 0,
      isMember,
      remaining: limit === 0 ? -1 : Math.max(0, limit - used),
    };
  });
