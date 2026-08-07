import { and, desc, eq, inArray, like, or, sql, type SQL } from "drizzle-orm";
import {
  cardKey,
  cardKeyRedemption,
  type CardKey,
  type CardKeyStatus,
  type NewCardKey,
} from "@/lib/db/schema/card-keys.table";
import { pointTransaction } from "@/lib/db/schema/points.table";
import { user } from "@/lib/db/schema/auth.table";
import { membershipPlan } from "@/lib/db/schema";
import type { DB } from "@/lib/db";

/** 卡密字符集：去除 0/O/1/I 等易混淆字符 */
const CODE_CHARSET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function randomCodeBlock(len: number): string {
  const arr = new Uint32Array(len);
  crypto.getRandomValues(arr);
  let s = "";
  for (let i = 0; i < len; i++) s += CODE_CHARSET[arr[i] % CODE_CHARSET.length];
  return s;
}

function generateCode(): string {
  return `${randomCodeBlock(4)}-${randomCodeBlock(4)}-${randomCodeBlock(4)}-${randomCodeBlock(4)}`;
}

export interface GenerateCardKeysInput {
  count: number;
  batchNote?: string | null;
  membershipDays?: number | null;
  pointsA?: number | null;
  pointsB?: number | null;
}

/** 批量生成唯一卡密（同批次去重 + 跨库碰撞重生成）。返回生成条数。 */
export async function generateCardKeys(
  db: DB,
  input: GenerateCardKeysInput,
): Promise<number> {
  const { count, batchNote, membershipDays, pointsA, pointsB } = input;
  const now = new Date();
  const rows: NewCardKey[] = [];
  const seen = new Set<string>();
  for (let i = 0; i < count; i++) {
    let code = generateCode();
    while (seen.has(code)) code = generateCode();
    seen.add(code);
    rows.push({
      id: crypto.randomUUID(),
      code,
      batchNote: batchNote ?? null,
      membershipDays: membershipDays ?? null,
      pointsA: pointsA ?? null,
      pointsB: pointsB ?? null,
      status: "unused",
      createdAt: now,
    });
  }

  // 跨库去重：分批查询已存在 code，碰撞则重生成
  const codes = rows.map((r) => r.code);
  const existing = new Set<string>();
  for (let i = 0; i < codes.length; i += 500) {
    const batch = codes.slice(i, i + 500);
    const found = await db
      .select({ code: cardKey.code })
      .from(cardKey)
      .where(inArray(cardKey.code, batch));
    for (const f of found) existing.add(f.code);
  }
  if (existing.size > 0) {
    for (const r of rows) {
      let guard = 0;
      while (existing.has(r.code) && guard < 10) {
        r.code = generateCode();
        guard += 1;
      }
    }
  }

  await db.insert(cardKey).values(rows);
  return rows.length;
}

const cardKeyColumns = {
  id: cardKey.id,
  code: cardKey.code,
  batchNote: cardKey.batchNote,
  membershipDays: cardKey.membershipDays,
  pointsA: cardKey.pointsA,
  pointsB: cardKey.pointsB,
  status: cardKey.status,
  redeemedBy: cardKey.redeemedBy,
  redeemedAt: cardKey.redeemedAt,
  createdAt: cardKey.createdAt,
};

export interface CardKeyListItem extends CardKey {
  redeemedUserName: string | null;
}

export interface ListCardKeysInput {
  keyword?: string;
  status?: CardKeyStatus;
  offset: number;
  limit: number;
}

export interface ListCardKeysResult {
  items: CardKeyListItem[];
  total: number;
}

function buildWhere(input: { keyword?: string; status?: CardKeyStatus }) {
  const conditions: SQL<unknown>[] = [];
  if (input.status) conditions.push(eq(cardKey.status, input.status));
  const kw = input.keyword?.trim();
  if (kw) {
    const orCond = or(eq(cardKey.code, kw), like(cardKey.batchNote, `%${kw}%`));
    if (orCond) conditions.push(orCond);
  }
  return conditions.length ? and(...conditions) : undefined;
}

/** 卡密列表：支持关键词（精确卡密 / 模糊备注）、状态筛选、分页，并关联兑换用户名。 */
export async function listCardKeys(
  db: DB,
  input: ListCardKeysInput,
): Promise<ListCardKeysResult> {
  const where = buildWhere(input);
  const rows = await db
    .select({ ...cardKeyColumns, redeemedUserName: user.name })
    .from(cardKey)
    .leftJoin(user, eq(cardKey.redeemedBy, user.id))
    .where(where)
    .orderBy(desc(cardKey.createdAt))
    .limit(input.limit)
    .offset(input.offset);

  const [{ total }] = await db
    .select({ total: sql<number>`count(*)` })
    .from(cardKey)
    .where(where);

  return { items: rows as CardKeyListItem[], total: Number(total) };
}

/** 导出用：返回筛选条件下的全部卡密（不分页）。 */
export async function exportCardKeys(
  db: DB,
  input: { keyword?: string; status?: CardKeyStatus },
): Promise<CardKeyListItem[]> {
  const where = buildWhere(input);
  const rows = await db
    .select({ ...cardKeyColumns, redeemedUserName: user.name })
    .from(cardKey)
    .leftJoin(user, eq(cardKey.redeemedBy, user.id))
    .where(where)
    .orderBy(desc(cardKey.createdAt));
  return rows as CardKeyListItem[];
}

export interface RedeemResult {
  membershipDays: number | null;
  pointsA: number | null;
  pointsB: number | null;
}

export class CardKeyError extends Error {
  constructor(
    public reason: "NOT_FOUND" | "USED",
    message: string,
  ) {
    super(message);
    this.name = "CardKeyError";
  }
}

/** 发放单类积分并写流水（带余额快照）。 */
async function creditPoints(
  db: DB,
  userId: string,
  type: "points" | "credits",
  amount: number,
  reason: string,
) {
  const u = await db.query.user.findFirst({
    where: eq(user.id, userId),
    columns: { points: true, credits: true },
  });
  const current = type === "points" ? (u?.points ?? 0) : (u?.credits ?? 0);
  const balanceAfter = current + amount;
  await db
    .update(user)
    .set(type === "points" ? { points: balanceAfter } : { credits: balanceAfter })
    .where(eq(user.id, userId));
  await db.insert(pointTransaction).values({
    id: crypto.randomUUID(),
    userId,
    type,
    amount,
    balanceAfter,
    source: "other",
    reason,
  });
}

/**
 * 兑换卡密（非事务顺序执行）：
 * 1. 读取卡密配置（用于发放奖励）；2. 原子认领（UPDATE ... WHERE status='unused'，避免并发双兑）；
 * 3. 逐项发放（积分A=points / 积分B=credits / 会员时长延长 membershipExpiresAt，
 *    且当用户尚无套餐时分配默认套餐——否则 isUserMember() 会因缺 membershipPlanId 判定为非会员，导致兑换无效）；
 * 4. 写兑换记录。
 *
 * 注意：D1 是单写者数据库（Cloudflare 保证），无需显式事务即可保证串行写入。
 * 第 2 步的 UPDATE ... WHERE 已实现原子认领，即使后续步骤异常也不会导致双兑。
 * 失败抛出 CardKeyError(NOT_FOUND / USED)。
 */
export async function redeemCardKey(
  db: DB,
  input: { code: string; userId: string },
): Promise<RedeemResult> {
  // 1. 读取卡密配置（用于发放奖励）
  const ck = await db.query.cardKey.findFirst({
    where: eq(cardKey.code, input.code),
  });
  if (!ck) throw new CardKeyError("NOT_FOUND", "卡密不存在");
  if (ck.status === "used") throw new CardKeyError("USED", "卡密已兑换");

  // 2. 原子认领：仅当仍为 unused 时才更新成功（消除「先读后写」的 TOCTOU 双兑窗口）
  const claimed = await db
    .update(cardKey)
    .set({
      status: "used",
      redeemedBy: input.userId,
      redeemedAt: new Date(),
    })
    .where(and(eq(cardKey.id, ck.id), eq(cardKey.status, "unused")));
  if (claimed.meta.changes === 0) {
    throw new CardKeyError("USED", "卡密已兑换");
  }

  const result: RedeemResult = {
    membershipDays: null,
    pointsA: null,
    pointsB: null,
  };

  // 3. 会员时长：延长 membershipExpiresAt；若用户尚无套餐则分配默认套餐
  if (ck.membershipDays && ck.membershipDays > 0) {
    const u = await db.query.user.findFirst({
      where: eq(user.id, input.userId),
      columns: { membershipPlanId: true, membershipExpiresAt: true },
    });
    const base =
      u?.membershipExpiresAt && u.membershipExpiresAt.getTime() > Date.now()
        ? u.membershipExpiresAt.getTime()
        : Date.now();
    const newExpiry = new Date(base + ck.membershipDays * 86400000);

    // isUserMember() 要求 membershipPlanId 存在，否则即使有有效期也不算会员。
    // 因此无套餐时必须补一个默认套餐（按 sortOrder 取第一个），才能确保兑换真实生效。
    const userSet: { membershipExpiresAt: Date; membershipPlanId?: string } = {
      membershipExpiresAt: newExpiry,
    };
    if (!u?.membershipPlanId) {
      const [defaultPlan] = await db
        .select({ id: membershipPlan.id })
        .from(membershipPlan)
        .orderBy(membershipPlan.sortOrder, desc(membershipPlan.createdAt))
        .limit(1);
      if (defaultPlan) userSet.membershipPlanId = defaultPlan.id;
    }
    await db
      .update(user)
      .set(userSet)
      .where(eq(user.id, input.userId));
    result.membershipDays = ck.membershipDays;
  }

  if (ck.pointsA && ck.pointsA > 0) {
    await creditPoints(db, input.userId, "points", ck.pointsA, "卡密兑换：赠送积分A（普通积分）");
    result.pointsA = ck.pointsA;
  }
  if (ck.pointsB && ck.pointsB > 0) {
    await creditPoints(db, input.userId, "credits", ck.pointsB, "卡密兑换：赠送积分B（会员积分）");
    result.pointsB = ck.pointsB;
  }

  await db.insert(cardKeyRedemption).values({
    id: crypto.randomUUID(),
    cardKeyId: ck.id,
    userId: input.userId,
    membershipDaysGranted: ck.membershipDays ?? null,
    pointsAGranted: ck.pointsA ?? null,
    pointsBGranted: ck.pointsB ?? null,
    createdAt: new Date(),
  });

  return result;
}
