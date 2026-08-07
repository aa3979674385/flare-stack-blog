import { and, desc, eq, gte, inArray, like, lte, or, sql } from "drizzle-orm";
import { DEFAULT_CONFIG } from "@/features/config/config.schema";
import * as ConfigRepo from "@/features/config/data/config.data";
import {
  adjustPoints,
  recordPointTransaction,
} from "@/features/users/data/users.data";
import type { DB } from "@/lib/db";
import {
  postResource,
  postResourceDownload,
  postResourceOrder,
  user,
} from "@/lib/db/schema";
import type { ResourceLink } from "@/lib/db/schema/post-resources.table";

/* ======================= 会员状态判定 ======================= */

/** 判断用户是否为有效会员：需关联了套餐，且（未设到期时间=永久 或 到期时间在未来）。 */
export function isUserMember(
  u?: {
    membershipPlanId?: string | null;
    membershipExpiresAt?: Date | null;
  } | null,
): boolean {
  if (!u || !u.membershipPlanId) return false;
  if (!u.membershipExpiresAt) return true;
  return new Date(u.membershipExpiresAt).getTime() > Date.now();
}

/* ======================= 资源 CRUD ======================= */

export interface ResourceInput {
  postId: number;
  title: string;
  extractCode?: string | null;
  hideCodeWhenPaid?: boolean;
  links: ResourceLink[];
  accessType: "free" | "member" | "paid";
  /** 结算用的积分类型：points=普通积分，credits=会员积分（双积分制） */
  priceType: "points" | "credits";
  /** 积分整数（价格） */
  priceAmount: number;
  memberAccess: "none" | "free" | "required" | "discount";
  /** 会员折扣系数 1-10（仅 memberAccess=discount 生效）：1=1折 … 10=不打折 */
  memberDiscount: number;
  sortOrder?: number;
}

export async function listResourcesByPost(
  db: DB,
  postId: number,
): Promise<Array<typeof postResource.$inferSelect>> {
  return db
    .select()
    .from(postResource)
    .where(eq(postResource.postId, postId))
    .orderBy(postResource.sortOrder, desc(postResource.createdAt));
}

export async function getResourceById(db: DB, id: string) {
  const rows = await db
    .select()
    .from(postResource)
    .where(eq(postResource.id, id))
    .limit(1);
  return rows[0] ?? null;
}

export async function insertResource(
  db: DB,
  input: ResourceInput & { id: string },
) {
  // DB 列 hide_code_when_paid 为 integer(0/1)，而应用层使用 boolean，写入前转换。
  const { hideCodeWhenPaid, ...rest } = input;
  const [row] = await db
    .insert(postResource)
    .values({ ...rest, hideCodeWhenPaid: hideCodeWhenPaid ? 1 : 0 })
    .returning();
  return row;
}

export async function updateResource(
  db: DB,
  id: string,
  input: Partial<ResourceInput>,
) {
  // DB 列 hide_code_when_paid 为 integer(0/1)，而应用层使用 boolean，写入前转换（未提供时不更新该列）。
  const { hideCodeWhenPaid, ...rest } = input;
  const setValues =
    hideCodeWhenPaid === undefined
      ? rest
      : { ...rest, hideCodeWhenPaid: hideCodeWhenPaid ? 1 : 0 };
  await db.update(postResource).set(setValues).where(eq(postResource.id, id));
}

export async function deleteResource(db: DB, id: string) {
  await db.delete(postResource).where(eq(postResource.id, id));
}

/** 重新排序：传入某个文章下全部资源 id 的目标顺序（从 0 递增）。 */
export async function reorderResources(
  db: DB,
  orderedIds: string[],
): Promise<void> {
  for (let i = 0; i < orderedIds.length; i++) {
    await db
      .update(postResource)
      .set({ sortOrder: i })
      .where(eq(postResource.id, orderedIds[i]));
  }
}

/* ======================= 解锁 / 订单 ======================= */

export async function getOrder(db: DB, userId: string, resourceId: string) {
  const rows = await db
    .select()
    .from(postResourceOrder)
    .where(
      and(
        eq(postResourceOrder.userId, userId),
        eq(postResourceOrder.resourceId, resourceId),
      ),
    )
    .limit(1);
  return rows[0] ?? null;
}

export async function listOrdersByUser(
  db: DB,
  userId: string,
  resourceIds: string[],
) {
  if (resourceIds.length === 0)
    return [] as Array<typeof postResourceOrder.$inferSelect>;
  return db
    .select()
    .from(postResourceOrder)
    .where(
      and(
        eq(postResourceOrder.userId, userId),
        // 多资源场景：只要命中其中任一 resourceId 即视为该用户的合法订单
        or(...resourceIds.map((id) => eq(postResourceOrder.resourceId, id))),
      ),
    );
}

/** 生成人类可读的订单号：PR + YYYYMMDD + 6 位随机大写字母数字。 */
export function generateOrderNo(): string {
  const d = new Date();
  const ymd =
    `${d.getFullYear()}` +
    `${String(d.getMonth() + 1).padStart(2, "0")}` +
    `${String(d.getDate()).padStart(2, "0")}`;
  const rand = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `PR${ymd}${rand}`;
}

export async function createOrder(
  db: DB,
  input: {
    id: string;
    resourceId: string;
    userId: string;
    priceType: "rmb" | "points" | "credits";
    amount: number;
    status: "paid" | "pending" | "free";
    orderNo?: string;
  },
) {
  // 购买记录开关关闭时不写入订单（records.purchaseLog 缺省视为开启）。
  // 注意：订单同时是付费下载的访问凭证，关闭后已支付资源将无法下载
  //（用户已明确接受此风险：关闭即不再落库购买订单）。
  const pcfg = await ConfigRepo.getSystemConfig(db);
  if (pcfg?.records?.purchaseLog === false) return null;

  const [row] = await db
    .insert(postResourceOrder)
    .values({
      ...input,
      orderNo: input.orderNo ?? generateOrderNo(),
    })
    .returning();
  return row;
}

/* ======================= 购买记录（后台审计） ======================= */

export interface ListPurchaseOrdersInput {
  offset: number;
  limit: number;
  /** 精确匹配订单号 */
  orderNo?: string;
  /** 精确匹配用户 id */
  userId?: string;
  /** 关键字：资源标题 / 用户名 / 用户邮箱 / 订单号 模糊匹配 */
  keyword?: string;
}

export interface PurchaseOrderRow {
  id: string;
  orderNo: string | null;
  resourceId: string;
  resourceTitle: string | null;
  /** 资源所属文章 id（用于「已购资源」跳转到 /post/$slug）。 */
  postId: number | null;
  userId: string;
  userName: string | null;
  userEmail: string | null;
  priceType: "points" | "credits" | "rmb" | null;
  amount: number | null;
  status: string;
  createdAt: Date | null;
}

export interface ListPurchaseOrdersResult {
  items: PurchaseOrderRow[];
  total: number;
}

export async function listPurchaseOrders(
  db: DB,
  input: ListPurchaseOrdersInput,
): Promise<ListPurchaseOrdersResult> {
  const conditions = [];
  if (input.orderNo)
    conditions.push(eq(postResourceOrder.orderNo, input.orderNo));
  if (input.userId) conditions.push(eq(postResourceOrder.userId, input.userId));
  if (input.keyword) {
    const kw = `%${input.keyword}%`;
    conditions.push(
      or(
        like(postResource.title, kw),
        like(user.name, kw),
        like(user.email, kw),
        like(postResourceOrder.orderNo, kw),
      )!,
    );
  }
  const where = conditions.length ? and(...conditions) : undefined;

  const rows = await db
    .select({
      id: postResourceOrder.id,
      orderNo: postResourceOrder.orderNo,
      resourceId: postResourceOrder.resourceId,
      resourceTitle: postResource.title,
      postId: postResource.postId,
      userId: postResourceOrder.userId,
      userName: user.name,
      userEmail: user.email,
      priceType: postResourceOrder.priceType,
      amount: postResourceOrder.amount,
      status: postResourceOrder.status,
      createdAt: postResourceOrder.createdAt,
    })
    .from(postResourceOrder)
    .leftJoin(postResource, eq(postResourceOrder.resourceId, postResource.id))
    .leftJoin(user, eq(postResourceOrder.userId, user.id))
    .where(where)
    .orderBy(desc(postResourceOrder.createdAt))
    .limit(input.limit)
    .offset(input.offset);

  const [{ total }] = await db
    .select({ total: sql<number>`count(*)` })
    .from(postResourceOrder)
    .leftJoin(postResource, eq(postResourceOrder.resourceId, postResource.id))
    .leftJoin(user, eq(postResourceOrder.userId, user.id))
    .where(where);

  return { items: rows as PurchaseOrderRow[], total: Number(total) };
}

/* ======================= 附件下载记录（后台审计） ======================= */

export interface LogResourceDownloadInput {
  orderId?: string | null;
  resourceId: string;
  userId: string;
  fileUrl: string;
  fileName?: string | null;
}

/**
 * 计算当天 00:00（含）与次日 00:00（不含）的毫秒时间戳，按服务器本地日期。
 * 用于「每日下载次数」按自然日窗口统计。
 */
export function getDayWindow(now: Date = new Date()): {
  dayStartMs: number;
  dayEndMs: number;
} {
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const dayStartMs = start.getTime();
  return { dayStartMs, dayEndMs: dayStartMs + 24 * 60 * 60 * 1000 };
}

/**
 * 统计某用户当天已下载的「不同文章」篇数。
 * 按 postResource.postId 去重，因此同一篇文章下的多个资源、或同一资源重复下载，
 * 在当天都只计为 1 篇（符合「同一天下载同一文章不计数」的口径）。免费 / 收费均计入。
 */
export async function countDistinctDailyArticleDownloads(
  db: DB,
  userId: string,
  dayStartMs: number,
  dayEndMs: number,
): Promise<number> {
  const rows = await db
    .select({ cnt: sql<number>`count(distinct ${postResource.postId})` })
    .from(postResourceDownload)
    .innerJoin(
      postResource,
      eq(postResourceDownload.resourceId, postResource.id),
    )
    .where(
      and(
        eq(postResourceDownload.userId, userId),
        gte(postResourceDownload.createdAt, new Date(dayStartMs)),
        lte(postResourceDownload.createdAt, new Date(dayEndMs)),
      ),
    );
  return Number(rows[0]?.cnt ?? 0);
}

/**
 * 记录一次附件下载，并在写库前做「每日下载配额」校验：
 * - 普通用户取 normalUserDaily，会员用户取 memberDaily（来自后台 downloadLimit 配置）；
 * - 上限为 0 视为不限；
 * - 超过当日「不同文章」下载上限则抛错，由调用方（本地附件 serverFn / 外链中转路由）捕获处理。
 */
export async function logResourceDownload(
  db: DB,
  input: LogResourceDownloadInput,
): Promise<void> {
  const u = await db.query.user.findFirst({
    where: eq(user.id, input.userId),
    columns: { membershipPlanId: true, membershipExpiresAt: true },
  });
  const isMember = isUserMember(u);
  const raw = await ConfigRepo.getSystemConfig(db);
  const dl = raw?.downloadLimit ??
    DEFAULT_CONFIG.downloadLimit ?? {
      normalUserDaily: 0,
      memberDaily: 0,
    };
  const limit = isMember ? dl.memberDaily : dl.normalUserDaily;

  if (limit > 0) {
    const { dayStartMs, dayEndMs } = getDayWindow();
    const used = await countDistinctDailyArticleDownloads(
      db,
      input.userId,
      dayStartMs,
      dayEndMs,
    );
    if (used >= limit) {
      throw new Error(`今日下载次数已达上限（${limit} 篇/天）`);
    }
  }

  // 附件下载记录开关关闭时不记录（records.downloadLog 缺省视为开启）。
  // 注意：上面的「每日下载配额」校验仍正常生效，仅跳过日志写入行。
  const dlCfg = await ConfigRepo.getSystemConfig(db);
  if (dlCfg?.records?.downloadLog === false) return;

  await db.insert(postResourceDownload).values({
    id: crypto.randomUUID(),
    orderId: input.orderId ?? null,
    resourceId: input.resourceId,
    userId: input.userId,
    fileUrl: input.fileUrl,
    fileName: input.fileName ?? null,
  });
}

export interface ListResourceDownloadsInput {
  offset: number;
  limit: number;
  keyword?: string;
}

export interface ResourceDownloadRow {
  id: string;
  orderId: string | null;
  resourceId: string;
  resourceTitle: string | null;
  userId: string;
  userName: string | null;
  userEmail: string | null;
  fileUrl: string;
  fileName: string | null;
  createdAt: Date | null;
}

export interface ListResourceDownloadsResult {
  items: ResourceDownloadRow[];
  total: number;
}

export async function listResourceDownloads(
  db: DB,
  input: ListResourceDownloadsInput,
): Promise<ListResourceDownloadsResult> {
  const conditions = [];
  if (input.keyword) {
    const kw = `%${input.keyword}%`;
    conditions.push(
      or(
        like(postResource.title, kw),
        like(user.name, kw),
        like(user.email, kw),
        like(postResourceDownload.fileName, kw),
        like(postResourceDownload.fileUrl, kw),
      )!,
    );
  }
  const where = conditions.length ? and(...conditions) : undefined;

  const rows = await db
    .select({
      id: postResourceDownload.id,
      orderId: postResourceDownload.orderId,
      resourceId: postResourceDownload.resourceId,
      resourceTitle: postResource.title,
      userId: postResourceDownload.userId,
      userName: user.name,
      userEmail: user.email,
      fileUrl: postResourceDownload.fileUrl,
      fileName: postResourceDownload.fileName,
      createdAt: postResourceDownload.createdAt,
    })
    .from(postResourceDownload)
    .leftJoin(
      postResource,
      eq(postResourceDownload.resourceId, postResource.id),
    )
    .leftJoin(user, eq(postResourceDownload.userId, user.id))
    .where(where)
    .orderBy(desc(postResourceDownload.createdAt))
    .limit(input.limit)
    .offset(input.offset);

  const [{ total }] = await db
    .select({ total: sql<number>`count(*)` })
    .from(postResourceDownload)
    .leftJoin(
      postResource,
      eq(postResourceDownload.resourceId, postResource.id),
    )
    .leftJoin(user, eq(postResourceDownload.userId, user.id))
    .where(where);

  return { items: rows as ResourceDownloadRow[], total: Number(total) };
}

/* ======================= 删除 / 清空（后台审计） ======================= */

/** 批量删除购买记录（按 id）。ids 为空时直接返回，避免误清空。 */
export async function deletePurchaseOrders(
  db: DB,
  ids: string[],
): Promise<void> {
  if (ids.length === 0) return;
  await db.delete(postResourceOrder).where(inArray(postResourceOrder.id, ids));
}

/** 清空全部购买记录。 */
export async function clearPurchaseOrders(db: DB): Promise<void> {
  await db.delete(postResourceOrder);
}

/** 批量删除附件下载记录（按 id）。ids 为空时直接返回，避免误清空。 */
export async function deleteResourceDownloads(
  db: DB,
  ids: string[],
): Promise<void> {
  if (ids.length === 0) return;
  await db
    .delete(postResourceDownload)
    .where(inArray(postResourceDownload.id, ids));
}

/** 清空全部附件下载记录。 */
export async function clearResourceDownloads(db: DB): Promise<void> {
  await db.delete(postResourceDownload);
}

/* ======================= 访问权限计算 ======================= */

export type AccessReason =
  | "free"
  | "member_only"
  | "paid"
  | "unlocked"
  | "member_free"
  | "login_required";

export interface AccessResult {
  /** 当前用户此刻能否看到链接 */
  accessible: boolean;
  /** 当前用户需支付的积分（0=免费） */
  userPrice: number;
  /** userPrice 折算成人民币的金额（元，向上取整；0=无需支付） */
  rmbEquivalent: number;
  reason: AccessReason;
  /** 是否需要一次解锁动作（付费/积分） */
  locked: boolean;
  isMember: boolean;
}

/**
 * 计算某资源对「当前用户」的可见性与应付积分价。
 * 资源始终以「积分」计价；人民币由 pointsPerYuan 折算，仅用于展示与支付兜底。
 * - free：所有人可见
 * - member（会员专享）：仅会员可见（会员免费）
 * - paid：基础积分价 + 会员权益
 *   - none：会员同价
 *   - free：会员免费，非会员按基础价
 *   - discount：会员按折扣系数（1=1折 … 10=不打折）计算，非会员按基础价
 *   - required：仅会员可购买（非会员不可见）
 */
export function computeAccess(
  r: {
    accessType: "free" | "member" | "paid";
    priceAmount: number;
    memberAccess: "none" | "required" | "free" | "discount";
    memberDiscount?: number;
  },
  opts: {
    isMember: boolean;
    orderStatus?: string | null;
    pointsPerYuan: number;
  },
): AccessResult {
  const isMember = opts.isMember;
  const pointsPerYuan = opts.pointsPerYuan > 0 ? opts.pointsPerYuan : 10;

  if (r.accessType === "free") {
    return {
      accessible: true,
      userPrice: 0,
      rmbEquivalent: 0,
      reason: "free",
      locked: false,
      isMember,
    };
  }

  if (r.accessType === "member") {
    if (isMember) {
      return {
        accessible: true,
        userPrice: 0,
        rmbEquivalent: 0,
        reason: "member_free",
        locked: false,
        isMember,
      };
    }
    return {
      accessible: false,
      userPrice: 0,
      rmbEquivalent: 0,
      reason: "member_only",
      locked: true,
      isMember,
    };
  }

  // paid
  if (opts.orderStatus === "paid" || opts.orderStatus === "free") {
    return {
      accessible: true,
      userPrice: 0,
      rmbEquivalent: 0,
      reason: "unlocked",
      locked: false,
      isMember,
    };
  }

  const base = r.priceAmount;
  let userPrice = base;
  switch (r.memberAccess) {
    case "free":
      userPrice = isMember ? 0 : base;
      break;
    case "discount": {
      // 折扣系数 1-10：1=1折 … 10=不打折（按后台设置的系数）
      const k = Math.min(10, Math.max(1, Math.round(r.memberDiscount ?? 10)));
      userPrice = isMember ? Math.max(1, Math.round((base * k) / 10)) : base;
      break;
    }
    case "required":
      if (!isMember) {
        return {
          accessible: false,
          userPrice: base,
          rmbEquivalent: Math.ceil(base / pointsPerYuan),
          reason: "member_only",
          locked: true,
          isMember,
        };
      }
      userPrice = base;
      break;
    case "none":
    default:
      userPrice = base;
      break;
  }

  const rmbEquivalent =
    userPrice > 0 ? Math.ceil(userPrice / pointsPerYuan) : 0;

  if (userPrice === 0) {
    return {
      accessible: true,
      userPrice: 0,
      rmbEquivalent: 0,
      reason: isMember ? "member_free" : "free",
      locked: false,
      isMember,
    };
  }
  return {
    accessible: false,
    userPrice,
    rmbEquivalent,
    reason: "paid",
    locked: true,
    isMember,
  };
}

/* ======================= 解锁动作 ======================= */

export interface UnlockResult {
  status: "unlocked" | "pending" | "insufficient" | "forbidden";
  message?: string;
}

/**
 * 解锁资源：
 * - 免费 / 会员免费 / 会员专享(会员)：直接解锁（记录 free 订单）
 * - 积分足够：扣减积分 + 记流水 + 记录 paid 订单
 * - 积分不足：
 *   - 若已接入支付（paymentEnabled）：按 pointsPerYuan 折算成人民币，生成 RMB pending 订单（待支付网关回调）
 *   - 否则返回 insufficient（系统没有充值，且未接入支付，无法购买）
 */
export async function unlockResource(
  db: DB,
  args: {
    resource: typeof postResource.$inferSelect;
    userId: string;
    isMember: boolean;
    pointsPerYuan: number;
    paymentEnabled: boolean;
  },
): Promise<UnlockResult> {
  const { resource, userId, isMember, pointsPerYuan, paymentEnabled } = args;
  const orderNo = generateOrderNo();
  const access = computeAccess(resource, {
    isMember,
    orderStatus: null,
    pointsPerYuan,
  });

  if (access.reason === "member_only") {
    return { status: "forbidden", message: "该资源仅会员可访问" };
  }

  // 免费类（免费资源 / 会员免费 / 会员专享且为会员）→ 直接解锁
  if (access.userPrice === 0) {
    const existing = await getOrder(db, userId, resource.id);
    if (!existing) {
      await createOrder(db, {
        id: crypto.randomUUID(),
        resourceId: resource.id,
        userId,
        priceType: resource.priceType,
        amount: 0,
        status: "free",
        orderNo,
      });
    }
    return { status: "unlocked" };
  }

  const price = access.userPrice;

  // 校验积分余额（按资源指定的积分类型：普通积分 / 会员积分）
  const pointField = resource.priceType; // "points" | "credits"
  const balanceCol = pointField === "credits" ? user.credits : user.points;
  const rows = await db
    .select({ v: balanceCol })
    .from(user)
    .where(eq(user.id, userId));
  const balance = rows[0]?.v ?? 0;

  if (balance >= price) {
    const next = await adjustPoints(db, userId, pointField, -price);
    await recordPointTransaction(db, {
      userId,
      type: pointField,
      amount: -price,
      balanceAfter: next,
      source: "resource_purchase",
      refId: resource.id,
      orderNo,
      reason: resource.title,
    });
    await createOrder(db, {
      id: crypto.randomUUID(),
      resourceId: resource.id,
      userId,
      priceType: pointField,
      amount: price,
      status: "paid",
      orderNo,
    });
    return { status: "unlocked" };
  }

  // 积分不足 → 折算为人民币，若已接入支付则生成待支付订单
  const rmb = Math.ceil(price / (pointsPerYuan > 0 ? pointsPerYuan : 10));
  if (paymentEnabled) {
    await createOrder(db, {
      id: crypto.randomUUID(),
      resourceId: resource.id,
      userId,
      priceType: "rmb",
      amount: rmb * 100, // 以「分」存储
      status: "pending",
      orderNo,
    });
    return {
      status: "pending",
      message: `积分不足，已自动折算为 ¥${rmb}（支付网关待接入）`,
    };
  }

  return { status: "insufficient", message: "积分不足，且未接入支付" };
}
