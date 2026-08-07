import { Link } from "@tanstack/react-router";
import { Crown, Download, Loader2, X } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { Fragment, useState } from "react";
import { createPortal } from "react-dom";
import { toast } from "sonner";
import { authClient } from "@/lib/auth/auth.client";
import {
  usePublicPostResources,
  useUnlockPostResource,
  myDailyDownloadQuotaQuery,
} from "@/features/post-resources/queries";
import { myPointsQuery } from "@/features/users/queries";
import { usePointConfig } from "@/features/config/queries";
import { logResourceDownloadFn } from "@/features/post-resources/api/post-resources.public.api";
import type { PublicResourceView } from "@/features/post-resources/api/post-resources.public.api";

// ─── 资源类型标签文案 ───
function accessBadge(
  accessType: PublicResourceView["accessType"],
  reason: PublicResourceView["access"]["reason"],
): string {
  switch (reason) {
    case "free":
    case "member_free":
    case "unlocked":
      return accessType === "paid" ? "付费资源" : "免费资源";
    case "login_required":
      return "登录可见";
    case "member_only":
      return "会员专享";
    case "paid":
      return "付费资源";
    default:
      return "资源";
  }
}

// ─── 复制工具 ───
function useCopy() {
  const copy = (text: string, label = "已复制") => {
    navigator.clipboard.writeText(text).then(() => toast.success(label)).catch(() => toast.error("复制失败"));
  };
  return { copy };
}

type DialogState = {
  mode: "confirm" | "insufficient";
  r: PublicResourceView;
  displayTitle: string;
  pointName: string;
  balance: number;
};

/**
 * 侧边栏下载模块 —— 每个下载资源是独立的一张卡片。
 *
 * 视觉结构（每张卡片从上到下）：
 *   1. 流动变色蓝色顶栏 → 资源标题（无标题时回退文章标题）
 *   2. 居中资源类型标签（免费资源 / 会员专享 / 付费资源 / 登录可见）
 *   3. 下载内容：
 *      - 可访问：绿色下载按钮(左) + 深灰网盘提取码(右) 网格排列 + 橙色通用解压码条
 *      - 未登录 / 会员专享 / 收费未解锁：对应状态卡片（点击下载按钮弹确认框，不直接扣费）
 *   4. 底部 💡 提示条（该资源有解压码时显示）
 */
export function SidebarDownloadBox({
  postId,
  postTitle,
}: {
  postId: number;
  postTitle?: string;
}) {
  const { data: resources, isLoading } = usePublicPostResources(postId);
  const unlock = useUnlockPostResource(postId);
  const { data: session } = authClient.useSession();
  const isAuthed = !!session?.user;
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [dialog, setDialog] = useState<DialogState | null>(null);
  const { data: myPoints } = useQuery({ ...myPointsQuery(), enabled: isAuthed });
  const { data: pointConfig } = usePointConfig();
  const { data: quota, refetch: refetchQuota } = useQuery({
    ...myDailyDownloadQuotaQuery,
    enabled: isAuthed,
  });
  const { copy } = useCopy();

  if (isLoading || !resources || resources.length === 0) return null;

  // 每日下载配额（前端拦截用）
  const isQuotaLoaded = !!quota;
  const unlimited = quota?.unlimited ?? false;
  const remaining = unlimited ? Infinity : quota ? Math.max(0, quota.remaining) : 0;
  const quotaHit = isAuthed && isQuotaLoaded && !unlimited && remaining <= 0;

  const guardDownload = (): boolean => {
    if (isAuthed && isQuotaLoaded && quotaHit) {
      toast.error(`今日下载次数已达上限（${quota?.limit} 篇/天）`);
      return false;
    }
    return true;
  };
  const onLocalDownload = (
    resourceId: string,
    fileUrl: string,
    fileName: string | null,
  ) => {
    logResourceDownloadFn({
      data: { resourceId, fileUrl, fileName },
    })
      .then(() => refetchQuota())
      .catch(() => {});
  };
  const onExternalDownload = (url: string) => {
    window.open(url, "_blank", "noopener,noreferrer");
    refetchQuota();
  };

  // 点击下载按钮：判断积分是否足够，弹「确认购买」或「积分不足」框（不直接购买）
  const openPurchaseDialog = (
    r: PublicResourceView,
    displayTitle: string,
    pointName: string,
    balance: number,
  ) => {
    const insufficient =
      !(balance >= r.access.userPrice) &&
      !(r.paymentEnabled && r.access.rmbEquivalent > 0);
    setDialog({ mode: insufficient ? "insufficient" : "confirm", r, displayTitle, pointName, balance });
  };

  // 弹窗「确认购买」：真正执行解锁/兑换
  const confirmPurchase = async () => {
    if (!dialog) return;
    const id = dialog.r.id;
    setPendingId(id);
    try {
      const res = await unlock.mutateAsync({ data: { resourceId: id } });
      if (res.status === "unlocked") toast.success("解锁成功");
      else if (res.status === "pending") toast.info(res.message ?? "已生成支付订单");
      else if (res.status === "insufficient") toast.error(res.message ?? "积分不足");
      else if (res.status === "forbidden") toast.error(res.message ?? "无权限");
      if (res.status === "unlocked" || res.status === "pending") setDialog(null);
    } catch {
      toast.error("操作失败，请稍后重试");
    } finally {
      setPendingId(null);
    }
  };

  return (
    <>
      {/* 流动变色顶栏 keyframes —— 只注入一次（class 全局生效） */}
      <style>{`
        @keyframes sidebarFlowBar {
          0% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }
        .sidebar-flow-bar {
          background: linear-gradient(90deg, #6A5ACD, #8B5CF6, #E91E8C, #E74C3C, #F39C12, #2ECC71, #6A5ACD);
          background-size: 300% 100%;
          animation: sidebarFlowBar 8s linear infinite;
        }
        @media (prefers-reduced-motion: reduce) {
          .sidebar-flow-bar { animation: none; }
        }
      `}</style>

      {/* 每个下载资源 = 一张独立卡片 */}
      <div className="space-y-3">
        {resources.map((r, idx) => {
          const pointName =
            r.priceType === "credits"
              ? pointConfig?.creditsName ?? "会员积分"
              : pointConfig?.pointsName ?? "普通积分";
          const balance =
            r.priceType === "credits" ? myPoints?.credits ?? 0 : myPoints?.points ?? 0;
          // 空标题自动兜底：有标题用标题，无标题按序号「下载资源 1」「下载资源 2」…，再无则回退文章标题
          const displayTitle = r.title || (resources.length > 1 ? `下载资源 ${idx + 1}` : postTitle) || "下载资源";

          return (
            <SidebarResourceCard
              key={r.id}
              r={r}
              isAuthed={isAuthed}
              balance={balance}
              pointName={pointName}
              onCopy={copy}
              displayTitle={displayTitle}
              onRequestUnlock={openPurchaseDialog}
              quotaHit={quotaHit}
              guardDownload={guardDownload}
              onLocalDownload={onLocalDownload}
              onExternalDownload={onExternalDownload}
            />
          );
        })}
      </div>

      {/* 购买确认 / 积分不足 弹窗 */}
      <PurchaseDialog
        state={dialog}
        onClose={() => setDialog(null)}
        onConfirm={confirmPurchase}
        pending={pendingId === dialog?.r.id}
      />
    </>
  );
}

/* ────────────────────────────────
   单个下载资源卡片（侧边栏窄列版本）
   ──────────────────────────────── */
function SidebarResourceCard({
  r,
  isAuthed,
  balance,
  pointName,
  onCopy,
  displayTitle,
  onRequestUnlock,
  quotaHit,
  guardDownload,
  onLocalDownload,
  onExternalDownload,
}: {
  r: PublicResourceView;
  isAuthed: boolean;
  balance: number;
  pointName: string;
  onCopy: (text: string, label?: string) => void;
  displayTitle?: string;
  onRequestUnlock: (
    r: PublicResourceView,
    displayTitle: string,
    pointName: string,
    balance: number,
  ) => void;
  /** 今日下载已达上限（仅当已登录且后台设了上限时生效） */
  quotaHit: boolean;
  /** 拦截检查：返回 true 表示允许下载；false 表示已拦截并提示 */
  guardDownload: () => boolean;
  /** 本地附件下载：内部已做拦截 + 记日志 + 刷新配额 */
  onLocalDownload: (resourceId: string, fileUrl: string, fileName: string | null) => void;
  /** 外链下载：内部已做拦截 + 打开中转链接 */
  onExternalDownload: (url: string) => void;
}) {
  const { access } = r;

  return (
    <div className="fuwari-card-base overflow-hidden">
      {/* ═══ 1. 流动变色顶栏（显示该资源标题，无标题回退序号/文章标题） ═══ */}
      <div className="sidebar-flow-bar text-white text-center py-3 px-4 text-[15px] font-medium rounded-t-xl">
        {displayTitle}
      </div>

      <div className="p-3 space-y-3">
        {/* ═══ 2. 资源类型标签（基于该资源自身） ═══ */}
        <div className="text-center">
          <span
            className={`inline-block text-xs font-medium px-3 py-1 rounded-full ${
              access.accessible
                ? "text-emerald-700 bg-emerald-50"
                : access.reason === "paid"
                  ? "text-amber-700 bg-amber-50"
                  : access.reason === "member_only"
                    ? "text-purple-700 bg-purple-50"
                    : "text-slate-500 bg-slate-100"
            }`}
          >
            {accessBadge(r.accessType, access.reason)}（{access.accessible ? "已解锁" : "未解锁"}）
          </span>
        </div>

        {/* ═══ 3. 下载内容 ═══ */}
        {access.accessible ? (
          <div className="space-y-2">
            {/* 下载按钮 + 提取码 网格 */}
            <div className="grid grid-cols-2 gap-2">
              {r.links.map((l, i) => {
                const isLocal = l.type === "本地附件";
                return (
                  <Fragment key={i}>
                    {/* 左：绿色下载按钮 */}
                    {isLocal ? (
                      <a
                        href={l.url}
                        target="_blank"
                        rel="noreferrer noopener"
                        download={l.url.split("/").pop() ?? ""}
                        onClick={(e) => {
                          if (!guardDownload()) {
                            e.preventDefault();
                            return;
                          }
                          onLocalDownload(
                            r.id,
                            l.url,
                            l.url.split("/").pop() ?? null,
                          );
                        }}
                        className={`flex items-center justify-center gap-1.5 bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-medium py-2.5 rounded-lg transition-colors ${
                          quotaHit ? "pointer-events-none opacity-50" : ""
                        }`}
                      >
                        <Download size={14} />
                        <span className="truncate">{l.type}</span>
                      </a>
                    ) : (
                      <button
                        type="button"
                        disabled={quotaHit}
                        onClick={() => {
                          if (!guardDownload()) return;
                          onExternalDownload(l.url);
                        }}
                        className="flex items-center justify-center gap-1.5 bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-medium py-2.5 rounded-lg transition-colors disabled:opacity-50"
                      >
                        <Download size={14} />
                        <span className="truncate">{l.type.replace("盘", "")}</span>
                      </button>
                    )}

                    {/* 右：深灰提取码 */}
                    <button
                      type="button"
                      onClick={() => (l.password ? onCopy(l.password, `已复制提取码：${l.password}`) : null)}
                      className={`flex items-center justify-center text-sm font-mono py-2.5 rounded-lg transition-colors ${
                        l.password
                          ? "bg-slate-600 hover:bg-slate-500 text-white cursor-pointer"
                          : "bg-slate-200 text-slate-400 cursor-default"
                      }`}
                      disabled={!l.password}
                    >
                      {l.password ?? "—"}
                    </button>
                  </Fragment>
                );
              })}
            </div>

            {/* 通用解压码（橙色条） */}
            {r.extractCode && (
              <button
                type="button"
                onClick={() => onCopy(r.extractCode!, `已复制解压码：${r.extractCode}`)}
                className="w-full flex items-center justify-center gap-1.5 bg-orange-500 hover:bg-orange-600 text-white text-sm font-medium py-2.5 rounded-lg transition-colors"
              >
                解压码：<span className="font-mono tracking-wider">{r.extractCode}</span>
              </button>
            )}
          </div>
        ) : access.reason === "login_required" ? (
          /* ── 未登录：主按钮按资源类型（免费=登录免费查看 / 其它=购买），下方登录+注册并排 ── */
          <div className="space-y-2.5">
            {r.accessType === "free" ? (
              <Link
                to="/login"
                className="block w-full text-center bg-amber-500 hover:bg-amber-600 text-white text-sm font-medium py-2.5 rounded-lg transition-colors"
              >
                登录免费查看
              </Link>
            ) : (
              <Link
                to="/login"
                className="block w-full text-center bg-amber-500 hover:bg-amber-600 text-white text-sm font-medium py-2.5 rounded-lg transition-colors"
              >
                购买资源
              </Link>
            )}
            <div className="grid grid-cols-2 gap-2">
              <Link
                to="/login"
                className="block w-full text-center bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-medium py-2.5 rounded-lg transition-colors"
              >
                登录
              </Link>
              <Link
                to="/register"
                className="block w-full text-center bg-slate-600 hover:bg-slate-700 text-white text-sm font-medium py-2.5 rounded-lg transition-colors"
              >
                注册
              </Link>
            </div>
          </div>
        ) : access.reason === "member_only" ? (
          /* ── 会员专享：提示开通会员 ── */
          <div className="space-y-2.5">
            <div className="flex items-center gap-2 text-sm">
              <Crown size={14} className="text-muted-foreground shrink-0" />
              <span className="font-medium truncate">{displayTitle}</span>
            </div>
            <p className="text-xs text-muted-foreground pl-6">会员专享资源，开通会员后可查看下载</p>
            <Link
              to={isAuthed ? "/membership" : "/login"}
              className="block w-full text-center bg-purple-500 hover:bg-purple-600 text-white text-sm font-medium py-2.5 rounded-lg transition-colors"
            >
              {isAuthed ? "开通会员" : "登录后开通"}
            </Link>
          </div>
        ) : (
          /* ── 收费（未解锁）：点击下载按钮弹确认框，不直接扣费 ── */
          <div className="space-y-3">
            {/* 下载按钮：点击弹「确认购买 / 积分不足」框 */}
            {isAuthed ? (
              <button
                type="button"
                onClick={() => onRequestUnlock(r, displayTitle ?? "下载资源", pointName, balance)}
                className="w-full flex items-center justify-center gap-1.5 bg-slate-700 hover:bg-slate-800 text-white text-sm font-medium py-2.5 rounded-lg transition-colors"
              >
                <Download size={14} />
                下载（需购买解锁）
              </button>
            ) : (
              <Link
                to="/login"
                className="block w-full text-center bg-slate-700 hover:bg-slate-800 text-white text-sm font-medium py-2.5 rounded-lg transition-colors"
              >
                登录后购买
              </Link>
            )}

            {/* 积分不足提示（已登录且确实不足时） */}
            {isAuthed && !(balance >= access.userPrice) && !(r.paymentEnabled && access.rmbEquivalent > 0) && (
              <p className="text-xs text-amber-600">积分不足，请先充值后再购买</p>
            )}
          </div>
        )}

        {/* ═══ 4. 底部提示（该资源有解压码时显示） ═══ */}
        {r.extractCode && (
          <div className="flex items-start gap-2 text-xs text-muted-foreground bg-muted/40 rounded-lg px-3 py-2.5">
            <span className="mt-0.5">💡</span>
            <span>点击按钮自动复制密码，下载请保存到本地。</span>
          </div>
        )}
      </div>
    </div>
  );
}

/* ────────────────────────────────
   购买确认 / 积分不足 弹窗
   ──────────────────────────────── */
function PurchaseDialog({
  state,
  onClose,
  onConfirm,
  pending,
}: {
  state: DialogState | null;
  onClose: () => void;
  onConfirm: () => void;
  pending: boolean;
}) {
  if (!state) return null;
  const { mode, r, displayTitle, pointName, balance } = state;
  const insufficient = mode === "insufficient";
  const priceText =
    r.access.rmbEquivalent > 0
      ? `${r.access.userPrice} ${pointName}（约 ¥${r.access.rmbEquivalent}）`
      : `${r.access.userPrice} ${pointName}`;

  return createPortal(
    <div
      className={`fixed inset-0 z-[100] flex items-center justify-center p-4 transition-all duration-300 ${
        state ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
      }`}
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-background/90 backdrop-blur-sm"
        onClick={pending ? undefined : onClose}
      />

      {/* Modal Content */}
      <div className="relative w-full max-w-md bg-background border border-border/30 shadow-xl rounded-xl overflow-hidden">
        {/* Header */}
        <div className="px-6 pt-6 pb-3 flex items-start justify-between">
          <div className="space-y-1">
            <p
              className={`text-xs font-mono uppercase tracking-widest ${
                insufficient ? "text-amber-500" : "text-muted-foreground/60"
              }`}
            >
              [{insufficient ? "积分不足" : "确认购买"}]
            </p>
            <h2 className="text-xl font-serif font-medium text-foreground">
              {insufficient ? "积分不足" : "确认购买资源"}
            </h2>
          </div>
          <button
            onClick={onClose}
            disabled={pending}
            className="p-2 -mr-2 text-muted-foreground/50 hover:text-foreground transition-colors disabled:opacity-50"
          >
            <X size={16} strokeWidth={1.5} />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 pb-5 space-y-4">
          {/* 资源信息 */}
          <div className="rounded-lg border border-border/30 p-3 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-medium text-foreground truncate">{displayTitle}</span>
              <span className="shrink-0 text-[10px] font-medium px-2 py-0.5 rounded-full bg-amber-50 text-amber-700">
                {accessBadge(r.accessType, r.access.reason)}
              </span>
            </div>
            <div className="text-sm text-muted-foreground">
              价格：<span className="font-medium text-foreground">{priceText}</span>
            </div>
            {insufficient && (
              <div className="text-sm text-muted-foreground">
                当前余额：
                <span className="font-medium text-foreground">
                  {balance} {pointName}
                </span>
              </div>
            )}
          </div>

          <p className="text-sm text-muted-foreground/80 leading-relaxed">
            {insufficient
              ? "你的积分不足以购买该资源，请先充值后再来购买。"
              : "购买后将解锁该资源的下载链接与解压码。消耗积分不可退回，请确认是否购买？"}
          </p>
        </div>

        {/* Footer */}
        <div className="px-6 pb-6 flex justify-end gap-3">
          <button
            onClick={onClose}
            disabled={pending}
            className="px-4 py-2.5 text-xs font-mono uppercase tracking-widest text-muted-foreground/60 hover:text-foreground transition-colors disabled:opacity-50"
          >
            取消
          </button>
          {insufficient ? (
            <Link
              to="/membership"
              onClick={onClose}
              className="flex items-center justify-center gap-1.5 px-6 py-2.5 text-xs font-mono uppercase tracking-widest bg-amber-500 hover:bg-amber-600 text-white transition-all"
            >
              去充值
            </Link>
          ) : (
            <button
              onClick={onConfirm}
              disabled={pending}
              className="flex items-center justify-center gap-2 px-6 py-2.5 text-xs font-mono uppercase tracking-widest bg-foreground text-background hover:opacity-80 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {pending && <Loader2 size={12} className="animate-spin" />}
              <span>{pending ? "处理中" : "确认购买"}</span>
            </button>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
