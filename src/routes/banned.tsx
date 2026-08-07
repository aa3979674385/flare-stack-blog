import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createFileRoute,
  useNavigate,
} from "@tanstack/react-router";
import { Loader2, Lock, LogOut, MailWarning } from "lucide-react";
import { useState } from "react";
import { authClient } from "@/lib/auth/auth.client";
import { AUTH_KEYS } from "@/features/auth/queries";
import {
  banInfoByEmailQuery,
  bannedStatusQuery,
} from "@/features/users/queries";

export const Route = createFileRoute("/banned")({
  validateSearch: (search: Record<string, unknown>) => ({
    email: typeof search.email === "string" ? search.email : undefined,
  }),
  component: BannedPage,
  head: () => ({
    meta: [{ title: "账号已被封禁" }],
  }),
});

function pad(n: number) {
  return n < 10 ? `0${n}` : `${n}`;
}

function formatExpiry(banExpires: number | null) {
  if (banExpires == null) {
    return { permanent: true, dateStr: "", remaining: "" };
  }
  const diff = banExpires - Date.now();
  if (diff <= 0) {
    return { permanent: false, dateStr: "", remaining: "（封禁已到期）" };
  }
  const d = new Date(banExpires);
  const dateStr = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(
    d.getDate(),
  )} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  const days = Math.floor(diff / 86_400_000);
  const hours = Math.floor((diff % 86_400_000) / 3_600_000);
  const mins = Math.floor((diff % 3_600_000) / 60_000);
  const remaining = `剩余 ${days} 天 ${hours} 小时${mins > 0 ? ` ${mins} 分` : ""}`;
  return { permanent: false, dateStr, remaining };
}

function BannedPage() {
  const { email } = Route.useSearch();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const cookieBan = useQuery(bannedStatusQuery());
  const emailBan = useQuery({
    ...banInfoByEmailQuery(email ?? ""),
    enabled: !!email && !cookieBan.data,
  });

  const ban = cookieBan.data ?? (email ? emailBan.data : null);
  const isLoading = cookieBan.isLoading || (email ? emailBan.isLoading : false);

  const [loggingOut, setLoggingOut] = useState(false);

  const logout = async () => {
    setLoggingOut(true);
    await authClient.signOut();
    queryClient.removeQueries({ queryKey: AUTH_KEYS.session });
    navigate({ to: "/login" });
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-background text-muted-foreground">
        <Loader2 className="w-8 h-8 animate-spin" />
        <p className="text-xs font-mono uppercase tracking-widest">加载中…</p>
      </div>
    );
  }

  // 未查询到封禁信息（如直接访问 /banned 且未登录）
  if (!ban) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-6 bg-background px-6 text-center">
        <MailWarning size={48} strokeWidth={1} className="text-muted-foreground/40" />
        <div>
          <h1 className="text-2xl font-serif font-medium text-foreground">
            未查询到封禁信息
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            该账号当前未被封禁，或封禁信息已失效。
          </p>
        </div>
        <button
          onClick={() => navigate({ to: "/login" })}
          className="px-6 py-2.5 text-xs font-mono uppercase tracking-widest bg-foreground text-background hover:opacity-80 transition-opacity"
        >
          前往登录
        </button>
      </div>
    );
  }

  const { permanent, dateStr, remaining } = formatExpiry(ban.banExpires);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-8 bg-background px-6 text-center">
      <div className="w-20 h-20 border border-border/40 flex items-center justify-center bg-muted/20">
        <Lock size={36} strokeWidth={1} className="text-foreground/70" />
      </div>

      <div className="space-y-3 max-w-md">
        <p className="text-[10px] font-mono uppercase tracking-[0.3em] text-muted-foreground/60">
          [ ACCOUNT SUSPENDED ]
        </p>
        <h1 className="text-3xl font-serif font-medium tracking-tight text-foreground">
          账号已被封禁
        </h1>
        <p className="text-sm text-muted-foreground leading-relaxed">
          由于违反社区规范或管理员操作，该账号已被限制登录。
          {email ? `（${email}）` : ""}
        </p>
      </div>

      <div className="w-full max-w-md border border-border/30 divide-y divide-border/10 text-left">
        <div className="flex items-center justify-between gap-4 px-5 py-4">
          <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-muted-foreground">
            封禁状态
          </span>
          <span className="text-sm font-medium text-destructive">已封禁</span>
        </div>
        <div className="flex items-start justify-between gap-4 px-5 py-4">
          <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-muted-foreground shrink-0">
            封禁期限
          </span>
          <span className="text-right text-sm font-medium text-foreground">
            {permanent ? (
              "永久封禁"
            ) : (
              <>
                <div>至 {dateStr}</div>
                <div className="text-muted-foreground text-xs mt-0.5">
                  {remaining}
                </div>
              </>
            )}
          </span>
        </div>
        <div className="flex items-start justify-between gap-4 px-5 py-4">
          <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-muted-foreground shrink-0">
            封禁原因
          </span>
          <span className="text-right text-sm text-foreground">
            {ban.banReason?.trim() ? ban.banReason : "（未提供）"}
          </span>
        </div>
      </div>

      <p className="text-xs text-muted-foreground/70 max-w-md">
        如需申诉或了解详情，请联系站点管理员。封禁到期后账号将自动恢复。
      </p>

      <button
        onClick={logout}
        disabled={loggingOut}
        className="flex items-center justify-center gap-2 px-6 py-2.5 text-xs font-mono uppercase tracking-widest border border-border/40 text-muted-foreground hover:text-foreground hover:border-foreground/40 transition-colors disabled:opacity-50"
      >
        {loggingOut ? (
          <Loader2 size={14} className="animate-spin" />
        ) : (
          <LogOut size={14} />
        )}
        退出登录
      </button>
    </div>
  );
}
