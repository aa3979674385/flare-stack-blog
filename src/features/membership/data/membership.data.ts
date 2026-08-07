import { desc, eq } from "drizzle-orm";
import type { DB } from "@/lib/db";
import { membershipPlan, user } from "@/lib/db/schema";
import type { MembershipPlan, NewMembershipPlan } from "@/lib/db/schema";

/** 列出全部会员套餐（后台管理用），按排序权重 + 创建时间倒序。 */
export async function listMembershipPlans(db: DB) {
  return db
    .select()
    .from(membershipPlan)
    .orderBy(membershipPlan.sortOrder, desc(membershipPlan.createdAt));
}

/** 前台展示用套餐视图：仅返回前台需要的基础字段，隐藏后台管理字段。 */
export interface PublicMembershipPlan {
  id: string;
  name: string;
  priceCents: number;
  durationDays: number;
  description: string | null;
}

/** 前台公开列表：仅返回 visible=1 的套餐，按排序权重 + 创建时间倒序。 */
export async function listPublicMembershipPlans(
  db: DB,
): Promise<PublicMembershipPlan[]> {
  return db
    .select({
      id: membershipPlan.id,
      name: membershipPlan.name,
      priceCents: membershipPlan.priceCents,
      durationDays: membershipPlan.durationDays,
      description: membershipPlan.description,
    })
    .from(membershipPlan)
    .where(eq(membershipPlan.visible, 1))
    .orderBy(membershipPlan.sortOrder, desc(membershipPlan.createdAt));
}

/** 当前用户会员状态：是否会员、到期时间(ms)、所属套餐名称。 */
export interface MyMembershipStatus {
  isMember: boolean;
  expiresAt: number | null;
  planName: string | null;
}

/**
 * 查询某用户的会员状态。
 * - 未关联套餐 / 已过期 → 非会员。
 * - 关联了套餐且（未设到期=永久 或 到期在未来）→ 会员。
 */
export async function getMyMembershipStatus(
  db: DB,
  userId: string,
): Promise<MyMembershipStatus> {
  const u = await db.query.user.findFirst({
    where: eq(user.id, userId),
    columns: { membershipPlanId: true, membershipExpiresAt: true },
  });
  if (!u || !u.membershipPlanId) {
    return { isMember: false, expiresAt: null, planName: null };
  }

  const isMember =
    !u.membershipExpiresAt ||
    new Date(u.membershipExpiresAt).getTime() > Date.now();

  let planName: string | null = null;
  const plan = await getMembershipPlanById(db, u.membershipPlanId);
  planName = plan?.name ?? null;

  return {
    isMember,
    expiresAt: u.membershipExpiresAt
      ? u.membershipExpiresAt.getTime()
      : null,
    planName,
  };
}

export async function getMembershipPlanById(db: DB, id: string) {
  return db.query.membershipPlan.findFirst({
    where: eq(membershipPlan.id, id),
  });
}

export async function insertMembershipPlan(db: DB, data: NewMembershipPlan) {
  const [plan] = await db.insert(membershipPlan).values(data).returning();
  return plan;
}

export async function updateMembershipPlan(
  db: DB,
  id: string,
  data: Partial<NewMembershipPlan>,
) {
  const [plan] = await db
    .update(membershipPlan)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(membershipPlan.id, id))
    .returning();
  return plan;
}

export async function deleteMembershipPlan(db: DB, id: string) {
  await db.delete(membershipPlan).where(eq(membershipPlan.id, id));
}

export type { MembershipPlan, NewMembershipPlan };
