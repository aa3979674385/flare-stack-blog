import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Download, KeyRound, Loader2, Search } from "lucide-react";
import { toast } from "sonner";
import {
  exportCardKeysFn,
  generateCardKeysFn,
} from "@/features/card-keys/api/card-keys.admin.api";
import { cardKeysQueryOptions } from "@/features/card-keys/queries";
import type { CardKeyListItem } from "@/features/card-keys/data/card-keys.data";

export const Route = createFileRoute("/admin/card-keys/")({
  ssr: "data-only",
  component: CardKeysAdminPage,
  loader: () => ({ title: "卡密管理" }),
  head: ({ loaderData }) => ({
    meta: [{ title: loaderData?.title }],
  }),
});

const PAGE_SIZE = 20;

function formatDate(d?: Date | null): string {
  if (!d) return "—";
  const dt = d instanceof Date ? d : new Date(d);
  if (Number.isNaN(dt.getTime())) return "—";
  return dt.toLocaleString("zh-CN", { hour12: false });
}

function rewardSummary(item: CardKeyListItem): string {
  const parts: string[] = [];
  if (item.membershipDays && item.membershipDays > 0)
    parts.push(`会员 ${item.membershipDays}天`);
  if (item.pointsA && item.pointsA > 0) parts.push(`积分A ${item.pointsA}`);
  if (item.pointsB && item.pointsB > 0) parts.push(`积分B ${item.pointsB}`);
  return parts.length ? parts.join(" · ") : "—";
}

function CardKeysAdminPage() {
  const queryClient = useQueryClient();

  // 生成表单状态（数字用字符串以允许清空）
  const [count, setCount] = useState("1");
  const [batchNote, setBatchNote] = useState("");
  const [membershipDays, setMembershipDays] = useState("");
  const [pointsA, setPointsA] = useState("");
  const [pointsB, setPointsB] = useState("");

  // 列表筛选状态
  const [keywordInput, setKeywordInput] = useState("");
  const [appliedKeyword, setAppliedKeyword] = useState("");
  const [status, setStatus] = useState<"all" | "unused" | "used">("all");
  const [page, setPage] = useState(0);

  const listQuery = useQuery(
    cardKeysQueryOptions({
      keyword: appliedKeyword || undefined,
      status: status === "all" ? undefined : status,
      page,
      pageSize: PAGE_SIZE,
    }),
  );

  const generateMut = useMutation({
    mutationFn: (vars: {
      count: number;
      batchNote: string | null;
      membershipDays: number | null;
      pointsA: number | null;
      pointsB: number | null;
    }) => generateCardKeysFn({ data: vars }),
    onSuccess: (n) => {
      toast.success(`已生成 ${n} 张卡密`);
      queryClient.invalidateQueries({ queryKey: ["card-keys", "list"] });
      setPage(0);
    },
    onError: (e: Error) => toast.error(e.message || "生成失败"),
  });

  const exportMut = useMutation({
    mutationFn: () =>
      exportCardKeysFn({
        data: {
          keyword: appliedKeyword || undefined,
          status: status === "all" ? undefined : status,
        },
      }),
    onSuccess: (rows) => downloadCsv(rows),
    onError: (e: Error) => toast.error(e.message || "导出失败"),
  });

  const atLeastOneReward =
    Number(membershipDays) > 0 ||
    Number(pointsA) > 0 ||
    Number(pointsB) > 0;

  const onGenerate = () => {
    const c = Math.max(1, Math.floor(Number(count) || 1));
    const md = membershipDays.trim() === "" ? null : Math.floor(Number(membershipDays));
    const pa = pointsA.trim() === "" ? null : Math.floor(Number(pointsA));
    const pb = pointsB.trim() === "" ? null : Math.floor(Number(pointsB));
    if (!((md ?? 0) > 0 || (pa ?? 0) > 0 || (pb ?? 0) > 0)) {
      toast.error("至少填写一项奖励（会员时长 / 积分A / 积分B）");
      return;
    }
    generateMut.mutate({
      count: c,
      batchNote: batchNote.trim() || null,
      membershipDays: md,
      pointsA: pa,
      pointsB: pb,
    });
  };

  const onSearch = () => {
    setAppliedKeyword(keywordInput.trim());
    setPage(0);
  };

  const total = listQuery.data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="space-y-8 pb-20 animate-in fade-in slide-in-from-bottom-4 duration-1000">
      <div className="space-y-1">
        <h1 className="text-3xl font-serif font-medium tracking-tight text-foreground flex items-center gap-3">
          <KeyRound size={26} className="opacity-70" />
          卡密管理
        </h1>
        <p className="text-xs font-mono tracking-widest text-muted-foreground uppercase">
          Card Keys / Redemption Codes
        </p>
      </div>

      {/* 生成表单 */}
      <section className="rounded-xl border border-border/40 bg-background p-6 space-y-5">
        <h2 className="text-lg font-medium text-foreground">批量生成卡密</h2>
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <Field label="生成数量" hint="一次生成多少张独立唯一卡密（1–1000）">
            <input
              type="number"
              min={1}
              max={1000}
              value={count}
              onChange={(e) => setCount(e.target.value)}
              className="w-full rounded-lg border border-border/40 bg-muted/20 px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-(--fuwari-primary)"
            />
          </Field>
          <Field label="批次备注" hint="记录该批次卡密用途（可选）">
            <input
              type="text"
              maxLength={200}
              value={batchNote}
              onChange={(e) => setBatchNote(e.target.value)}
              placeholder="如：活动赠送 / 内测福利"
              className="w-full rounded-lg border border-border/40 bg-muted/20 px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-(--fuwari-primary)"
            />
          </Field>
          <Field label="会员时长（天）" hint="填写数值代表赠送会员；留空不赠送">
            <input
              type="number"
              min={1}
              value={membershipDays}
              onChange={(e) => setMembershipDays(e.target.value)}
              placeholder="留空 = 不赠送"
              className="w-full rounded-lg border border-border/40 bg-muted/20 px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-(--fuwari-primary)"
            />
          </Field>
          <Field label="积分A数量（普通积分）" hint="填写数值发放普通积分；留空不发放">
            <input
              type="number"
              min={1}
              value={pointsA}
              onChange={(e) => setPointsA(e.target.value)}
              placeholder="留空 = 不发放"
              className="w-full rounded-lg border border-border/40 bg-muted/20 px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-(--fuwari-primary)"
            />
          </Field>
          <Field label="积分B数量（会员积分）" hint="填写数值发放会员积分；留空不发放">
            <input
              type="number"
              min={1}
              value={pointsB}
              onChange={(e) => setPointsB(e.target.value)}
              placeholder="留空 = 不发放"
              className="w-full rounded-lg border border-border/40 bg-muted/20 px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-(--fuwari-primary)"
            />
          </Field>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onGenerate}
            disabled={generateMut.isPending || !atLeastOneReward}
            className="inline-flex h-10 items-center gap-2 rounded-lg bg-foreground px-5 text-sm font-medium text-background transition hover:bg-foreground/90 disabled:opacity-50"
          >
            {generateMut.isPending && <Loader2 size={16} className="animate-spin" />}
            生成卡密
          </button>
          {!atLeastOneReward && (
            <span className="text-xs text-muted-foreground">
              三项奖励至少填写一项
            </span>
          )}
        </div>
      </section>

      {/* 管理列表 */}
      <section className="rounded-xl border border-border/40 bg-background p-6 space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search
              size={16}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
            />
            <input
              type="text"
              value={keywordInput}
              onChange={(e) => setKeywordInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && onSearch()}
              placeholder="搜索卡密（精确）或备注（模糊）"
              className="w-full rounded-lg border border-border/40 bg-muted/20 py-2 pl-9 pr-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-(--fuwari-primary)"
            />
          </div>
          <select
            value={status}
            onChange={(e) => {
              setStatus(e.target.value as typeof status);
              setPage(0);
            }}
            className="h-10 rounded-lg border border-border/40 bg-muted/20 px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-(--fuwari-primary)"
          >
            <option value="all">全部状态</option>
            <option value="unused">未兑换</option>
            <option value="used">已兑换</option>
          </select>
          <button
            type="button"
            onClick={onSearch}
            className="inline-flex h-10 items-center gap-2 rounded-lg border border-border/40 px-4 text-sm font-medium text-foreground transition hover:bg-muted/30"
          >
            <Search size={16} />
            搜索
          </button>
          <button
            type="button"
            onClick={() => exportMut.mutate()}
            disabled={exportMut.isPending}
            className="inline-flex h-10 items-center gap-2 rounded-lg border border-border/40 px-4 text-sm font-medium text-foreground transition hover:bg-muted/30 disabled:opacity-50"
          >
            {exportMut.isPending ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <Download size={16} />
            )}
            导出
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border/40 text-left text-muted-foreground">
                <th className="px-3 py-2 font-medium">卡密</th>
                <th className="px-3 py-2 font-medium">批次备注</th>
                <th className="px-3 py-2 font-medium">奖励配置</th>
                <th className="px-3 py-2 font-medium">状态</th>
                <th className="px-3 py-2 font-medium">兑换用户</th>
                <th className="px-3 py-2 font-medium">兑换时间</th>
                <th className="px-3 py-2 font-medium">创建时间</th>
              </tr>
            </thead>
            <tbody>
              {listQuery.isLoading ? (
                <tr>
                  <td colSpan={7} className="px-3 py-10 text-center text-muted-foreground">
                    <Loader2 size={18} className="mx-auto animate-spin" />
                  </td>
                </tr>
              ) : (listQuery.data?.items.length ?? 0) === 0 ? (
                <tr>
                  <td colSpan={7} className="px-3 py-10 text-center text-muted-foreground">
                    暂无卡密
                  </td>
                </tr>
              ) : (
                listQuery.data?.items.map((item: CardKeyListItem) => (
                  <tr
                    key={item.id}
                    className="border-b border-border/20 text-foreground"
                  >
                    <td className="px-3 py-2 font-mono">{item.code}</td>
                    <td className="px-3 py-2 text-muted-foreground">
                      {item.batchNote || "—"}
                    </td>
                    <td className="px-3 py-2">{rewardSummary(item)}</td>
                    <td className="px-3 py-2">
                      {item.status === "used" ? (
                        <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                          已兑换
                        </span>
                      ) : (
                        <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs text-emerald-600">
                          未兑换
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      {item.redeemedUserName || "—"}
                    </td>
                    <td className="px-3 py-2 text-muted-foreground">
                      {formatDate(item.redeemedAt)}
                    </td>
                    <td className="px-3 py-2 text-muted-foreground">
                      {formatDate(item.createdAt)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>
            共 {total} 张 · 第 {page + 1}/{totalPages} 页
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={page <= 0}
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              className="h-8 rounded-lg border border-border/40 px-3 disabled:opacity-40"
            >
              上一页
            </button>
            <button
              type="button"
              disabled={page >= totalPages - 1}
              onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
              className="h-8 rounded-lg border border-border/40 px-3 disabled:opacity-40"
            >
              下一页
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block space-y-1.5">
      <span className="block text-sm font-medium text-foreground">{label}</span>
      {children}
      {hint && (
        <span className="block text-xs text-muted-foreground">{hint}</span>
      )}
    </label>
  );
}

function downloadCsv(rows: CardKeyListItem[]) {
  const headers = [
    "卡密",
    "批次备注",
    "会员时长(天)",
    "积分A",
    "积分B",
    "状态",
    "兑换用户",
    "兑换用户名",
    "兑换时间",
    "创建时间",
  ];
  const csvEscape = (v: string) => `"${v.replace(/"/g, '""')}"`;
  const lines = [headers.map(csvEscape).join(",")];
  for (const r of rows) {
    lines.push(
      [
        r.code,
        r.batchNote ?? "",
        r.membershipDays != null ? String(r.membershipDays) : "",
        r.pointsA != null ? String(r.pointsA) : "",
        r.pointsB != null ? String(r.pointsB) : "",
        r.status === "used" ? "已兑换" : "未兑换",
        r.redeemedBy ?? "",
        r.redeemedUserName ?? "",
        formatDate(r.redeemedAt),
        formatDate(r.createdAt),
      ]
        .map(escape)
        .join(","),
    );
  }
  // BOM 保证 Excel 正确识别 UTF-8 中文
  const blob = new Blob(["﻿" + lines.join("\n")], {
    type: "text/csv;charset=utf-8;",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `card-keys-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
  toast.success(`已导出 ${rows.length} 条`);
}
