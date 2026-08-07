import { useQuery } from "@tanstack/react-query";
import { useNavigate, useSearch } from "@tanstack/react-router";
import { AlertTriangle, Loader2, Trash2, UserX } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { AdminPagination } from "@/components/admin/admin-pagination";
import ConfirmationModal from "@/components/ui/confirmation-modal";
import { formatDate } from "@/lib/utils";
import { useDeleteUser, usersListQuery } from "../../queries";

const PAGE_SIZE = 20;

interface UserTableProps {
  search?: string;
  page?: number;
}

/** 列表中的封禁状态短标签：永久 / 到期日 */
function banLabel(u: { banned?: boolean | null; banExpires?: Date | null }) {
  if (!u.banned) return null;
  if (!u.banExpires) return "永久封禁";
  return `封禁至 ${formatDate(u.banExpires).split(" ")[0]}`;
}

export function UserTable({ search, page = 1 }: UserTableProps) {
  const navigate = useNavigate({ from: "/admin/users/" });
  const searchParams = useSearch({ from: "/admin/users/" });
  const { data, isLoading, isError } = useQuery(
    usersListQuery({
      search,
      limit: PAGE_SIZE,
      offset: (page - 1) * PAGE_SIZE,
    }),
  );
  const deleteUser = useDeleteUser();
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

  const confirmDelete = async () => {
    if (!pendingDeleteId) return;
    try {
      await deleteUser.mutateAsync(pendingDeleteId);
      toast.success("用户已删除");
      setPendingDeleteId(null);
    } catch {
      toast.error("删除失败，请稍后重试");
      setPendingDeleteId(null);
    }
  };

  if (isLoading) {
    return (
      <div className="py-24 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="py-24 flex flex-col items-center justify-center text-muted-foreground font-serif italic gap-4 border-t border-border">
        <AlertTriangle size={40} strokeWidth={1} className="opacity-30" />
        <p>用户列表加载失败，请稍后重试</p>
      </div>
    );
  }

  if (!data || data.items.length === 0) {
    return (
      <div className="py-24 flex flex-col items-center justify-center text-muted-foreground font-serif italic gap-4 border-t border-border">
        <UserX size={40} strokeWidth={1} className="opacity-20" />
        <p>{search ? "未找到匹配的用户" : "暂无用户"}</p>
      </div>
    );
  }

  const totalPages = Math.ceil(data.total / PAGE_SIZE);

  const goDetail = (id: string) => {
    navigate({ to: "/admin/users/$id", params: { id } });
  };

  return (
    <div className="space-y-6">
      {/* 表头（桌面端） */}
      <div className="hidden md:grid grid-cols-12 gap-4 px-4 py-2 border-b border-border/30 items-center bg-muted/5">
        <div className="col-span-5 text-[9px] font-mono uppercase tracking-[0.2em] text-muted-foreground">
          用户
        </div>
        <div className="col-span-2 text-[9px] font-mono uppercase tracking-[0.2em] text-muted-foreground">
          角色
        </div>
        <div className="col-span-2 text-[9px] font-mono uppercase tracking-[0.2em] text-muted-foreground">
          邮箱验证
        </div>
        <div className="col-span-1 text-[9px] font-mono uppercase tracking-[0.2em] text-muted-foreground">
          状态
        </div>
        <div className="col-span-1 text-right text-[9px] font-mono uppercase tracking-[0.2em] text-muted-foreground">
          注册时间
        </div>
        <div className="col-span-1 text-right text-[9px] font-mono uppercase tracking-[0.2em] text-muted-foreground">
          操作
        </div>
      </div>

      {/* 列表 */}
      <div className="divide-y divide-border/30">
        {data.items.map((u) => (
          <div key={u.id}>
            {/* 桌面端行 */}
            <div
              onClick={() => goDetail(u.id)}
              className="hidden md:grid grid-cols-12 gap-4 px-4 py-5 items-center hover:bg-muted/10 transition-colors cursor-pointer group"
            >
              <div className="col-span-5 flex items-center gap-3 min-w-0">
                <div className="w-9 h-9 border border-border/30 flex items-center justify-center bg-muted/20 shrink-0">
                  {u.image ? (
                    <img
                      src={u.image}
                      alt={u.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <span className="text-[11px] font-mono">
                      {u.name.slice(0, 1).toUpperCase()}
                    </span>
                  )}
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-serif font-medium truncate group-hover:text-foreground transition-colors">
                    {u.name}
                  </div>
                  <div className="text-[9px] font-mono text-muted-foreground uppercase tracking-widest truncate">
                    {u.email}
                  </div>
                </div>
              </div>
              <div className="col-span-2 text-xs font-mono uppercase tracking-widest text-muted-foreground">
                {u.role === "admin" ? "管理员" : "普通用户"}
              </div>
              <div className="col-span-2 text-xs font-mono uppercase tracking-widest">
                <span
                  className={
                    u.emailVerified
                      ? "text-foreground"
                      : "text-muted-foreground"
                  }
                >
                  {u.emailVerified ? "已验证" : "未验证"}
                </span>
              </div>
              <div className="col-span-1 text-xs font-mono uppercase tracking-widest">
                {u.banned ? (
                  <span className="text-red-500">
                    {banLabel(u) ?? "已封禁"}
                  </span>
                ) : (
                  <span className="text-muted-foreground">正常</span>
                )}
              </div>
              <div className="col-span-1 text-right text-[9px] font-mono text-muted-foreground uppercase tracking-widest">
                {formatDate(u.createdAt).split(" ")[0]}
              </div>
              <div className="col-span-1 text-right">
                <button
                  type="button"
                  aria-label="删除用户"
                  onClick={(e) => {
                    e.stopPropagation();
                    setPendingDeleteId(u.id);
                  }}
                  className="inline-flex items-center justify-center w-8 h-8 text-muted-foreground hover:text-destructive transition-colors"
                >
                  <Trash2 size={15} />
                </button>
              </div>
            </div>

            {/* 移动端行 */}
            <div
              onClick={() => goDetail(u.id)}
              className="md:hidden flex items-center justify-between gap-4 px-4 py-4 hover:bg-muted/10 transition-colors cursor-pointer"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-9 h-9 border border-border/30 flex items-center justify-center bg-muted/20 shrink-0">
                  {u.image ? (
                    <img
                      src={u.image}
                      alt={u.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <span className="text-[11px] font-mono">
                      {u.name.slice(0, 1).toUpperCase()}
                    </span>
                  )}
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-serif font-medium truncate">
                    {u.name}
                  </div>
                  <div className="text-[9px] font-mono text-muted-foreground truncate">
                    {u.email}
                  </div>
                  <div className="text-[9px] font-mono text-muted-foreground uppercase tracking-widest mt-0.5">
                    {u.role === "admin" ? "管理员" : "普通用户"}
                    {u.banned ? ` · ${banLabel(u) ?? "已封禁"}` : ""}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <div className="text-[9px] font-mono text-muted-foreground">
                  {formatDate(u.createdAt).split(" ")[0]}
                </div>
                <button
                  type="button"
                  aria-label="删除用户"
                  onClick={(e) => {
                    e.stopPropagation();
                    setPendingDeleteId(u.id);
                  }}
                  className="inline-flex items-center justify-center w-8 h-8 text-muted-foreground hover:text-destructive transition-colors"
                >
                  <Trash2 size={15} />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* 分页 */}
      <div className="pt-12 px-2 border-t border-border/30">
        <AdminPagination
          currentPage={page}
          totalPages={totalPages}
          totalItems={data.total}
          itemsPerPage={PAGE_SIZE}
          currentPageItemCount={data.items.length}
          onPageChange={(newPage) =>
            navigate({
              to: "/admin/users",
              search: (prev: typeof searchParams) => ({
                ...prev,
                page: newPage,
              }),
            })
          }
        />
      </div>

      <ConfirmationModal
        isOpen={pendingDeleteId !== null}
        isDanger
        title="删除用户"
        message="确定要删除该用户吗？此操作不可撤销，其登录会话与第三方账号绑定将被清除，已发布评论的作者信息将变为匿名。"
        confirmLabel="删除"
        isLoading={deleteUser.isPending}
        onClose={() => setPendingDeleteId(null)}
        onConfirm={confirmDelete}
      />
    </div>
  );
}
