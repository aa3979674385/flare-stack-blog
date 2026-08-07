import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  ArrowRight,
  CalendarCheck,
  CheckCircle2,
  ChevronRight,
  Coins,
  Crown,
  Gift,
  KeyRound,
  LayoutDashboard,
  Link2,
  Loader2,
  LogOut,
  Package,
  Settings,
  ShieldAlert,
  ShieldCheck,
  UserIcon,
} from "lucide-react";
import { toast } from "sonner";
import { authClient } from "@/lib/auth/auth.client";
import { userHasPasswordFn } from "@/features/auth/api/auth.api";
import { AUTH_KEYS } from "@/features/auth/queries";
import {
  useLogout,
  useNotificationToggle,
  usePasswordForm,
  useProfileForm,
} from "@/features/auth/hooks";
import { useMyPermissions } from "@/features/auth/permissions";
import { useMyMembershipStatus, usePublicMembershipPlans } from "@/features/membership/queries";
import { useMyPurchaseOrders } from "@/features/post-resources/queries";
import { useCheckIn, useMyCheckInStatus, useMyPoints } from "@/features/users/queries";
import { usePointConfig, siteConfigQuery } from "@/features/config/queries";
import { useFriendLinkSubmitForm } from "@/features/friend-links/hooks/use-friend-link-submit-form";
import { myFriendLinksQuery } from "@/features/friend-links/queries";
import { Turnstile, useTurnstile } from "@/components/common/turnstile";
import { redeemCardKeyFn } from "@/features/card-keys/api/card-keys.public.api";
import type { RedeemResult } from "@/features/card-keys/data/card-keys.data";

export const Route = createFileRoute("/_user/membership")({
  ssr: "data-only",
  component: MembershipPage,
  loader: async () => ({ title: "会员中心" }),
  head: ({ loaderData }) => ({
    meta: [{ title: loaderData?.title }],
  }),
});

/* ======================= 类型与工具 ======================= */

type ViewKey =
  | "overview"
  | "checkin"
  | "points"
  | "plans"
  | "resources"
  | "profile"
  | "prefs"
  | "friendlink";

type AppUser = {
  id: string;
  name: string;
  email: string;
  image?: string | null;
};

const NAV_ITEMS: { key: ViewKey; label: string; icon: React.ReactNode }[] = [
  { key: "overview", label: "概览", icon: <LayoutDashboard size={16} strokeWidth={1.5} /> },
  { key: "checkin", label: "每日签到", icon: <CalendarCheck size={16} strokeWidth={1.5} /> },
  { key: "points", label: "积分余额", icon: <Coins size={16} strokeWidth={1.5} /> },
  { key: "plans", label: "会员套餐", icon: <Crown size={16} strokeWidth={1.5} /> },
  { key: "resources", label: "已购资源", icon: <Package size={16} strokeWidth={1.5} /> },
  { key: "profile", label: "个人资料", icon: <UserIcon size={16} strokeWidth={1.5} /> },
  { key: "prefs", label: "偏好设置", icon: <Settings size={16} strokeWidth={1.5} /> },
  { key: "friendlink", label: "提交友链", icon: <Link2 size={16} strokeWidth={1.5} /> },
];

function fmtDate(ts: number | null): string {
  if (!ts) return "永久";
  return new Date(ts).toLocaleDateString("zh-CN");
}

function formatCents(cents: number): string {
  return (cents / 100).toFixed(2);
}

const PRICE_TYPE_LABEL: Record<string, string> = {
  points: "普通积分",
  credits: "会员积分",
  rmb: "人民币",
};

function priceText(priceType: string | null, amount: number | null): string {
  if (amount == null) return "—";
  if (priceType === "rmb") return `¥${formatCents(amount)}`;
  return String(amount);
}

const ORDER_STATUS_STYLE: Record<string, string> = {
  paid: "text-emerald-600 bg-emerald-500/10",
  free: "text-emerald-600 bg-emerald-500/10",
  pending: "text-amber-600 bg-amber-500/10",
};

function orderStatusLabel(status: string): string {
  switch (status) {
    case "paid":
      return "已购买";
    case "free":
      return "免费";
    case "pending":
      return "待支付";
    default:
      return status;
  }
}

/* ======================= 容器小组件 ======================= */

function Panel({
  title,
  icon,
  children,
  className = "",
}: {
  title?: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={`fuwari-card-base rounded-2xl p-6 sm:p-8 ${className}`}>
      {title ? (
        <h2 className="mb-4 flex items-center gap-2 text-lg font-bold fuwari-text-90">
          {icon}
          {title}
        </h2>
      ) : null}
      {children}
    </section>
  );
}

/* ======================= 概览 ======================= */

function OverviewView({
  user,
  onGoResources,
  onGoPlans,
}: {
  user: AppUser;
  onGoResources: () => void;
  onGoPlans: () => void;
}) {
  const { data: status } = useMyMembershipStatus();
  const { data: myPoints } = useMyPoints();
  const { data: checkIn } = useMyCheckInStatus();
  const { data: orders } = useMyPurchaseOrders(0, 100);

  const purchasedCount = orders?.items.filter((o) => o.postId != null).length ?? 0;

  return (
    <div className="space-y-6">
      {/* 会员身份卡 */}
      <Panel>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            {user.image ? (
              <img
                src={user.image}
                alt={user.name}
                className="h-16 w-16 rounded-2xl object-cover"
              />
            ) : (
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-(--fuwari-primary) text-white">
                <UserIcon size={26} strokeWidth={1.5} />
              </div>
            )}
            <div>
              <div className="text-xl font-bold fuwari-text-90">{user.name}</div>
              {status?.isMember ? (
                <div className="mt-1 inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-xs font-medium text-emerald-600">
                  <ShieldCheck size={13} />
                  {status.planName ?? "会员"} · 有效期至 {fmtDate(status.expiresAt)}
                </div>
              ) : (
                <div className="mt-1 inline-flex items-center gap-1.5 rounded-full bg-muted/30 px-2.5 py-0.5 text-xs font-medium fuwari-text-50">
                  <ShieldAlert size={13} />
                  非会员
                </div>
              )}
            </div>
          </div>
          {!status?.isMember ? (
            <button
              type="button"
              onClick={onGoPlans}
              className="fuwari-btn-primary rounded-xl px-5 py-2.5 font-bold"
            >
              开通会员
            </button>
          ) : null}
        </div>
      </Panel>

      {/* 统计卡片 */}
      <div className="grid grid-cols-2 gap-5 lg:grid-cols-4">
        <button
          type="button"
          onClick={onGoResources}
          className="fuwari-card-base rounded-2xl p-6 text-left"
        >
          <div className="text-xs fuwari-text-50">已购资源</div>
          <div className="mt-2 text-5xl font-serif tabular-nums fuwari-text-90">
            {purchasedCount}
          </div>
          <div className="mt-1 flex items-center gap-0.5 text-[11px] text-(--fuwari-primary)">
            查看 <ChevronRight size={12} />
          </div>
        </button>
        <div className="fuwari-card-base rounded-2xl p-6">
          <div className="text-xs fuwari-text-50">普通积分</div>
          <div className="mt-2 text-5xl font-serif tabular-nums fuwari-text-90">
            {myPoints?.points ?? 0}
          </div>
        </div>
        <div className="fuwari-card-base rounded-2xl p-6">
          <div className="text-xs fuwari-text-50">会员积分</div>
          <div className="mt-2 text-5xl font-serif tabular-nums fuwari-text-90">
            {myPoints?.credits ?? 0}
          </div>
        </div>
        <div className="fuwari-card-base rounded-2xl p-6">
          <div className="text-xs fuwari-text-50">连续签到</div>
          <div className="mt-2 text-5xl font-serif tabular-nums fuwari-text-90">
            {checkIn?.streak ?? 0}
          </div>
          <div className="mt-1 text-[11px] fuwari-text-50">天</div>
        </div>
      </div>

      {/* 任务中心（开发中） */}
      <Panel title="任务中心" icon={<Gift size={16} className="opacity-60" />}>
        <div className="flex items-center gap-3 rounded-xl border border-border/40 bg-muted/10 p-4">
          <Loader2 className="h-5 w-5 animate-spin fuwari-text-50" />
          <div>
            <div className="text-sm font-medium fuwari-text-90">功能开发中</div>
            <div className="text-[11px] fuwari-text-50">
              任务中心正在开发中，敬请期待。完成每日任务可领取积分奖励。
            </div>
          </div>
        </div>
      </Panel>
    </div>
  );
}

/* ======================= 每日签到 ======================= */

function CheckinView() {
  const { data: checkIn, isLoading } = useMyCheckInStatus();
  const checkInMutation = useCheckIn();
  const { data: myPoints } = useMyPoints();
  const { data: pointConfig } = usePointConfig();
  const pointsName = pointConfig?.pointsName ?? "普通积分";

  const handleCheckIn = () => {
    checkInMutation.mutate(undefined, {
      onSuccess: (res) =>
        toast.success(`签到成功！连续 ${res.streak} 天，获得 ${res.awarded} ${pointsName}`),
      onError: (e) =>
        toast.error(
          e instanceof Error && e.message.includes("ALREADY")
            ? "今天已经签到过了"
            : "签到失败，请稍后重试",
        ),
    });
  };

  return (
    <div className="space-y-6">
      <Panel title="每日签到" icon={<CalendarCheck size={16} className="opacity-60" />}>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-sm fuwari-text-50">
            连续签到{" "}
            <span className="font-mono text-base font-medium fuwari-text-90">
              {isLoading ? "…" : checkIn?.streak ?? 0}
            </span>{" "}
            天
            <div className="mt-1 text-[11px]">
              {checkIn?.canCheckIn ? "今日尚未签到，签到可领取积分" : "今日已签到"}
            </div>
          </div>
          <Button
            onClick={handleCheckIn}
            disabled={!checkIn?.canCheckIn || checkInMutation.isPending}
          >
            {checkInMutation.isPending ? (
              <Loader2 size={14} className="animate-spin mr-2" />
            ) : null}
            {checkIn?.canCheckIn ? "立即签到" : "今日已签到"}
          </Button>
        </div>
        <div className="mt-4 rounded-xl border border-border/40 bg-muted/10 p-4 text-xs fuwari-text-50">
          当前 {pointsName}：
          <span className="font-mono font-medium fuwari-text-90">
            {myPoints?.points ?? 0}
          </span>
        </div>
      </Panel>
    </div>
  );
}

/* ======================= 积分余额 ======================= */

function PointsView({ onRecharge }: { onRecharge: () => void }) {
  const { data: myPoints, isLoading } = useMyPoints();
  const { data: pointConfig } = usePointConfig();
  const { data: orders, isLoading: ordersLoading } = useMyPurchaseOrders(0, 50);

  const pointsName = pointConfig?.pointsName ?? "普通积分";
  const creditsName = pointConfig?.creditsName ?? "会员积分";

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <Panel>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-bold fuwari-text-90">{pointsName}</h2>
            <button
              type="button"
              onClick={onRecharge}
              className="fuwari-btn-primary inline-flex h-9 items-center justify-center gap-1.5 rounded-lg px-4 text-sm font-medium"
            >
              <Coins size={14} />
              充值
            </button>
          </div>
          <div className="text-5xl font-serif tabular-nums fuwari-text-90">
            {isLoading ? <Loader2 className="h-6 w-6 animate-spin" /> : myPoints?.points ?? 0}
          </div>
          <p className="mt-2 text-[11px] fuwari-text-50">
            可用于日常互动、内容兑换等通用场景
          </p>
        </Panel>
        <Panel title={creditsName}>
          <div className="text-5xl font-serif tabular-nums fuwari-text-90">
            {isLoading ? <Loader2 className="h-6 w-6 animate-spin" /> : myPoints?.credits ?? 0}
          </div>
          <p className="mt-2 text-[11px] fuwari-text-50">
            会员专属积分，可用于会员权益与增值服务
          </p>
        </Panel>
      </div>

      {/* 我的订单 */}
      <Panel title="我的订单" icon={<Package size={16} className="opacity-60" />}>
        {ordersLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin fuwari-text-50" />
          </div>
        ) : (orders?.items.length ?? 0) === 0 ? (
          <p className="py-6 text-center text-sm fuwari-text-50">暂无购买记录</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wider fuwari-text-50">
                  <th className="py-2 pr-3 font-medium">资源</th>
                  <th className="py-2 pr-3 font-medium">类型</th>
                  <th className="py-2 pr-3 font-medium">金额</th>
                  <th className="py-2 pr-3 font-medium">状态</th>
                  <th className="py-2 pr-3 font-medium">时间</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/30">
                {orders!.items.map((o) => (
                  <tr key={o.id} className="fuwari-text-90">
                    <td className="py-3 pr-3">
                      {o.postId != null ? (
                        <Link
                          to="/post/$slug"
                          params={{ slug: String(o.postId) }}
                          className="hover:text-(--fuwari-primary) fuwari-text-90"
                        >
                          {o.resourceTitle ?? o.resourceId}
                        </Link>
                      ) : (
                        <span className="fuwari-text-75">{o.resourceTitle ?? o.resourceId}</span>
                      )}
                    </td>
                    <td className="py-3 pr-3 fuwari-text-50">
                      {PRICE_TYPE_LABEL[o.priceType ?? ""] ?? o.priceType ?? "—"}
                    </td>
                    <td className="py-3 pr-3 font-mono">
                      {priceText(o.priceType, o.amount)}
                    </td>
                    <td className="py-3 pr-3">
                      <span
                        className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
                          ORDER_STATUS_STYLE[o.status] ?? "bg-muted/30 fuwari-text-50"
                        }`}
                      >
                        {orderStatusLabel(o.status)}
                      </span>
                    </td>
                    <td className="py-3 pr-3 text-[11px] fuwari-text-50">
                      {o.createdAt
                        ? new Date(o.createdAt).toLocaleDateString("zh-CN")
                        : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </div>
  );
}

/* ======================= 会员套餐 ======================= */

function PlansView() {
  const { data: plans, isLoading } = usePublicMembershipPlans();
  const { data: siteConfig } = useQuery(siteConfigQuery);
  const [code, setCode] = useState("");
  const [result, setResult] = useState<RedeemResult | null>(null);

  const {
    isPending: tsPending,
    reset: resetTurnstile,
    turnstileProps,
  } = useTurnstile("redeem");

  const redeemMut = useMutation({
    mutationFn: (vars: { code: string }) => redeemCardKeyFn({ data: vars }),
    onSuccess: (r) => {
      setResult(r);
      toast.success("兑换成功");
    },
    onError: (e: Error) => {
      setResult(null);
      toast.error(e.message || "兑换失败");
    },
    onSettled: () => resetTurnstile(),
  });

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const c = code.trim();
    if (!c) {
      toast.error("请输入卡密");
      return;
    }
    redeemMut.mutate({ code: c });
  };

  // 当前未接入在线支付，点击「开通」统一提示走卡密开通
  const handleSubscribe = () => {
    toast.info("支付功能尚未接入，请使用卡密开通会员");
  };

  return (
    <div className="space-y-6">
      {/* 套餐列表 */}
      <Panel title="会员套餐" icon={<Crown size={16} className="opacity-60" />}>
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin fuwari-text-50" />
          </div>
        ) : (plans?.length ?? 0) === 0 ? (
          <p className="py-6 text-center text-sm fuwari-text-50">暂无可展示的会员套餐</p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {plans!.map((p) => (
              <div
                key={p.id}
                className="flex flex-col gap-3 rounded-2xl border border-border/40 bg-muted/10 p-6"
              >
                <div className="flex items-center justify-between">
                  <span className="text-base font-bold fuwari-text-90">{p.name}</span>
                  <span className="text-lg font-serif text-(--fuwari-primary)">
                    ¥{formatCents(p.priceCents)}
                  </span>
                </div>
                <p className="text-[11px] fuwari-text-50">有效期 {p.durationDays} 天</p>
                {p.description ? (
                  <div
                    className="custom-scrollbar flex-1 max-h-44 overflow-y-auto overflow-x-hidden break-words text-sm fuwari-text-75"
                    // biome-ignore lint/security/noDangerouslySetInnerHtml: 管理员在后台配置的套餐说明
                    dangerouslySetInnerHTML={{ __html: p.description }}
                  />
                ) : (
                  <div className="flex-1" />
                )}
                <button
                  type="button"
                  onClick={handleSubscribe}
                  className="fuwari-btn-primary mt-1 w-full rounded-xl py-2.5 font-bold active:scale-[0.98] transition-all"
                >
                  开通
                </button>
              </div>
            ))}
          </div>
        )}
      </Panel>

      {/* 卡密兑换 */}
      <div id="cardkey-redeem">
      <Panel title="卡密兑换" icon={<KeyRound size={16} className="opacity-60" />}>
        {result ? (
          <div className="space-y-4 rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-6">
            <div className="flex items-center gap-2 text-emerald-600">
              <CheckCircle2 size={22} />
              <span className="text-lg font-medium">兑换成功</span>
            </div>
            <ul className="space-y-2 text-sm fuwari-text-90">
              {result.membershipDays ? (
                <li className="flex items-center gap-2">
                  <Gift size={16} className="fuwari-text-50" />
                  会员时长 +{result.membershipDays} 天
                </li>
              ) : null}
              {result.pointsA ? (
                <li className="flex items-center gap-2">
                  <Gift size={16} className="fuwari-text-50" />
                  普通积分 +{result.pointsA}
                </li>
              ) : null}
              {result.pointsB ? (
                <li className="flex items-center gap-2">
                  <Gift size={16} className="fuwari-text-50" />
                  会员积分 +{result.pointsB}
                </li>
              ) : null}
              {!result.membershipDays && !result.pointsA && !result.pointsB ? (
                <li className="fuwari-text-50">本次卡密无可发放奖励</li>
              ) : null}
            </ul>
            <button
              type="button"
              onClick={() => {
                setResult(null);
                setCode("");
              }}
              className="text-sm fuwari-text-50 underline-offset-4 hover:underline"
            >
              继续兑换其他卡密
            </button>
          </div>
        ) : (
          <form onSubmit={onSubmit} className="space-y-4">
            <Turnstile {...turnstileProps} />
            <label className="block space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium fuwari-text-90">输入卡密</span>
                {siteConfig?.cardKeyPurchaseUrl ? (
                  <a
                    href={siteConfig.cardKeyPurchaseUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-sm font-medium text-(--fuwari-primary) hover:underline"
                  >
                    <Link2 size={14} />
                    没有卡密？前往购买
                  </a>
                ) : null}
              </div>
              <input
                type="text"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="XXXX-XXXX-XXXX-XXXX"
                autoComplete="off"
                className="w-full rounded-lg border border-border/40 bg-muted/20 px-3 py-2 font-mono text-sm fuwari-text-90 focus:outline-none focus:ring-2 focus:ring-(--fuwari-primary)"
              />
            </label>
            <button
              type="submit"
              disabled={redeemMut.isPending || tsPending}
              className="fuwari-btn-primary inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg font-medium disabled:opacity-50"
            >
              {redeemMut.isPending && <Loader2 size={16} className="animate-spin" />}
              立即兑换
            </button>
            <p className="text-center text-xs fuwari-text-50">
              单张卡密仅可兑换一次，兑换后权益立即到账。
            </p>
          </form>
        )}
      </Panel>
      </div>
    </div>
  );
}

/* ======================= 已购资源 ======================= */

function ResourcesView() {
  const { data: orders, isLoading } = useMyPurchaseOrders(0, 100);
  const purchased =
    orders?.items.filter((o) => o.postId != null) ?? [];

  return (
    <div className="space-y-6">
      <Panel title="已购资源" icon={<Package size={16} className="opacity-60" />}>
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin fuwari-text-50" />
          </div>
        ) : purchased.length === 0 ? (
          <p className="py-6 text-center text-sm fuwari-text-50">你还没有购买任何资源</p>
        ) : (
          <div className="divide-y divide-border/30">
            {purchased.map((o) => (
              <Link
                key={o.id}
                to="/post/$slug"
                params={{ slug: String(o.postId) }}
                className="flex items-center justify-between gap-4 py-4 transition-colors hover:text-(--fuwari-primary)"
              >
                <span className="min-w-0 truncate fuwari-text-90">
                  {o.resourceTitle ?? o.resourceId}
                </span>
                <span className="flex shrink-0 items-center gap-1 text-[11px] fuwari-text-50">
                  {orderStatusLabel(o.status)} <ArrowRight size={12} />
                </span>
              </Link>
            ))}
          </div>
        )}
      </Panel>
    </div>
  );
}

/* ======================= 个人资料 ======================= */

function ProfileView({ user }: { user: AppUser }) {
  const profileForm = useProfileForm({ user });
  const passwordForm = usePasswordForm();
  const { data: hasPassword } = useQuery({
    queryKey: AUTH_KEYS.hasPassword(user.id),
    queryFn: () => userHasPasswordFn(),
    enabled: !!user,
  });

  return (
    <div className="space-y-6">
      <Panel title="基本资料" icon={<UserIcon size={16} className="opacity-60" />}>
        <form onSubmit={profileForm.handleSubmit} className="space-y-4">
          <label className="block space-y-1.5">
            <span className="block text-sm font-medium fuwari-text-90">昵称</span>
            <input
              {...profileForm.register("name")}
              className="w-full rounded-lg border border-border/40 bg-muted/20 px-3 py-2 text-sm fuwari-text-90 focus:outline-none focus:ring-2 focus:ring-(--fuwari-primary)"
            />
            {profileForm.errors.name ? (
              <span className="text-xs text-red-500">
                {profileForm.errors.name.message as string}
              </span>
            ) : null}
          </label>
          <label className="block space-y-1.5">
            <span className="block text-sm font-medium fuwari-text-90">头像链接</span>
            <input
              {...profileForm.register("image")}
              placeholder="https://..."
              className="w-full rounded-lg border border-border/40 bg-muted/20 px-3 py-2 text-sm fuwari-text-90 focus:outline-none focus:ring-2 focus:ring-(--fuwari-primary)"
            />
            {profileForm.errors.image ? (
              <span className="text-xs text-red-500">
                {profileForm.errors.image.message as string}
              </span>
            ) : null}
          </label>
          <Button type="submit" disabled={profileForm.isSubmitting}>
            {profileForm.isSubmitting && <Loader2 size={14} className="animate-spin mr-2" />}
            保存资料
          </Button>
        </form>
      </Panel>

      {hasPassword ? (
        <Panel title="修改密码">
          <form onSubmit={passwordForm.handleSubmit} className="space-y-4">
            <label className="block space-y-1.5">
              <span className="block text-sm font-medium fuwari-text-90">当前密码</span>
              <input
                type="password"
                {...passwordForm.register("currentPassword")}
                className="w-full rounded-lg border border-border/40 bg-muted/20 px-3 py-2 text-sm fuwari-text-90 focus:outline-none focus:ring-2 focus:ring-(--fuwari-primary)"
              />
            </label>
            <label className="block space-y-1.5">
              <span className="block text-sm font-medium fuwari-text-90">新密码</span>
              <input
                type="password"
                {...passwordForm.register("newPassword")}
                className="w-full rounded-lg border border-border/40 bg-muted/20 px-3 py-2 text-sm fuwari-text-90 focus:outline-none focus:ring-2 focus:ring-(--fuwari-primary)"
              />
            </label>
            <label className="block space-y-1.5">
              <span className="block text-sm font-medium fuwari-text-90">确认新密码</span>
              <input
                type="password"
                {...passwordForm.register("confirmPassword")}
                className="w-full rounded-lg border border-border/40 bg-muted/20 px-3 py-2 text-sm fuwari-text-90 focus:outline-none focus:ring-2 focus:ring-(--fuwari-primary)"
              />
            </label>
            <Button type="submit" disabled={passwordForm.isSubmitting}>
              {passwordForm.isSubmitting && <Loader2 size={14} className="animate-spin mr-2" />}
              更新密码
            </Button>
          </form>
        </Panel>
      ) : null}
    </div>
  );
}

/* ======================= 偏好设置 ======================= */

function PrefsView({ user }: { user: AppUser }) {
  const notification = useNotificationToggle(user.id);

  return (
    <div className="space-y-6">
      <Panel title="通知偏好" icon={<Settings size={16} className="opacity-60" />}>
        <div className="flex items-center justify-between gap-4">
          <div>
            <div className="text-sm font-medium fuwari-text-90">评论回复通知</div>
            <div className="mt-0.5 text-[11px] fuwari-text-50">
              {notification.available
                ? "有人回复你的评论时，通过邮件提醒你"
                : "站点未启用邮件通知，暂无法开启"}
            </div>
          </div>
          <button
            type="button"
            onClick={notification.toggle}
            disabled={notification.isLoading || notification.isPending || !notification.available}
            className={`relative h-7 w-12 shrink-0 rounded-full transition-colors ${
              notification.enabled ? "bg-(--fuwari-primary)" : "bg-muted-foreground/30"
            } disabled:opacity-50`}
            aria-pressed={notification.enabled ?? false}
          >
            <span
              className={`absolute top-0.5 h-6 w-6 rounded-full bg-white transition-transform ${
                notification.enabled ? "translate-x-5" : "translate-x-0.5"
              }`}
            />
          </button>
        </div>
      </Panel>
    </div>
  );
}

/* ======================= 提交友链 ======================= */

function FriendLinkView({ user }: { user: AppUser }) {
  const { data: myLinks } = useQuery(myFriendLinksQuery());
  const form = useFriendLinkSubmitForm(user.email);

  return (
    <div className="space-y-6">
      <Panel title="我的友链" icon={<Link2 size={16} className="opacity-60" />}>
        {!myLinks || myLinks.length === 0 ? (
          <p className="py-2 text-sm fuwari-text-50">你还没有提交过友链</p>
        ) : (
          <div className="divide-y divide-border/30">
            {myLinks.map((l) => (
              <div key={l.id} className="flex items-center justify-between gap-4 py-3 text-sm">
                <div className="min-w-0">
                  <div className="truncate fuwari-text-90">{l.siteName}</div>
                  <div className="truncate text-[11px] fuwari-text-50">{l.siteUrl}</div>
                </div>
                <span
                  className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ${
                    l.status === "approved"
                      ? "bg-emerald-500/10 text-emerald-600"
                      : l.status === "rejected"
                        ? "bg-red-500/10 text-red-600"
                        : "bg-amber-500/10 text-amber-600"
                  }`}
                >
                  {l.status === "approved"
                    ? "已通过"
                    : l.status === "rejected"
                      ? "已拒绝"
                      : "待审核"}
                </span>
              </div>
            ))}
          </div>
        )}
      </Panel>

      <Panel title="提交新友链">
        <form onSubmit={form.handleSubmit} className="space-y-4">
          <Turnstile {...form.turnstileProps} />
          <label className="block space-y-1.5">
            <span className="block text-sm font-medium fuwari-text-90">站点名称</span>
            <input
              {...form.register("siteName")}
              className="w-full rounded-lg border border-border/40 bg-muted/20 px-3 py-2 text-sm fuwari-text-90 focus:outline-none focus:ring-2 focus:ring-(--fuwari-primary)"
            />
          </label>
          <label className="block space-y-1.5">
            <span className="block text-sm font-medium fuwari-text-90">站点链接</span>
            <input
              {...form.register("siteUrl")}
              placeholder="https://"
              className="w-full rounded-lg border border-border/40 bg-muted/20 px-3 py-2 text-sm fuwari-text-90 focus:outline-none focus:ring-2 focus:ring-(--fuwari-primary)"
            />
          </label>
          <label className="block space-y-1.5">
            <span className="block text-sm font-medium fuwari-text-90">联系邮箱</span>
            <input
              {...form.register("contactEmail")}
              className="w-full rounded-lg border border-border/40 bg-muted/20 px-3 py-2 text-sm fuwari-text-90 focus:outline-none focus:ring-2 focus:ring-(--fuwari-primary)"
            />
          </label>
          <Button type="submit" disabled={form.isSubmitting}>
            提交申请
          </Button>
        </form>
      </Panel>
    </div>
  );
}

/* ======================= 主框架 ======================= */

// 轻量按钮（内联，避免与 fuwari-btn 令牌耦合出错）
function Button({
  children,
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      className={`fuwari-btn-primary inline-flex h-10 items-center justify-center gap-2 rounded-lg px-5 text-sm font-medium disabled:opacity-50 ${
        className ?? ""
      }`}
    >
      {children}
    </button>
  );
}

function MembershipPage() {
  const { data: session, isPending } = authClient.useSession();
  const navigate = useNavigate();
  const [view, setView] = useState<ViewKey>("overview");
  const { logout } = useLogout();
  const { data: myPerms } = useMyPermissions();
  const canAccessAdmin = useMemo(
    () => myPerms?.effective && myPerms.effective.length > 0,
    [myPerms],
  );

  useEffect(() => {
    if (!isPending && !session?.user) {
      navigate({ to: "/login" });
    }
  }, [isPending, session, navigate]);

  if (isPending) {
    return (
      <div className="py-24 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin fuwari-text-50" />
      </div>
    );
  }

  if (!session?.user) return null;

  const user: AppUser = {
    id: session.user.id,
    name: session.user.name,
    email: session.user.email,
    image: session.user.image,
  };

  const handleGoto = (v: ViewKey) => setView(v);

  const handleRecharge = () => {
    setView("plans");
    window.setTimeout(() => {
      document
        .getElementById("cardkey-redeem")
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 120);
  };

  return (
    <div className="w-full px-4 md:px-8 pb-20">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:gap-8">
        {/* 左侧导航 */}
        <aside className="w-full shrink-0 md:w-64 md:sticky md:top-6">
          <nav className="fuwari-card-base grid grid-cols-4 gap-2 rounded-2xl p-3 md:flex md:flex-col md:gap-2 md:overflow-visible">
            {NAV_ITEMS.map((item) => {
              const active = view === item.key;
              return (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => handleGoto(item.key)}
                  className={`flex flex-col items-center justify-center gap-1 rounded-xl px-2 py-2 text-xs font-medium transition-colors md:flex-row md:items-center md:gap-2 md:px-4 md:py-2.5 md:text-sm ${
                    active
                      ? "bg-(--fuwari-primary) text-white"
                      : "fuwari-text-75 hover:text-(--fuwari-primary)"
                  }`}
                >
                  {item.icon}
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>

          <div className="mt-3 flex flex-row gap-2 px-1 md:flex-col">
            {canAccessAdmin ? (
              <Link
                to="/admin"
                className="fuwari-btn-regular flex flex-1 items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-medium"
              >
                进入后台
              </Link>
            ) : null}
            <button
              type="button"
              onClick={logout}
              className="flex flex-1 items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-medium fuwari-text-50 hover:text-red-500 transition-colors"
            >
              <LogOut size={15} />
              退出登录
            </button>
          </div>
        </aside>

        {/* 右侧内容 */}
        <div className="min-w-0 flex-1">
          {view === "overview" && (
            <OverviewView
              user={user}
              onGoResources={() => handleGoto("resources")}
              onGoPlans={() => handleGoto("plans")}
            />
          )}
          {view === "checkin" && <CheckinView />}
          {view === "points" && <PointsView onRecharge={handleRecharge} />}
          {view === "plans" && <PlansView />}
          {view === "resources" && <ResourcesView />}
          {view === "profile" && <ProfileView user={user} />}
          {view === "prefs" && <PrefsView user={user} />}
          {view === "friendlink" && <FriendLinkView user={user} />}
        </div>
      </div>
    </div>
  );
}
