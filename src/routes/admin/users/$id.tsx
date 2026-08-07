import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowLeft,
  Ban,
  Coins,
  Crown,
  Loader2,
  Save,
  ShieldAlert,
  ShieldCheck,
  ShieldOff,
  Trash2,
} from "lucide-react";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import ConfirmationModal from "@/components/ui/confirmation-modal";
import { formatDate } from "@/lib/utils";
import { sessionQuery } from "@/features/auth/queries";
import {
  userDetailQuery,
  useAdjustUserPoints,
  useDeleteUser,
  useSetUserMembership,
  useUpdateUser,
} from "@/features/users/queries";
import { useMembershipPlanOptions } from "@/features/membership/queries";
import { isUserMember } from "@/features/post-resources/data/post-resources.data";
import { usePointConfig } from "@/features/config/queries";
import {
  BanDialog,
  type BanDialogValue,
} from "@/features/users/components/admin/ban-dialog";
import {
  ALL_PERMISSION_KEYS,
  PERMISSION_CATEGORIES,
  PERMISSIONS,
} from "@/lib/permissions";

const formSchema = z.object({
  name: z.string().min(1, "名称不能为空").max(80),
  role: z.enum(["admin", "user"]),
});

type FormValues = z.infer<typeof formSchema>;

export const Route = createFileRoute("/admin/users/$id")({
  ssr: "data-only",
  component: UserDetailPage,
  loader: () => ({ title: "用户详情" }),
  head: ({ loaderData }) => ({
    meta: [{ title: loaderData?.title }],
  }),
});

function pad(n: number) {
  return n < 10 ? `0${n}` : `${n}`;
}

function formatExpiry(banExpires: Date | null | undefined) {
  if (!banExpires) return { permanent: true, text: "永久封禁" };
  const diff = banExpires.getTime() - Date.now();
  if (diff <= 0) return { permanent: false, text: "（已到期，将自动解封）" };
  const days = Math.floor(diff / 86_400_000);
  const hours = Math.floor((diff % 86_400_000) / 3_600_000);
  const d = new Date(banExpires);
  const dateStr = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(
    d.getDate(),
  )} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  return {
    permanent: false,
    text: `至 ${dateStr}（剩余 ${days} 天 ${hours} 小时）`,
  };
}

function toDateInputValue(d: Date | string | number): string {
  const date = new Date(d);
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function defaultExpiryValue(): string {
  const d = new Date(Date.now() + 30 * 86_400_000);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** 解析 user.permissions：支持字符串(JSON) / 数组 / null */
function parsePerms(input: unknown): string[] | null {
  if (input == null) return null;
  if (Array.isArray(input)) return input as string[];
  if (typeof input === "string") {
    try {
      const v = JSON.parse(input);
      return Array.isArray(v) ? (v as string[]) : [];
    } catch {
      return [];
    }
  }
  return [];
}

function UserDetailPage() {
  const { id } = Route.useParams();
  const { data: user, isLoading, isError } = useQuery(userDetailQuery(id));
  const updateUser = useUpdateUser();
  const deleteUser = useDeleteUser();
  const adjustPoints = useAdjustUserPoints();
  const { data: pointConfig } = usePointConfig();
  const { data: membershipPlans = [] } = useMembershipPlanOptions();
  const setMembership = useSetUserMembership();
  const navigate = useNavigate();

  // 会员状态：关联套餐 + 到期日期
  const [planId, setPlanId] = useState<string>("");
  const [expiryStr, setExpiryStr] = useState<string>(defaultExpiryValue());

  // 积分调整本地状态：按字段维护（数量 / 原因 / 模式）
  const [ptState, setPtState] = useState<Record<string, { amount: string; reason: string; mode: "add" | "sub" }>>({
    points: { amount: "", reason: "", mode: "add" },
    credits: { amount: "", reason: "", mode: "add" },
  });

  const handleAdjustPoints = async (field: "points" | "credits") => {
    if (!user) return;
    const s = ptState[field];
    const amount = Number.parseInt(s.amount, 10);
    if (!Number.isFinite(amount) || amount <= 0) {
      toast.error("请输入大于 0 的整数");
      return;
    }
    try {
      await adjustPoints.mutateAsync({
        id: user.id,
        type: field,
        delta: s.mode === "add" ? amount : -amount,
        reason: s.reason || null,
      });
      toast.success(
        `${field === "points" ? pointConfig?.pointsName ?? "普通积分" : pointConfig?.creditsName ?? "会员积分"}已${s.mode === "add" ? "添加" : "扣除"} ${amount}`,
      );
      setPtState((prev) => ({
        ...prev,
        [field]: { amount: "", reason: "", mode: "add" },
      }));
    } catch {
      toast.error("积分调整失败，请稍后重试");
    }
  };
  const { data: me } = useQuery(sessionQuery);
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { name: "", role: "user" },
  });
  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { isDirty, isSubmitting },
  } = form;

  const [banDialogOpen, setBanDialogOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const isSelf = !!me?.user && me.user.id === id;

  // 权限编辑状态：perm 为 null 表示超级管理员（拥有全部权限）
  const [perm, setPerm] = useState<string[] | null>(null);
  const [isSuper, setIsSuper] = useState(true);
  const [permChanged, setPermChanged] = useState(false);
  const currentRole = watch("role");

  useEffect(() => {
    if (user) {
      reset({
        name: user.name,
        role: (user.role as "admin" | "user") ?? "user",
      });
      const p = parsePerms(user.permissions);
      setPerm(p);
      setIsSuper(p === null);
      setPermChanged(false);
      setPlanId(user.membershipPlanId ?? membershipPlans[0]?.id ?? "");
      setExpiryStr(
        user.membershipExpiresAt
          ? toDateInputValue(user.membershipExpiresAt)
          : defaultExpiryValue(),
      );
    }
  }, [user, reset, membershipPlans]);

  if (isLoading) {
    return (
      <div className="py-24 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (isError || !user) {
    return (
      <div className="py-24 flex flex-col items-center justify-center text-muted-foreground font-serif italic gap-4 border-t border-border">
        <ShieldAlert size={40} strokeWidth={1} className="opacity-30" />
        <p>未找到该用户</p>
        <Link
          to="/admin/users"
          className="text-xs font-mono uppercase tracking-widest underline"
        >
          返回用户列表
        </Link>
      </div>
    );
  }

  const banned = !!user.banned;
  const expiry = formatExpiry(user.banExpires);

  const onSaveProfile = async (values: FormValues) => {
    try {
      await updateUser.mutateAsync({
        id: user.id,
        name: values.name,
        role: values.role,
        // 仅管理员写入权限；超级管理员存 null，普通用户忽略
        permissions:
          values.role === "admin" ? (isSuper ? null : perm ?? []) : null,
        banned,
        banReason: banned ? user.banReason ?? null : null,
        banExpires: banned
          ? user.banExpires
            ? user.banExpires.getTime()
            : null
          : null,
      });
      setPermChanged(false);
      toast.success("用户资料已更新");
    } catch {
      toast.error("更新失败，请稍后重试");
    }
  };

  const handleBanConfirm = async (value: BanDialogValue) => {
    try {
      await updateUser.mutateAsync({
        id: user.id,
        name: form.getValues("name"),
        role: form.getValues("role"),
        banned: true,
        banReason: value.reason || null,
        banExpires:
          value.durationDays != null
            ? Date.now() + value.durationDays * 86_400_000
            : null,
      });
      toast.success("账号已封禁");
      setBanDialogOpen(false);
    } catch {
      toast.error("封禁失败，请稍后重试");
    }
  };

  const handleUnban = async () => {
    try {
      await updateUser.mutateAsync({
        id: user.id,
        name: form.getValues("name"),
        role: form.getValues("role"),
        banned: false,
        banReason: null,
        banExpires: null,
      });
      toast.success("账号已解封");
    } catch {
      toast.error("解封失败，请稍后重试");
    }
  };

  const handleGrantMembership = async () => {
    if (!planId) {
      toast.error("请先选择关联套餐");
      return;
    }
    if (!expiryStr) {
      toast.error("请选择到期日期");
      return;
    }
    const ts = new Date(expiryStr + "T23:59:59").getTime();
    try {
      await setMembership.mutateAsync({
        id: user.id,
        planId,
        expiresAt: ts,
      });
      toast.success("已设为会员");
    } catch {
      toast.error("操作失败，请稍后重试");
    }
  };

  const handleRevokeMembership = async () => {
    try {
      await setMembership.mutateAsync({
        id: user.id,
        planId: null,
        expiresAt: null,
      });
      toast.success("已取消会员");
    } catch {
      toast.error("操作失败，请稍后重试");
    }
  };

  const isMember = isUserMember(user);

  return (
    <div className="space-y-8 pb-20 animate-in fade-in slide-in-from-bottom-4 duration-1000">
      {/* 头部 */}
      <div className="flex items-center justify-between border-b border-border/30 pb-6">
        <div className="flex items-center gap-4">
          <Link
            to="/admin/users"
            className="p-2 -ml-2 text-muted-foreground hover:text-foreground transition-colors"
            aria-label="返回"
          >
            <ArrowLeft size={18} />
          </Link>
          <div>
            <h1 className="text-2xl font-serif font-medium tracking-tight text-foreground">
              {user.name}
            </h1>
            <p className="text-xs font-mono tracking-widest text-muted-foreground uppercase">
              用户详情与设置
            </p>
          </div>
        </div>
        <Button
          type="submit"
          form="user-edit-form"
          disabled={isSubmitting || (!isDirty && !permChanged)}
          className="hidden sm:flex h-11 px-8 rounded-none bg-foreground text-background hover:bg-foreground/90 transition-all font-mono text-[11px] uppercase tracking-[0.2em]"
        >
          {isSubmitting ? (
            <Loader2 className="animate-spin" size={14} />
          ) : (
            <Save size={14} />
          )}
          保存
        </Button>
      </div>

      <div className="grid gap-8 lg:grid-cols-3">
        {/* 左：基本信息（只读） */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle>基本信息</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <InfoRow label="用户 ID" value={user.id} mono />
            <InfoRow label="邮箱" value={user.email} mono />
            <InfoRow
              label="邮箱验证"
              value={user.emailVerified ? "已验证" : "未验证"}
            />
            <InfoRow
              label="角色"
              value={user.role === "admin" ? "管理员" : "普通用户"}
            />
            <InfoRow
              label="封禁状态"
              value={banned ? "已封禁" : "正常"}
            />
            <InfoRow
              label="封禁到期"
              value={user.banExpires ? formatDate(user.banExpires) : "—"}
            />
            <InfoRow label="注册时间" value={formatDate(user.createdAt)} />
            <InfoRow label="更新时间" value={formatDate(user.updatedAt)} />
            <InfoRow
              label={pointConfig?.pointsName ?? "普通积分"}
              value={String(user.points ?? 0)}
              mono
            />
            <InfoRow
              label={pointConfig?.creditsName ?? "会员积分"}
              value={String(user.credits ?? 0)}
              mono
            />

            {/* 删除账号：小按钮 + 注释，不放大框 */}
            <div className="pt-4 mt-2 border-t border-border/10 space-y-2">
              <p className="text-[11px] leading-relaxed text-muted-foreground/70">
                删除后不可恢复：登录会话与第三方绑定将被清除，已发布评论转为匿名。
              </p>
              <Button
                type="button"
                disabled={isSelf}
                onClick={() => setDeleteOpen(true)}
                className="h-8 px-3 text-xs rounded-none bg-transparent text-destructive border border-destructive/40 hover:bg-destructive/10 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Trash2 size={13} />
                删除账号
              </Button>
              {isSelf ? (
                <span className="block text-[11px] font-mono uppercase tracking-widest text-muted-foreground">
                  不能删除当前登录的管理员账号
                </span>
              ) : null}
            </div>
          </CardContent>
        </Card>

        {/* 右：可编辑设置 */}
        <form
          id="user-edit-form"
          onSubmit={handleSubmit(onSaveProfile)}
          className="lg:col-span-2 space-y-8"
        >
          <Card>
            <CardHeader>
              <CardTitle>账户设置</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <label className="text-[10px] font-mono uppercase tracking-[0.2em] text-muted-foreground">
                  昵称 / 姓名
                </label>
                <Input {...register("name")} className="max-w-sm" />
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-mono uppercase tracking-[0.2em] text-muted-foreground">
                  角色
                </label>
                <select
                  {...register("role")}
                  className="h-9 w-full max-w-sm rounded-none border-b border-input bg-transparent px-0 py-1 text-sm focus-visible:outline-hidden focus-visible:border-foreground"
                >
                  <option value="user">普通用户</option>
                  <option value="admin">管理员</option>
                </select>
              </div>
            </CardContent>
          </Card>

          {/* 账号封禁管理 */}
          <Card
            className={
              banned ? "border-destructive/40 bg-destructive/5" : undefined
            }
          >
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Ban size={16} className={banned ? "text-destructive" : "opacity-60"} />
                账号封禁
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {banned ? (
                <>
                  <div className="text-sm text-muted-foreground leading-relaxed">
                    该账号当前处于封禁状态。
                    <span className="text-foreground font-medium">
                      {expiry.permanent
                        ? " 永久封禁"
                        : ` ${expiry.text}`}
                    </span>
                    {user.banReason?.trim() ? (
                      <>
                        <br />
                        封禁原因：{user.banReason}
                      </>
                    ) : null}
                  </div>
                  <div className="flex flex-wrap gap-3 pt-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setBanDialogOpen(true)}
                    >
                      修改封禁
                    </Button>
                    <Button
                      type="button"
                      onClick={handleUnban}
                      disabled={updateUser.isPending}
                      className="bg-foreground text-background hover:bg-foreground/90"
                    >
                      {updateUser.isPending ? (
                        <Loader2 size={14} className="animate-spin" />
                      ) : (
                        <ShieldOff size={14} />
                      )}
                      解封账号
                    </Button>
                  </div>
                </>
              ) : (
                <>
                  <div className="text-sm text-muted-foreground leading-relaxed">
                    封禁后该用户将被强制退出并无法登录，直到封禁到期或手动解封。
                  </div>
                  <Button
                    type="button"
                    onClick={() => setBanDialogOpen(true)}
                    className="bg-destructive text-destructive-foreground hover:opacity-80"
                  >
                    <Ban size={14} />
                    封禁账号
                  </Button>
                </>
              )}
            </CardContent>
          </Card>

          {/* 管理权限（分级控制） */}
          {currentRole === "admin" && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ShieldCheck size={16} className="opacity-60" />
                  管理权限
                  <span className="text-[9px] font-mono uppercase tracking-widest text-muted-foreground border border-border/40 px-2 py-0.5">
                    分级
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-5">
                <label className="flex items-start gap-3 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={isSuper}
                    onChange={(e) => {
                      const ns = e.target.checked;
                      setIsSuper(ns);
                      if (!ns) setPerm([...ALL_PERMISSION_KEYS]);
                      setPermChanged(true);
                    }}
                    className="mt-0.5"
                  />
                  <div>
                    <div className="text-sm font-medium">
                      超级管理员（拥有全部权限）
                    </div>
                    <div className="text-[11px] text-muted-foreground leading-relaxed">
                      开启后该账号可使用所有后台功能，且未来新增的权限会自动包含。关闭则可单独勾选下方权限。
                    </div>
                  </div>
                </label>

                {!isSuper && (
                  <div className="space-y-4 border-t border-border/10 pt-4">
                    {PERMISSION_CATEGORIES.map((cat) => {
                      const items = PERMISSIONS.filter(
                        (p) => p.category === cat.key,
                      );
                      if (items.length === 0) return null;
                      return (
                        <div key={cat.key}>
                          <div className="text-[10px] font-mono uppercase tracking-[0.2em] text-muted-foreground mb-2">
                            {cat.label}
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2">
                            {items.map((p) => {
                              const checked = perm?.includes(p.key) ?? false;
                              return (
                                <label
                                  key={p.key}
                                  className="flex items-center gap-2 text-sm cursor-pointer select-none"
                                >
                                  <input
                                    type="checkbox"
                                    checked={checked}
                                    onChange={(e) => {
                                      setPerm((prev) => {
                                        const base = prev ?? [];
                                        return e.target.checked
                                          ? [...new Set([...base, p.key])]
                                          : base.filter((k) => k !== p.key);
                                      });
                                      setPermChanged(true);
                                    }}
                                  />
                                  {p.label}
                                </label>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* 积分管理（双积分：普通积分 / 会员积分） */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Coins size={16} className="opacity-60" />
                积分管理
                <span className="text-[9px] font-mono uppercase tracking-widest text-muted-foreground border border-border/40 px-2 py-0.5">
                  双积分
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {(
                [
                  { key: "points", label: pointConfig?.pointsName ?? "普通积分", desc: "可用于日常互动、内容兑换等通用场景" },
                  { key: "credits", label: pointConfig?.creditsName ?? "会员积分", desc: "会员专属积分，可用于会员权益与增值服务" },
                ] as const
              ).map((f) => {
                const s = ptState[f.key];
                const balance =
                  f.key === "points" ? user?.points ?? 0 : user?.credits ?? 0;
                return (
                  <div
                    key={f.key}
                    className="space-y-3 border-t border-border/10 pt-4 first:border-0 first:pt-0"
                  >
                    <div className="flex items-baseline justify-between gap-4">
                      <div>
                        <div className="text-sm font-medium">{f.label}</div>
                        <div className="text-[11px] text-muted-foreground">
                          {f.desc}
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
                          当前余额
                        </div>
                        <div className="text-2xl font-serif tabular-nums">
                          {balance}
                        </div>
                      </div>
                    </div>
                    <div className="flex flex-wrap items-end gap-3">
                      <div className="space-y-1">
                        <label className="text-[10px] font-mono uppercase tracking-[0.2em] text-muted-foreground">
                          数量
                        </label>
                        <Input
                          type="number"
                          min={1}
                          value={s.amount}
                          onChange={(e) =>
                            setPtState((p) => ({
                              ...p,
                              [f.key]: { ...p[f.key], amount: e.target.value },
                            }))
                          }
                          className="w-28"
                          placeholder="0"
                        />
                      </div>
                      <div className="flex gap-1">
                        <button
                          type="button"
                          onClick={() =>
                            setPtState((p) => ({
                              ...p,
                              [f.key]: { ...p[f.key], mode: "add" },
                            }))
                          }
                          className={`h-9 px-3 text-xs rounded-none ${
                            s.mode === "add"
                              ? "bg-foreground text-background"
                              : "border border-border text-muted-foreground hover:bg-muted"
                          }`}
                        >
                          添加
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            setPtState((p) => ({
                              ...p,
                              [f.key]: { ...p[f.key], mode: "sub" },
                            }))
                          }
                          className={`h-9 px-3 text-xs rounded-none ${
                            s.mode === "sub"
                              ? "bg-foreground text-background"
                              : "border border-border text-muted-foreground hover:bg-muted"
                          }`}
                        >
                          扣除
                        </button>
                      </div>
                      <div className="space-y-1 flex-1 min-w-[160px]">
                        <label className="text-[10px] font-mono uppercase tracking-[0.2em] text-muted-foreground">
                          原因（可选）
                        </label>
                        <Input
                          value={s.reason}
                          onChange={(e) =>
                            setPtState((p) => ({
                              ...p,
                              [f.key]: { ...p[f.key], reason: e.target.value },
                            }))
                          }
                          className="w-full"
                          placeholder="如：活动奖励 / 违规扣除"
                        />
                      </div>
                      <Button
                        type="button"
                        onClick={() => handleAdjustPoints(f.key)}
                        disabled={adjustPoints.isPending}
                        className="h-9"
                      >
                        {adjustPoints.isPending ? (
                          <Loader2 className="animate-spin" size={14} />
                        ) : (
                          <Coins size={14} />
                        )}
                        确认{s.mode === "add" ? "添加" : "扣除"}
                      </Button>
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>

          {/* 会员状态 */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Crown size={16} className="opacity-60" />
                会员状态
                <span className="text-[9px] font-mono uppercase tracking-widest text-muted-foreground border border-border/40 px-2 py-0.5">
                  会员
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="flex items-baseline justify-between gap-4">
                <div className="text-sm">
                  {isMember ? (
                    <span className="text-foreground font-medium">当前为会员</span>
                  ) : (
                    <span className="text-muted-foreground">非会员</span>
                  )}
                </div>
                {user.membershipExpiresAt && (
                  <div className="text-right shrink-0">
                    <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
                      到期时间
                    </div>
                    <div className="text-sm font-mono">
                      {formatDate(user.membershipExpiresAt)}
                    </div>
                  </div>
                )}
              </div>

              {membershipPlans.length === 0 ? (
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  尚无会员套餐，请先在「会员套餐」中添加套餐，再为用户开通会员。
                </p>
              ) : (
                <>
                  <div className="space-y-2">
                    <label className="text-[10px] font-mono uppercase tracking-[0.2em] text-muted-foreground">
                      关联套餐
                    </label>
                    <select
                      value={planId}
                      onChange={(e) => setPlanId(e.target.value)}
                      className="h-9 w-full max-w-sm rounded-none border-b border-input bg-transparent px-0 py-1 text-sm focus-visible:outline-hidden focus-visible:border-foreground"
                    >
                      {membershipPlans.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-mono uppercase tracking-[0.2em] text-muted-foreground">
                      到期日期
                    </label>
                    <input
                      type="date"
                      value={expiryStr}
                      onChange={(e) => setExpiryStr(e.target.value)}
                      className="h-9 w-full max-w-sm rounded-none border-b border-input bg-transparent px-0 py-1 text-sm focus-visible:outline-hidden focus-visible:border-foreground"
                    />
                  </div>
                  <div className="flex flex-wrap gap-3 pt-1">
                    <Button
                      type="button"
                      disabled={setMembership.isPending}
                      onClick={handleGrantMembership}
                      className="bg-foreground text-background hover:bg-foreground/90"
                    >
                      {setMembership.isPending ? (
                        <Loader2 size={14} className="animate-spin" />
                      ) : (
                        <Crown size={14} />
                      )}
                      设为会员
                    </Button>
                    {isMember && (
                      <Button
                        type="button"
                        variant="outline"
                        disabled={setMembership.isPending}
                        onClick={handleRevokeMembership}
                      >
                        取消会员
                      </Button>
                    )}
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          <div className="sm:hidden">
            <Button
              type="submit"
              disabled={isSubmitting || (!isDirty && !permChanged)}
              className="w-full h-11 rounded-none bg-foreground text-background"
            >
              {isSubmitting ? (
                <Loader2 className="animate-spin" size={14} />
              ) : (
                <Save size={14} />
              )}
              保存
            </Button>
          </div>
        </form>
      </div>

      <BanDialog
        open={banDialogOpen}
        isBanned={banned}
        initialReason={banned ? user.banReason ?? "" : ""}
        initialDurationDays={
          banned && user.banExpires
            ? null
            : banned
              ? null
              : 7
        }
        isLoading={updateUser.isPending}
        onClose={() => setBanDialogOpen(false)}
        onConfirm={handleBanConfirm}
      />

      <ConfirmationModal
        isOpen={deleteOpen}
        isDanger
        title="删除账号"
        message={`确定要删除用户「${user.name}」吗？此操作不可撤销。`}
        confirmLabel="删除"
        isLoading={deleteUser.isPending}
        onClose={() => setDeleteOpen(false)}
        onConfirm={async () => {
          try {
            await deleteUser.mutateAsync(user.id);
            toast.success("账号已删除");
            setDeleteOpen(false);
            navigate({ to: "/admin/users" });
          } catch {
            toast.error("删除失败，请稍后重试");
          }
        }}
      />
    </div>
  );
}

function InfoRow({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-border/10 pb-3 last:border-0 last:pb-0">
      <span className="text-muted-foreground">{label}</span>
      <span
        className={`text-right truncate ${mono ? "font-mono text-[11px]" : "font-medium"}`}
      >
        {value}
      </span>
    </div>
  );
}
