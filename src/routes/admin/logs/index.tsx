import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import {
  Coins,
  Download,
  FileDown,
  Receipt,
  ScrollText,
  Search,
  Trash2,
} from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { z } from "zod";
import { AdminPagination } from "@/components/admin/admin-pagination";
import ConfirmationModal from "@/components/ui/confirmation-modal";
import { Input } from "@/components/ui/input";
import {
  adminLogsListQuery,
  useClearAdminLogs,
  useDeleteAdminLogs,
} from "@/features/admin-log/queries";
import { useMyPermissions } from "@/features/auth/permissions";
import { useSystemSetting } from "@/features/config/hooks/use-system-setting";
import { usePointConfig } from "@/features/config/queries";
import {
  useClearPurchaseOrders,
  useClearResourceDownloads,
  useDeletePurchaseOrders,
  useDeleteResourceDownloads,
  usePurchaseOrders,
  useResourceDownloads,
} from "@/features/post-resources/queries";
import {
  useClearPointTransactions,
  useDeletePointTransactions,
  usePointTransactions,
} from "@/features/users/queries";
import { hasPermission, type PermissionSubject } from "@/lib/permissions";
import { formatDate } from "@/lib/utils";

const PAGE_SIZE = 20;

/**
 * 记录中心：把「操作日志 / 积分动态 / 购买记录 / 附件下载记录」整合到一个页面，
 * 顶部用 tab 切换。每个 tab 的筛选参数用前缀区分，避免互相串味：
 *   - operations：search
 *   - points：     ptype / psource / puserId / porderno
 *   - purchase：   borderno / buserId / bkeyword
 *   - download：   dkeyword
 */
const searchSchema = z.object({
  tab: z
    .enum(["operations", "points", "purchase", "download"])
    .optional()
    .default("operations"),
  page: z.number().optional().default(1).catch(1),
  // 操作日志
  search: z.string().optional(),
  // 积分动态
  ptype: z.enum(["points", "credits"]).optional(),
  psource: z
    .enum(["checkin", "admin_adjust", "recharge", "consume", "other"])
    .optional(),
  puserId: z.string().optional(),
  porderno: z.string().optional(),
  // 购买记录
  borderno: z.string().optional(),
  buserId: z.string().optional(),
  bkeyword: z.string().optional(),
  // 附件下载记录
  dkeyword: z.string().optional(),
});

export const Route = createFileRoute("/admin/logs/")({
  ssr: "data-only",
  validateSearch: searchSchema,
  component: RecordsCenterPage,
  loader: () => ({ title: "记录中心" }),
  head: ({ loaderData }) => ({
    meta: [{ title: loaderData?.title }],
  }),
});

const TABS = [
  { key: "operations", label: "操作日志", icon: ScrollText, perm: "log.view" },
  { key: "points", label: "积分动态", icon: Coins, perm: "points.view" },
  { key: "purchase", label: "购买记录", icon: Receipt, perm: "post.manage" },
  {
    key: "download",
    label: "附件下载记录",
    icon: FileDown,
    perm: "post.manage",
  },
] as const;

type TabKey = (typeof TABS)[number]["key"];

/** 四类记录开关对应的配置键 */
type RecordKey = "operationLog" | "pointsLog" | "purchaseLog" | "downloadLog";

function RecordsCenterPage() {
  const { tab } = Route.useSearch();
  const navigate = Route.useNavigate();

  const { data: myPerms } = useMyPermissions();
  const mySubject = myPerms as PermissionSubject | undefined;
  const permsReady = myPerms !== undefined;
  const visibleTabs = permsReady
    ? TABS.filter((t) => hasPermission(mySubject, t.perm))
    : TABS;

  const activeTab: TabKey = visibleTabs.some((t) => t.key === tab)
    ? tab
    : ((visibleTabs[0]?.key ?? "operations") as TabKey);

  const switchTab = (next: TabKey) => {
    // 切 tab 时清空其它 tab 的筛选参数，保持 URL 干净
    navigate({ search: { tab: next, page: 1 } });
  };

  if (visibleTabs.length === 0) {
    return (
      <div className="py-24 flex flex-col items-center justify-center text-muted-foreground font-serif italic gap-2">
        <ScrollText size={40} strokeWidth={1} className="opacity-30" />
        <p>无权查看任何记录</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-20 animate-in fade-in slide-in-from-bottom-4 duration-1000">
      {/* 头部 */}
      <div className="flex flex-col gap-1 border-b border-border/30 pb-6">
        <h1 className="text-3xl font-serif font-medium tracking-tight text-foreground">
          记录中心
        </h1>
        <p className="text-xs font-mono tracking-widest text-muted-foreground uppercase">
          Records Center
        </p>
      </div>

      {/* tab 切换 */}
      <div className="flex flex-wrap items-center gap-2">
        {visibleTabs.map((t) => {
          const Icon = t.icon;
          const isActive = t.key === activeTab;
          return (
            <button
              key={t.key}
              type="button"
              onClick={() => switchTab(t.key)}
              className={
                "inline-flex items-center gap-2 px-4 py-2 text-xs font-mono uppercase tracking-widest border transition-colors " +
                (isActive
                  ? "bg-foreground text-background border-foreground"
                  : "text-muted-foreground border-border/30 hover:text-foreground hover:border-foreground/40")
              }
            >
              <Icon size={13} strokeWidth={1.5} />
              {t.label}
            </button>
          );
        })}
      </div>

      {/* 当前 tab 面板 */}
      {activeTab === "operations" && <OperationsPanel />}
      {activeTab === "points" && <PointsPanel />}
      {activeTab === "purchase" && <PurchasePanel />}
      {activeTab === "download" && <DownloadPanel />}
    </div>
  );
}

/* ============================ 操作日志 ============================ */

const ACTION_LABELS: Record<string, string> = {
  "user.update": "更新用户",
  "user.ban": "封禁用户",
  "user.unban": "解封用户",
  "user.delete": "删除用户",
  "config.update": "更新配置",
};

function actionLabel(action: string) {
  return ACTION_LABELS[action] ?? action;
}

function OperationsPanel() {
  const { search, page } = Route.useSearch();
  const navigate = Route.useNavigate();
  const [searchInput, setSearchInput] = useState(search ?? "");

  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchInput !== search) {
        navigate({
          search: (prev: ReturnType<typeof Route.useSearch>) => ({
            ...prev,
            search: searchInput || undefined,
            page: 1,
          }),
        });
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [searchInput, navigate, search]);

  const { data, isLoading } = useQuery(
    adminLogsListQuery({
      search,
      limit: PAGE_SIZE,
      offset: (page - 1) * PAGE_SIZE,
    }),
  );

  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const items = data?.items ?? [];

  const sel = useRowSelection();
  const deleteMut = useDeleteAdminLogs();
  const clearMut = useClearAdminLogs();
  const [showClear, setShowClear] = useState(false);

  const removeOne = (id: string) =>
    deleteMut.mutate([id], {
      onSuccess: () => toast.success("已删除 1 条"),
      onError: () => toast.error("删除失败"),
    });
  const removeSelected = () => {
    const ids = [...sel.selected];
    deleteMut.mutate(ids, {
      onSuccess: () => {
        sel.clear();
        toast.success(`已删除 ${ids.length} 条`);
      },
      onError: () => toast.error("删除失败"),
    });
  };

  return (
    <div className="space-y-6">
      <RecordToggle recordKey="operationLog" />
      <div className="relative w-full md:w-72 group">
        <Search className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground w-3.5 h-3.5 transition-colors group-focus-within:text-foreground" />
        <Input
          placeholder="搜索管理员 / 目标 / 操作"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          className="pl-9 h-9 border-b border-border/50 bg-transparent rounded-none font-mono text-xs focus:border-foreground transition-all"
        />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <label className="inline-flex items-center gap-2 text-[11px] font-mono uppercase tracking-widest text-muted-foreground cursor-pointer select-none">
          <input
            type="checkbox"
            checked={
              items.length > 0 && items.every((i) => sel.selected.has(i.id))
            }
            disabled={items.length === 0}
            onChange={(e) =>
              sel.setPage(
                items.map((i) => i.id),
                e.target.checked,
              )
            }
            className="h-3.5 w-3.5 accent-foreground"
          />
          全选本页
        </label>
        <BulkActionBar
          selectedCount={sel.selected.size}
          totalCount={total}
          deleting={deleteMut.isPending}
          clearing={clearMut.isPending}
          onDeleteSelected={removeSelected}
          onClear={() => setShowClear(true)}
        />
      </div>

      <div className="min-h-100">
        {isLoading ? (
          <div className="py-24 flex items-center justify-center text-muted-foreground font-serif italic">
            加载中…
          </div>
        ) : items.length === 0 ? (
          <div className="py-24 flex flex-col items-center justify-center text-muted-foreground font-serif italic gap-2">
            <ScrollText size={40} strokeWidth={1} className="opacity-30" />
            <p>暂无操作记录</p>
          </div>
        ) : (
          <div className="border border-border/30 divide-y divide-border/30">
            {items.map((log) => (
              <div key={log.id} className="px-4 py-4 flex flex-col gap-1">
                <div className="flex items-center justify-between gap-4 flex-wrap">
                  <div className="flex items-center gap-3 min-w-0">
                    <input
                      type="checkbox"
                      checked={sel.selected.has(log.id)}
                      onChange={() => sel.toggle(log.id)}
                      className="h-3.5 w-3.5 accent-foreground shrink-0"
                    />
                    <span className="text-sm font-medium truncate">
                      {log.adminName}
                    </span>
                    <span className="text-[11px] font-mono uppercase tracking-widest text-foreground bg-muted/30 px-2 py-0.5">
                      {actionLabel(log.action)}
                    </span>
                  </div>
                  <span className="text-[11px] font-mono text-muted-foreground shrink-0">
                    {formatDate(log.createdAt, { includeTime: true })}
                  </span>
                  <button
                    type="button"
                    onClick={() => removeOne(log.id)}
                    disabled={deleteMut.isPending}
                    title="删除该条"
                    className="shrink-0 text-muted-foreground hover:text-destructive transition-colors disabled:opacity-40"
                  >
                    <Trash2 size={13} strokeWidth={1.5} />
                  </button>
                </div>
                <div className="text-xs text-muted-foreground leading-relaxed">
                  {log.targetType === "user" ? "用户" : "系统"}
                  {log.targetName ? `：${log.targetName}` : ""}
                  {log.detail ? (
                    <span className="ml-2 font-mono text-[10px] opacity-70 break-all">
                      {log.detail}
                    </span>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <AdminPagination
        currentPage={page}
        totalPages={totalPages}
        totalItems={total}
        itemsPerPage={PAGE_SIZE}
        currentPageItemCount={items.length}
        onPageChange={(newPage) =>
          navigate({
            search: (prev: ReturnType<typeof Route.useSearch>) => ({
              ...prev,
              page: newPage,
            }),
          })
        }
      />

      <ConfirmationModal
        isOpen={showClear}
        onClose={() => setShowClear(false)}
        onConfirm={() =>
          clearMut.mutate(undefined, {
            onSuccess: () => {
              sel.clear();
              setShowClear(false);
              toast.success("已清空全部操作日志");
            },
            onError: () => {
              setShowClear(false);
              toast.error("清空失败");
            },
          })
        }
        title="清空操作日志"
        message="将删除全部操作日志记录，此操作不可恢复。确定继续？"
        confirmLabel="清空"
        isDanger
        isLoading={clearMut.isPending}
      />
    </div>
  );
}

/* ============================ 积分动态 ============================ */

const POINT_SOURCE_LABELS: Record<string, string> = {
  checkin: "签到",
  admin_adjust: "后台调整",
  recharge: "充值",
  consume: "消费",
  other: "其他",
};

function PointsPanel() {
  const { ptype, psource, puserId, porderno, page } = Route.useSearch();
  const navigate = Route.useNavigate();
  const { data: pointConfig } = usePointConfig();

  const [userIdInput, setUserIdInput] = useState(puserId ?? "");
  const [orderNoInput, setOrderNoInput] = useState(porderno ?? "");

  useEffect(() => {
    const timer = setTimeout(() => {
      if (userIdInput !== (puserId ?? "")) {
        navigate({
          search: (prev: ReturnType<typeof Route.useSearch>) => ({
            ...prev,
            puserId: userIdInput || undefined,
            page: 1,
          }),
        });
      }
      if (orderNoInput !== (porderno ?? "")) {
        navigate({
          search: (prev: ReturnType<typeof Route.useSearch>) => ({
            ...prev,
            porderno: orderNoInput || undefined,
            page: 1,
          }),
        });
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [userIdInput, orderNoInput, navigate, puserId, porderno]);

  const { data, isLoading } = usePointTransactions({
    type: ptype,
    source: psource,
    userId: puserId,
    orderNo: porderno,
    limit: PAGE_SIZE,
    offset: (page - 1) * PAGE_SIZE,
  });

  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const items = data?.items ?? [];

  const sel = useRowSelection();
  const deleteMut = useDeletePointTransactions();
  const clearMut = useClearPointTransactions();
  const [showClear, setShowClear] = useState(false);

  const removeOne = (id: string) =>
    deleteMut.mutate([id], {
      onSuccess: () => toast.success("已删除 1 条"),
      onError: () => toast.error("删除失败"),
    });
  const removeSelected = () => {
    const ids = [...sel.selected];
    deleteMut.mutate(ids, {
      onSuccess: () => {
        sel.clear();
        toast.success(`已删除 ${ids.length} 条`);
      },
      onError: () => toast.error("删除失败"),
    });
  };

  const typeName = (t: string) =>
    t === "points"
      ? (pointConfig?.pointsName ?? "普通积分")
      : (pointConfig?.creditsName ?? "会员积分");

  return (
    <div className="space-y-6">
      <RecordToggle recordKey="pointsLog" />
      <div className="flex flex-wrap items-center gap-3">
        <FilterSelect
          label="积分类型"
          value={ptype ?? ""}
          onChange={(v) =>
            navigate({
              search: (prev: ReturnType<typeof Route.useSearch>) => ({
                ...prev,
                ptype: (v || undefined) as "points" | "credits" | undefined,
                page: 1,
              }),
            })
          }
          options={[
            { value: "", label: "全部" },
            { value: "points", label: "普通积分" },
            { value: "credits", label: "会员积分" },
          ]}
        />
        <FilterSelect
          label="来源"
          value={psource ?? ""}
          onChange={(v) =>
            navigate({
              search: (prev: ReturnType<typeof Route.useSearch>) => ({
                ...prev,
                psource: (v || undefined) as
                  | "checkin"
                  | "admin_adjust"
                  | "recharge"
                  | "consume"
                  | "other"
                  | undefined,
                page: 1,
              }),
            })
          }
          options={[
            { value: "", label: "全部" },
            { value: "checkin", label: "签到" },
            { value: "admin_adjust", label: "后台调整" },
            { value: "recharge", label: "充值" },
            { value: "consume", label: "消费" },
            { value: "other", label: "其他" },
          ]}
        />
        <div className="relative w-full md:w-64 group">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground w-3.5 h-3.5 transition-colors group-focus-within:text-foreground" />
          <Input
            placeholder="按用户 ID 筛选"
            value={userIdInput}
            onChange={(e) => setUserIdInput(e.target.value)}
            className="pl-9 h-9 border-b border-border/50 bg-transparent rounded-none font-mono text-xs focus:border-foreground transition-all"
          />
        </div>
        <div className="relative w-full md:w-56 group">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground w-3.5 h-3.5 transition-colors group-focus-within:text-foreground" />
          <Input
            placeholder="按订单号筛选"
            value={orderNoInput}
            onChange={(e) => setOrderNoInput(e.target.value)}
            className="pl-9 h-9 border-b border-border/50 bg-transparent rounded-none font-mono text-xs focus:border-foreground transition-all"
          />
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <label className="inline-flex items-center gap-2 text-[11px] font-mono uppercase tracking-widest text-muted-foreground cursor-pointer select-none">
          <input
            type="checkbox"
            checked={
              items.length > 0 && items.every((i) => sel.selected.has(i.id))
            }
            disabled={items.length === 0}
            onChange={(e) =>
              sel.setPage(
                items.map((i) => i.id),
                e.target.checked,
              )
            }
            className="h-3.5 w-3.5 accent-foreground"
          />
          全选本页
        </label>
        <BulkActionBar
          selectedCount={sel.selected.size}
          totalCount={total}
          deleting={deleteMut.isPending}
          clearing={clearMut.isPending}
          onDeleteSelected={removeSelected}
          onClear={() => setShowClear(true)}
        />
      </div>

      <div className="min-h-100">
        {isLoading ? (
          <div className="py-24 flex items-center justify-center text-muted-foreground font-serif italic">
            加载中…
          </div>
        ) : items.length === 0 ? (
          <div className="py-24 flex flex-col items-center justify-center text-muted-foreground font-serif italic gap-2">
            <Coins size={40} strokeWidth={1} className="opacity-30" />
            <p>暂无积分变动记录</p>
          </div>
        ) : (
          <div className="border border-border/30 divide-y divide-border/30">
            {items.map((tx) => (
              <div key={tx.id} className="px-4 py-4 flex flex-col gap-1">
                <div className="flex items-center justify-between gap-4 flex-wrap">
                  <div className="flex items-center gap-3 min-w-0">
                    <input
                      type="checkbox"
                      checked={sel.selected.has(tx.id)}
                      onChange={() => sel.toggle(tx.id)}
                      className="h-3.5 w-3.5 accent-foreground shrink-0"
                    />
                    <span className="text-sm font-medium truncate">
                      {tx.userName ?? "未知用户"}
                    </span>
                    <span className="text-[10px] font-mono text-muted-foreground truncate max-w-40">
                      {tx.userEmail ?? tx.userId}
                    </span>
                    <span className="text-[11px] font-mono uppercase tracking-widest text-foreground bg-muted/30 px-2 py-0.5">
                      {typeName(tx.type)}
                    </span>
                  </div>
                  <span className="text-[11px] font-mono text-muted-foreground shrink-0">
                    {formatDate(tx.createdAt, { includeTime: true })}
                  </span>
                  <button
                    type="button"
                    onClick={() => removeOne(tx.id)}
                    disabled={deleteMut.isPending}
                    title="删除该条"
                    className="shrink-0 text-muted-foreground hover:text-destructive transition-colors disabled:opacity-40"
                  >
                    <Trash2 size={13} strokeWidth={1.5} />
                  </button>
                </div>
                <div className="flex items-center gap-3 flex-wrap text-xs">
                  <span
                    className={
                      tx.amount >= 0
                        ? "font-mono font-medium text-red-600"
                        : "font-mono font-medium text-green-600"
                    }
                  >
                    {tx.amount >= 0 ? `+${tx.amount}` : tx.amount}
                  </span>
                  <span className="text-muted-foreground">
                    余额 {tx.balanceAfter}
                  </span>
                  <span className="text-[11px] font-mono uppercase tracking-widest text-foreground/70 bg-muted/20 px-2 py-0.5">
                    {POINT_SOURCE_LABELS[tx.source] ?? tx.source}
                  </span>
                  {tx.reason ? (
                    <span className="text-muted-foreground">
                      备注：{tx.reason}
                    </span>
                  ) : null}
                  {tx.operatorId ? (
                    <span className="text-[10px] font-mono text-muted-foreground/70">
                      操作人 {tx.operatorId.slice(0, 8)}
                    </span>
                  ) : null}
                  {tx.orderNo ? (
                    <span className="text-[10px] font-mono uppercase tracking-widest text-foreground/70 bg-muted/20 px-2 py-0.5">
                      订单 {tx.orderNo}
                    </span>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <AdminPagination
        currentPage={page}
        totalPages={totalPages}
        totalItems={total}
        itemsPerPage={PAGE_SIZE}
        currentPageItemCount={items.length}
        onPageChange={(newPage) =>
          navigate({
            search: (prev: ReturnType<typeof Route.useSearch>) => ({
              ...prev,
              page: newPage,
            }),
          })
        }
      />

      <ConfirmationModal
        isOpen={showClear}
        onClose={() => setShowClear(false)}
        onConfirm={() =>
          clearMut.mutate(undefined, {
            onSuccess: () => {
              sel.clear();
              setShowClear(false);
              toast.success("已清空全部积分流水");
            },
            onError: () => {
              setShowClear(false);
              toast.error("清空失败");
            },
          })
        }
        title="清空积分流水"
        message="将删除全部积分变动记录（不影响用户积分余额），此操作不可恢复。确定继续？"
        confirmLabel="清空"
        isDanger
        isLoading={clearMut.isPending}
      />
    </div>
  );
}

/* ============================ 购买记录 ============================ */

const ORDER_STATUS_LABELS: Record<string, string> = {
  paid: "已支付",
  pending: "待支付",
  free: "免费/会员",
};

function toCsv(rows: Array<Record<string, unknown>>): string {
  const esc = (v: unknown) => {
    const s = v == null ? "" : String(v);
    return `"${s.replace(/"/g, '""')}"`;
  };
  if (rows.length === 0) return "";
  const headers = Object.keys(rows[0]);
  const lines = [headers.join(",")].concat(
    rows.map((r) => headers.map((h) => esc(r[h])).join(",")),
  );
  return "﻿" + lines.join("\r\n");
}

function downloadCsv(filename: string, csv: string) {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function PurchasePanel() {
  const { borderno, buserId, bkeyword, page } = Route.useSearch();
  const navigate = Route.useNavigate();
  const { data: pointConfig } = usePointConfig();

  const [orderNoInput, setOrderNoInput] = useState(borderno ?? "");
  const [userIdInput, setUserIdInput] = useState(buserId ?? "");
  const [keywordInput, setKeywordInput] = useState(bkeyword ?? "");

  useEffect(() => {
    const timer = setTimeout(() => {
      if (orderNoInput !== (borderno ?? "")) {
        navigate({
          search: (p: ReturnType<typeof Route.useSearch>) => ({
            ...p,
            borderno: orderNoInput || undefined,
            page: 1,
          }),
        });
      }
      if (userIdInput !== (buserId ?? "")) {
        navigate({
          search: (p: ReturnType<typeof Route.useSearch>) => ({
            ...p,
            buserId: userIdInput || undefined,
            page: 1,
          }),
        });
      }
      if (keywordInput !== (bkeyword ?? "")) {
        navigate({
          search: (p: ReturnType<typeof Route.useSearch>) => ({
            ...p,
            bkeyword: keywordInput || undefined,
            page: 1,
          }),
        });
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [
    orderNoInput,
    userIdInput,
    keywordInput,
    navigate,
    borderno,
    buserId,
    bkeyword,
  ]);

  const { data, isLoading } = usePurchaseOrders({
    offset: (page - 1) * PAGE_SIZE,
    limit: PAGE_SIZE,
    orderNo: borderno,
    userId: buserId,
    keyword: bkeyword,
  });

  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const items = data?.items ?? [];

  const sel = useRowSelection();
  const deleteMut = useDeletePurchaseOrders();
  const clearMut = useClearPurchaseOrders();
  const [showClear, setShowClear] = useState(false);

  const removeOne = (id: string) =>
    deleteMut.mutate([id], {
      onSuccess: () => toast.success("已删除 1 条"),
      onError: () => toast.error("删除失败"),
    });
  const removeSelected = () => {
    const ids = [...sel.selected];
    deleteMut.mutate(ids, {
      onSuccess: () => {
        sel.clear();
        toast.success(`已删除 ${ids.length} 条`);
      },
      onError: () => toast.error("删除失败"),
    });
  };

  const typeName = (t: string | null | undefined) => {
    if (t === "credits") return pointConfig?.creditsName ?? "会员积分";
    if (t === "rmb") return "人民币";
    if (t === "points") return pointConfig?.pointsName ?? "普通积分";
    return "—";
  };

  const amountText = (r: (typeof items)[number]) => {
    if (r.priceType === "rmb") return `¥${((r.amount ?? 0) / 100).toFixed(2)}`;
    if (r.priceType === "points" || r.priceType === "credits")
      return `${r.amount ?? 0} ${typeName(r.priceType)}`;
    return "—";
  };

  const handleExport = () => {
    const rows = items.map((r) => ({
      订单号: r.orderNo ?? "",
      用户: r.userName ?? r.userEmail ?? r.userId,
      用户ID: r.userId,
      资源: r.resourceTitle ?? "",
      类型: typeName(r.priceType),
      金额: amountText(r),
      状态: ORDER_STATUS_LABELS[r.status] ?? r.status,
      时间: formatDate(r.createdAt, { includeTime: true }),
    }));
    downloadCsv(
      `购买记录_${new Date().toISOString().slice(0, 10)}.csv`,
      toCsv(rows),
    );
  };

  return (
    <div className="space-y-6">
      <RecordToggle recordKey="purchaseLog" />
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative w-full sm:w-56 group">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground w-3.5 h-3.5" />
            <Input
              placeholder="订单号"
              value={orderNoInput}
              onChange={(e) => setOrderNoInput(e.target.value)}
              className="pl-9 h-9 border-b border-border/50 bg-transparent rounded-none font-mono text-xs focus:border-foreground"
            />
          </div>
          <div className="relative w-full sm:w-56 group">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground w-3.5 h-3.5" />
            <Input
              placeholder="用户 ID"
              value={userIdInput}
              onChange={(e) => setUserIdInput(e.target.value)}
              className="pl-9 h-9 border-b border-border/50 bg-transparent rounded-none font-mono text-xs focus:border-foreground"
            />
          </div>
          <div className="relative w-full sm:w-64 group">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground w-3.5 h-3.5" />
            <Input
              placeholder="关键字：资源 / 用户名 / 邮箱"
              value={keywordInput}
              onChange={(e) => setKeywordInput(e.target.value)}
              className="pl-9 h-9 border-b border-border/50 bg-transparent rounded-none text-xs focus:border-foreground"
            />
          </div>
        </div>
        <button
          type="button"
          onClick={handleExport}
          disabled={items.length === 0}
          className="inline-flex items-center gap-2 bg-foreground text-background px-4 py-2 text-xs font-mono uppercase tracking-widest hover:bg-foreground/90 disabled:opacity-40 transition-colors shrink-0"
        >
          <Download size={13} /> 导出 CSV
        </button>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <label className="inline-flex items-center gap-2 text-[11px] font-mono uppercase tracking-widest text-muted-foreground cursor-pointer select-none">
          <input
            type="checkbox"
            checked={
              items.length > 0 && items.every((i) => sel.selected.has(i.id))
            }
            disabled={items.length === 0}
            onChange={(e) =>
              sel.setPage(
                items.map((i) => i.id),
                e.target.checked,
              )
            }
            className="h-3.5 w-3.5 accent-foreground"
          />
          全选本页
        </label>
        <BulkActionBar
          selectedCount={sel.selected.size}
          totalCount={total}
          deleting={deleteMut.isPending}
          clearing={clearMut.isPending}
          onDeleteSelected={removeSelected}
          onClear={() => setShowClear(true)}
        />
      </div>

      <div className="min-h-100">
        {isLoading ? (
          <div className="py-24 flex items-center justify-center text-muted-foreground font-serif italic">
            加载中…
          </div>
        ) : items.length === 0 ? (
          <div className="py-24 flex flex-col items-center justify-center text-muted-foreground font-serif italic gap-2">
            <Receipt size={40} strokeWidth={1} className="opacity-30" />
            <p>暂无购买记录</p>
          </div>
        ) : (
          <div className="border border-border/30 divide-y divide-border/30">
            {items.map((r) => (
              <div key={r.id} className="px-4 py-4 flex flex-col gap-1">
                <div className="flex items-center justify-between gap-4 flex-wrap">
                  <div className="flex items-center gap-3 min-w-0">
                    <input
                      type="checkbox"
                      checked={sel.selected.has(r.id)}
                      onChange={() => sel.toggle(r.id)}
                      className="h-3.5 w-3.5 accent-foreground shrink-0"
                    />
                    <span className="text-[11px] font-mono uppercase tracking-widest text-foreground bg-muted/30 px-2 py-0.5">
                      {r.orderNo ?? "—"}
                    </span>
                    <span className="text-sm font-medium truncate">
                      {r.resourceTitle ?? "未知资源"}
                    </span>
                  </div>
                  <span className="text-[11px] font-mono text-muted-foreground shrink-0">
                    {formatDate(r.createdAt, { includeTime: true })}
                  </span>
                  <button
                    type="button"
                    onClick={() => removeOne(r.id)}
                    disabled={deleteMut.isPending}
                    title="删除该条"
                    className="shrink-0 text-muted-foreground hover:text-destructive transition-colors disabled:opacity-40"
                  >
                    <Trash2 size={13} strokeWidth={1.5} />
                  </button>
                </div>
                <div className="flex items-center gap-3 flex-wrap text-xs">
                  <span className="text-muted-foreground truncate max-w-48">
                    {r.userName ?? r.userEmail ?? r.userId}
                  </span>
                  <span className="text-[11px] font-mono uppercase tracking-widest text-foreground/70 bg-muted/20 px-2 py-0.5">
                    {typeName(r.priceType)}
                  </span>
                  <span className="font-mono font-medium">{amountText(r)}</span>
                  <span className="text-[11px] font-mono uppercase tracking-widest text-foreground/70 bg-muted/20 px-2 py-0.5">
                    {ORDER_STATUS_LABELS[r.status] ?? r.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <AdminPagination
        currentPage={page}
        totalPages={totalPages}
        totalItems={total}
        itemsPerPage={PAGE_SIZE}
        currentPageItemCount={items.length}
        onPageChange={(newPage) =>
          navigate({
            search: (p: ReturnType<typeof Route.useSearch>) => ({
              ...p,
              page: newPage,
            }),
          })
        }
      />

      <ConfirmationModal
        isOpen={showClear}
        onClose={() => setShowClear(false)}
        onConfirm={() =>
          clearMut.mutate(undefined, {
            onSuccess: () => {
              sel.clear();
              setShowClear(false);
              toast.success("已清空全部购买记录");
            },
            onError: () => {
              setShowClear(false);
              toast.error("清空失败");
            },
          })
        }
        title="清空购买记录"
        message="将删除全部购买记录。注意：购买订单是付费下载的凭证，清空后已付费资源将无法下载，且不可恢复。确定继续？"
        confirmLabel="清空"
        isDanger
        isLoading={clearMut.isPending}
      />
    </div>
  );
}

/* ============================ 附件下载记录 ============================ */

function DownloadPanel() {
  const { dkeyword, page } = Route.useSearch();
  const navigate = Route.useNavigate();

  const [keywordInput, setKeywordInput] = useState(dkeyword ?? "");

  useEffect(() => {
    const timer = setTimeout(() => {
      if (keywordInput !== (dkeyword ?? "")) {
        navigate({
          search: (p: ReturnType<typeof Route.useSearch>) => ({
            ...p,
            dkeyword: keywordInput || undefined,
            page: 1,
          }),
        });
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [keywordInput, navigate, dkeyword]);

  const { data, isLoading } = useResourceDownloads({
    offset: (page - 1) * PAGE_SIZE,
    limit: PAGE_SIZE,
    keyword: dkeyword,
  });

  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const items = data?.items ?? [];

  const sel = useRowSelection();
  const deleteMut = useDeleteResourceDownloads();
  const clearMut = useClearResourceDownloads();
  const [showClear, setShowClear] = useState(false);

  const removeOne = (id: string) =>
    deleteMut.mutate([id], {
      onSuccess: () => toast.success("已删除 1 条"),
      onError: () => toast.error("删除失败"),
    });
  const removeSelected = () => {
    const ids = [...sel.selected];
    deleteMut.mutate(ids, {
      onSuccess: () => {
        sel.clear();
        toast.success(`已删除 ${ids.length} 条`);
      },
      onError: () => toast.error("删除失败"),
    });
  };

  const handleExport = () => {
    const rows = items.map((r) => ({
      用户: r.userName ?? r.userEmail ?? r.userId,
      用户ID: r.userId,
      资源: r.resourceTitle ?? "",
      文件名: r.fileName ?? "",
      链接: r.fileUrl,
      关联订单号: r.orderId ?? "",
      时间: formatDate(r.createdAt, { includeTime: true }),
    }));
    downloadCsv(
      `附件下载记录_${new Date().toISOString().slice(0, 10)}.csv`,
      toCsv(rows),
    );
  };

  return (
    <div className="space-y-6">
      <RecordToggle recordKey="downloadLog" />
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div className="relative w-full sm:w-80 group">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground w-3.5 h-3.5" />
          <Input
            placeholder="关键字：文件名 / 资源 / 用户名 / 邮箱"
            value={keywordInput}
            onChange={(e) => setKeywordInput(e.target.value)}
            className="pl-9 h-9 border-b border-border/50 bg-transparent rounded-none text-xs focus:border-foreground"
          />
        </div>
        <button
          type="button"
          onClick={handleExport}
          disabled={items.length === 0}
          className="inline-flex items-center gap-2 bg-foreground text-background px-4 py-2 text-xs font-mono uppercase tracking-widest hover:bg-foreground/90 disabled:opacity-40 transition-colors shrink-0"
        >
          <Download size={13} /> 导出 CSV
        </button>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <label className="inline-flex items-center gap-2 text-[11px] font-mono uppercase tracking-widest text-muted-foreground cursor-pointer select-none">
          <input
            type="checkbox"
            checked={
              items.length > 0 && items.every((i) => sel.selected.has(i.id))
            }
            disabled={items.length === 0}
            onChange={(e) =>
              sel.setPage(
                items.map((i) => i.id),
                e.target.checked,
              )
            }
            className="h-3.5 w-3.5 accent-foreground"
          />
          全选本页
        </label>
        <BulkActionBar
          selectedCount={sel.selected.size}
          totalCount={total}
          deleting={deleteMut.isPending}
          clearing={clearMut.isPending}
          onDeleteSelected={removeSelected}
          onClear={() => setShowClear(true)}
        />
      </div>

      <div className="min-h-100">
        {isLoading ? (
          <div className="py-24 flex items-center justify-center text-muted-foreground font-serif italic">
            加载中…
          </div>
        ) : items.length === 0 ? (
          <div className="py-24 flex flex-col items-center justify-center text-muted-foreground font-serif italic gap-2">
            <FileDown size={40} strokeWidth={1} className="opacity-30" />
            <p>暂无下载记录</p>
          </div>
        ) : (
          <div className="border border-border/30 divide-y divide-border/30">
            {items.map((r) => (
              <div key={r.id} className="px-4 py-4 flex flex-col gap-1">
                <div className="flex items-center justify-between gap-4 flex-wrap">
                  <div className="flex items-center gap-3 min-w-0">
                    <input
                      type="checkbox"
                      checked={sel.selected.has(r.id)}
                      onChange={() => sel.toggle(r.id)}
                      className="h-3.5 w-3.5 accent-foreground shrink-0"
                    />
                    <span className="text-sm font-medium truncate">
                      {r.fileName ?? "未知文件"}
                    </span>
                    <span className="text-[10px] font-mono text-muted-foreground truncate max-w-40">
                      {r.resourceTitle ?? "未知资源"}
                    </span>
                  </div>
                  <span className="text-[11px] font-mono text-muted-foreground shrink-0">
                    {formatDate(r.createdAt, { includeTime: true })}
                  </span>
                  <button
                    type="button"
                    onClick={() => removeOne(r.id)}
                    disabled={deleteMut.isPending}
                    title="删除该条"
                    className="shrink-0 text-muted-foreground hover:text-destructive transition-colors disabled:opacity-40"
                  >
                    <Trash2 size={13} strokeWidth={1.5} />
                  </button>
                </div>
                <div className="flex items-center gap-3 flex-wrap text-xs">
                  <span className="text-muted-foreground truncate max-w-48">
                    {r.userName ?? r.userEmail ?? r.userId}
                  </span>
                  {r.orderId ? (
                    <span className="text-[11px] font-mono uppercase tracking-widest text-foreground/70 bg-muted/20 px-2 py-0.5">
                      订单 {r.orderId.slice(0, 8)}
                    </span>
                  ) : null}
                  <a
                    href={r.fileUrl}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="text-[11px] font-mono text-muted-foreground hover:text-foreground hover:underline break-all truncate max-w-72"
                  >
                    {r.fileUrl}
                  </a>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <AdminPagination
        currentPage={page}
        totalPages={totalPages}
        totalItems={total}
        itemsPerPage={PAGE_SIZE}
        currentPageItemCount={items.length}
        onPageChange={(newPage) =>
          navigate({
            search: (p: ReturnType<typeof Route.useSearch>) => ({
              ...p,
              page: newPage,
            }),
          })
        }
      />

      <ConfirmationModal
        isOpen={showClear}
        onClose={() => setShowClear(false)}
        onConfirm={() =>
          clearMut.mutate(undefined, {
            onSuccess: () => {
              sel.clear();
              setShowClear(false);
              toast.success("已清空全部附件下载记录");
            },
            onError: () => {
              setShowClear(false);
              toast.error("清空失败");
            },
          })
        }
        title="清空附件下载记录"
        message="将删除全部附件下载记录，此操作不可恢复。确定继续？"
        confirmLabel="清空"
        isDanger
        isLoading={clearMut.isPending}
      />
    </div>
  );
}

/* ============================ 记录开关 ============================ */

/**
 * 每类记录独立的「记录/暂停」开关。
 * - 读取系统配置 records.<key>（缺省视为开启）
 * - 切换时即时保存到系统配置（需 config.manage 权限，无权限则禁用）
 * - 后端对应写入点会按此配置跳过写入
 */

/** 各记录开关的风险提示：danger 为 true 表示关闭会破坏功能，需红色警示。 */
const RECORD_RISK: Partial<
  Record<RecordKey, { danger?: boolean; hint: string }>
> = {
  purchaseLog: {
    danger: true,
    hint: "关闭后：已付费资源将无法下载（订单是下载凭证）",
  },
  pointsLog: {
    hint: "关闭后无积分流水可查，但账户余额不受影响",
  },
};

function RecordToggle({ recordKey }: { recordKey: RecordKey }) {
  const { settings, saveSettings } = useSystemSetting();
  const { data: myPerms } = useMyPermissions();
  const enabled = settings?.records?.[recordKey] ?? true;
  const canEdit = hasPermission(
    myPerms as PermissionSubject | undefined,
    "config.manage",
  );
  const [saving, setSaving] = useState(false);

  const onToggle = async (next: boolean) => {
    if (!settings) return;
    setSaving(true);
    try {
      await saveSettings({
        data: {
          ...settings,
          records: { ...(settings.records ?? {}), [recordKey]: next },
        },
      });
      toast.success(next ? "已开启该记录" : "已暂停该记录");
    } catch {
      toast.error("保存失败，请重试");
    } finally {
      setSaving(false);
    }
  };

  const risk = RECORD_RISK[recordKey];

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
      <label
        className={
          "inline-flex items-center gap-2 text-[11px] font-mono uppercase tracking-widest select-none transition-colors " +
          (canEdit
            ? "cursor-pointer text-muted-foreground"
            : "cursor-not-allowed text-muted-foreground/50")
        }
      >
        <input
          type="checkbox"
          checked={enabled}
          disabled={!canEdit || saving}
          onChange={(e) => onToggle(e.target.checked)}
          className="h-3.5 w-3.5 accent-foreground"
        />
        {enabled ? "记录中" : "已暂停"}
      </label>
      {risk && (
        <span
          title={risk.hint}
          className={
            "inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-sans leading-none " +
            (risk.danger
              ? "bg-red-500/10 text-red-600 ring-1 ring-red-500/30"
              : "bg-muted text-muted-foreground ring-1 ring-border")
          }
        >
          {risk.danger ? "⚠ 高风险" : "提示"}
        </span>
      )}
      {risk && (
        <span className="text-[11px] text-muted-foreground">{risk.hint}</span>
      )}
    </div>
  );
}

/* ============================ 通用筛选下拉 ============================ */

function FilterSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <label className="flex items-center gap-2 text-[11px] font-mono uppercase tracking-[0.2em] text-muted-foreground">
      {label}
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-9 border-b border-border/50 bg-transparent rounded-none font-mono text-xs normal-case tracking-normal text-foreground focus:border-foreground focus:outline-none transition-all"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

/* ============================ 行选择 & 批量操作条 ============================ */

/** 面板内「已选 id 集合」的状态管理：单选切换 / 整页勾选 / 清空。 */
function useRowSelection() {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const setPage = (ids: string[], on: boolean) =>
    setSelected((prev) => {
      const next = new Set(prev);
      for (const id of ids) {
        if (on) next.add(id);
        else next.delete(id);
      }
      return next;
    });
  const clear = () => setSelected(new Set());
  return { selected, toggle, setPage, clear };
}

/** 批量操作条：已选计数 + 删除选中 + 清空。 */
function BulkActionBar({
  selectedCount,
  totalCount,
  onDeleteSelected,
  onClear,
  deleting,
  clearing,
}: {
  selectedCount: number;
  totalCount: number;
  onDeleteSelected: () => void;
  onClear: () => void;
  deleting: boolean;
  clearing: boolean;
}) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <span className="text-[11px] font-mono uppercase tracking-widest text-muted-foreground">
        已选 {selectedCount}
      </span>
      <button
        type="button"
        onClick={onDeleteSelected}
        disabled={selectedCount === 0 || deleting}
        className="inline-flex items-center gap-1.5 bg-foreground text-background px-3 py-1.5 text-[11px] font-mono uppercase tracking-widest hover:bg-foreground/90 disabled:opacity-40 transition-colors"
      >
        <Trash2 size={12} /> 删除选中
      </button>
      <button
        type="button"
        onClick={onClear}
        disabled={totalCount === 0 || clearing}
        className="inline-flex items-center gap-1.5 border border-border/40 px-3 py-1.5 text-[11px] font-mono uppercase tracking-widest text-muted-foreground hover:text-foreground hover:border-foreground/40 disabled:opacity-40 transition-colors"
      >
        <Trash2 size={12} /> 清空
      </button>
    </div>
  );
}
