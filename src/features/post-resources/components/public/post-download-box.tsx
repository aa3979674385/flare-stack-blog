import { Link } from "@tanstack/react-router";
import { Check, Copy, Crown, Loader2, Lock } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
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

function priceText(points: number, rmb: number, pointName: string): string {
  return rmb > 0
    ? `${points} ${pointName}（约 ¥${rmb}）`
    : `${points} ${pointName}`;
}

export function ResourceCard({
  r,
  onUnlock,
  pending,
  isAuthed,
  balance,
  pointName,
  quotaHit,
  guardDownload,
  onLocalDownload,
  onExternalDownload,
}: {
  r: PublicResourceView;
  onUnlock: (id: string) => void;
  pending: boolean;
  isAuthed: boolean;
  balance: number;
  pointName: string;
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
  const userPrice = access.userPrice;
  const enough = balance >= userPrice;
  const canPay = r.paymentEnabled && access.rmbEquivalent > 0;

  const handleCopy = (text: string) => {
    navigator.clipboard
      .writeText(text)
      .then(() => toast.success("已复制"))
      .catch(() => toast.error("复制失败"));
  };

  // 可见：直接展示链接
  if (access.accessible) {
    return (
      <div className="border border-border/30 p-4">
        <div className="flex items-center justify-between gap-3 mb-3">
          <div className="flex items-center gap-2 min-w-0">
            <span className="font-medium truncate">{r.title}</span>
            {r.access.reason === "unlocked" && (
              <span className="shrink-0 text-[10px] font-mono uppercase tracking-widest px-2 py-0.5 border border-border/40 text-muted-foreground">
                已解锁
              </span>
            )}
            {r.access.reason === "member_free" && (
              <span className="shrink-0 text-[10px] font-mono uppercase tracking-widest px-2 py-0.5 border border-border/40 text-muted-foreground">
                会员免费
              </span>
            )}
          </div>
        </div>
        {r.extractCode && (
          <p className="text-xs text-muted-foreground mb-3">
            解压码：<span className="font-mono">{r.extractCode}</span>
          </p>
        )}
        <ul className="space-y-2">
          {r.links.map((l, i) => {
            const isLocal = l.type === "本地附件";
            return (
              <li
                key={i}
                className="flex flex-wrap items-center gap-2 text-sm rounded bg-muted/30 px-3 py-2"
              >
                <span className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground border border-border/40 px-1.5 py-0.5">
                  {l.type}
                </span>
                {isLocal ? (
                  <>
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
                      className={`text-foreground hover:underline break-all flex-1 min-w-0 ${
                        quotaHit ? "pointer-events-none opacity-50" : ""
                      }`}
                    >
                      {l.url}
                    </a>
                    <button
                      type="button"
                      onClick={() => handleCopy(l.url)}
                      title="复制链接"
                      className="shrink-0 p-1 text-muted-foreground hover:text-foreground transition-colors"
                    >
                      <Copy size={13} />
                    </button>
                  </>
                ) : (
                  // 外链（网盘等）：按钮只展示本站中转路径 /dl/...，点击后由后台校验权限
                  // 并 302 跳转到真实网盘链接；真实地址不出现在前端代码 / 审查元素 / 接口 JSON 中，
                  // 下载日志也只在服务端记录。
                  <button
                    type="button"
                    disabled={quotaHit}
                    onClick={() => {
                      if (!guardDownload()) return;
                      onExternalDownload(l.url);
                    }}
                    className="inline-flex items-center gap-1.5 bg-foreground text-background px-3 py-1.5 text-xs font-mono uppercase tracking-widest hover:bg-foreground/90 transition-colors disabled:opacity-50"
                  >
                    <DownloadIcon /> 前往{l.type}下载
                  </button>
                )}
                {l.password ? (
                  <span className="shrink-0 text-xs text-muted-foreground">
                    提取码：
                    <button
                      type="button"
                      onClick={() => handleCopy(l.password!)}
                      className="font-mono hover:text-foreground underline decoration-dotted"
                    >
                      {l.password}
                    </button>
                  </span>
                ) : null}
              </li>
            );
          })}
        </ul>
      </div>
    );
  }

  // 未登录：统一提示登录后查看 / 下载（任何类型的资源都需先登录）
  if (access.reason === "login_required") {
    return (
      <div className="border border-border/30 p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <Lock size={14} className="text-muted-foreground" />
              <span className="font-medium truncate">{r.title}</span>
            </div>
            {r.extractCode && (
              <p className="text-xs text-muted-foreground mt-1">
                解压码：<span className="font-mono">{r.extractCode}</span>
              </p>
            )}
            <p className="text-xs text-muted-foreground mt-2">
              登录后即可查看与下载该资源。
            </p>
          </div>
        </div>
        <div className="mt-3">
          <Link
            to="/login"
            className="inline-flex items-center gap-2 bg-foreground text-background px-4 py-2 text-xs font-mono uppercase tracking-widest hover:bg-foreground/90 transition-colors"
          >
            登录后查看下载
          </Link>
        </div>
      </div>
    );
  }

  // 会员专享
  if (access.reason === "member_only") {
    return (
      <div className="border border-border/30 p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <Crown size={14} className="text-muted-foreground" />
              <span className="font-medium truncate">{r.title}</span>
            </div>
            {r.extractCode && (
              <p className="text-xs text-muted-foreground mt-1">
                解压码：<span className="font-mono">{r.extractCode}</span>
              </p>
            )}
            <p className="text-xs text-muted-foreground mt-2">
              会员专享资源，开通会员后可查看下载。
            </p>
          </div>
        </div>
        <div className="mt-3 flex items-center gap-3">
          {isAuthed ? (
            <Link
              to="/membership"
              className="inline-flex items-center gap-2 bg-foreground text-background px-4 py-2 text-xs font-mono uppercase tracking-widest hover:bg-foreground/90 transition-colors"
            >
              <Crown size={13} /> 开通会员
            </Link>
          ) : (
            <Link
              to="/login"
              className="inline-flex items-center gap-2 bg-foreground text-background px-4 py-2 text-xs font-mono uppercase tracking-widest hover:bg-foreground/90 transition-colors"
            >
              登录后开通会员
            </Link>
          )}
        </div>
      </div>
    );
  }

  // 收费（未解锁）
  return (
    <div className="border border-border/30 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <Lock size={14} className="text-muted-foreground" />
            <span className="font-medium truncate">{r.title}</span>
          </div>
          {r.extractCode && (
            <p className="text-xs text-muted-foreground mt-1">
              解压码：<span className="font-mono">{r.extractCode}</span>
            </p>
          )}
          <p className="text-lg font-serif mt-2">
            {priceText(userPrice, access.rmbEquivalent, pointName)}
            <span className="text-xs text-muted-foreground ml-2">
              （消耗{pointName}兑换）
            </span>
          </p>
          {!isAuthed && (
            <p className="text-xs text-muted-foreground mt-1">登录后可购买 / 兑换</p>
          )}
        </div>
      </div>
      {isAuthed && (
        <div className="mt-3">
          {enough ? (
            <button
              type="button"
              disabled={pending}
              onClick={() => onUnlock(r.id)}
              className="inline-flex items-center gap-2 bg-foreground text-background px-4 py-2 text-xs font-mono uppercase tracking-widest hover:bg-foreground/90 transition-colors disabled:opacity-60"
            >
              {pending ? (
                <Loader2 size={13} className="animate-spin" />
              ) : (
                <Check size={13} />
              )}
              消耗 {userPrice} {pointName}兑换
            </button>
          ) : canPay ? (
            <button
              type="button"
              disabled={pending}
              onClick={() => onUnlock(r.id)}
              className="inline-flex items-center gap-2 bg-foreground text-background px-4 py-2 text-xs font-mono uppercase tracking-widest hover:bg-foreground/90 transition-colors disabled:opacity-60"
            >
              {pending ? (
                <Loader2 size={13} className="animate-spin" />
              ) : (
                <Lock size={13} />
              )}
              支付 ¥{access.rmbEquivalent} 购买
            </button>
          ) : (
            <button
              type="button"
              disabled
              className="inline-flex items-center gap-2 bg-foreground/30 text-background/60 px-4 py-2 text-xs font-mono uppercase tracking-widest cursor-not-allowed"
            >
              <Lock size={13} />
              积分不足{!r.paymentEnabled ? "（未接入支付）" : ""}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export function PostDownloadBox({ postId }: { postId: number }) {
  const { data: resources, isLoading } = usePublicPostResources(postId);
  const unlock = useUnlockPostResource(postId);
  const { data: session } = authClient.useSession();
  const isAuthed = !!session?.user;
  const [pendingId, setPendingId] = useState<string | null>(null);
  const { data: myPoints } = useQuery({
    ...myPointsQuery(),
    enabled: isAuthed,
  });
  const { data: pointConfig } = usePointConfig();
  const { data: quota, refetch: refetchQuota } = useQuery({
    ...myDailyDownloadQuotaQuery,
    enabled: isAuthed,
  });

  if (isLoading || !resources || resources.length === 0) return null;

  // 每日下载配额（前端拦截用）：未登录/未加载时不拦截；unlimited 表示后台未设上限
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

  const handleUnlock = async (id: string) => {
    setPendingId(id);
    try {
      const res = await unlock.mutateAsync({ data: { resourceId: id } });
      if (res.status === "unlocked") {
        toast.success("解锁成功");
      } else if (res.status === "pending") {
        toast.info(res.message ?? "已生成支付订单（支付网关待接入）");
      } else if (res.status === "insufficient") {
        toast.error(res.message ?? "积分不足");
      } else if (res.status === "forbidden") {
        toast.error(res.message ?? "无权限");
      }
    } catch {
      toast.error("操作失败，请稍后重试");
    } finally {
      setPendingId(null);
    }
  };

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <DownloadIcon />
          <h2 className="text-xl font-serif font-medium">下载资源</h2>
        </div>
        {isAuthed && isQuotaLoaded && !unlimited && (
          <span className="text-xs text-muted-foreground">
            今日剩余下载：<span className="font-medium text-foreground">{remaining}</span> / {quota?.limit} 篇
          </span>
        )}
        {isAuthed && isQuotaLoaded && unlimited && (
          <span className="text-xs text-muted-foreground">今日下载不限次数</span>
        )}
      </div>
      <div className="space-y-3">
        {resources.map((r) => {
          const pointName =
            r.priceType === "credits"
              ? pointConfig?.creditsName ?? "会员积分"
              : pointConfig?.pointsName ?? "普通积分";
          const balance =
            r.priceType === "credits"
              ? myPoints?.credits ?? 0
              : myPoints?.points ?? 0;
          return (
            <ResourceCard
              key={r.id}
              r={r}
              onUnlock={handleUnlock}
              pending={pendingId === r.id}
              isAuthed={isAuthed}
              balance={balance}
              pointName={pointName}
              quotaHit={quotaHit}
              guardDownload={guardDownload}
              onLocalDownload={onLocalDownload}
              onExternalDownload={onExternalDownload}
            />
          );
        })}
      </div>
    </section>
  );
}

function DownloadIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="opacity-70"
    >
      <path d="M12 3v12" />
      <path d="m7 10 5 5 5-5" />
      <path d="M5 21h14" />
    </svg>
  );
}
