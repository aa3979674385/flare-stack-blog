import { Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import ConfirmationModal from "@/components/ui/confirmation-modal";
import { PostResourceModal } from "./post-resource-modal";
import {
  useDeletePostResource,
  usePostResources,
} from "@/features/post-resources/queries";
import { usePointConfig } from "@/features/config/queries";
import type { PostResource } from "@/lib/db/schema";

function accessBadge(
  r: PostResource,
  names: { points: string; credits: string },
): string {
  if (r.accessType === "free") return "免费";
  if (r.accessType === "member") return "会员专享";
  const pname = r.priceType === "credits" ? names.credits : names.points;
  const price = `${r.priceAmount} ${pname}`;
  let member = "";
  if (r.memberAccess === "free") member = "· 会员免费";
  else if (r.memberAccess === "discount")
    member = `· 会员${r.memberDiscount ?? 10}折`;
  else if (r.memberAccess === "required") member = "· 仅会员";
  return `收费 ${price}${member}`;
}

export function PostResourcePanel({ postId }: { postId: number }) {
  const { data: resources, isLoading } = usePostResources(postId);
  const remove = useDeletePostResource();
  const { data: pointConfig } = usePointConfig();
  const pointNames = {
    points: pointConfig?.pointsName ?? "普通积分",
    credits: pointConfig?.creditsName ?? "会员积分",
  };
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<PostResource | null>(null);
  const [pendingDelete, setPendingDelete] = useState<PostResource | null>(null);

  const openAdd = () => {
    setEditing(null);
    setModalOpen(true);
  };
  const openEdit = (r: PostResource) => {
    setEditing(r);
    setModalOpen(true);
  };

  const confirmDelete = async () => {
    if (!pendingDelete) return;
    try {
      await remove.mutateAsync({ data: { id: pendingDelete.id } });
      toast.success("资源已删除");
    } catch {
      toast.error("删除失败，请重试");
    } finally {
      setPendingDelete(null);
    }
  };

  if (isLoading) {
    return (
      <div className="mt-10 border-t border-border/30 pt-8 flex justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <section className="mt-10 border-t border-border/30 pt-8">
      <div className="flex items-start justify-between gap-4 mb-4">
        <div>
          <h2 className="text-lg font-serif font-medium">下载资源</h2>
          <p className="text-xs text-muted-foreground mt-1">
            为本文添加网盘下载（百度网盘等），可设置免费 / 会员专享 / 收费及会员折扣。
          </p>
        </div>
        <Button
          type="button"
          onClick={openAdd}
          className="rounded-none bg-foreground text-background hover:bg-foreground/90 font-mono text-[10px] uppercase tracking-widest h-9 px-4 shrink-0"
        >
          <Plus size={14} className="mr-2" />
          添加资源
        </Button>
      </div>

      {!resources || resources.length === 0 ? (
        <div className="border border-border/30 py-16 text-center text-muted-foreground">
          <p className="text-sm">暂无下载资源</p>
          <p className="text-xs mt-2">点击「添加资源」添加网盘下载链接</p>
        </div>
      ) : (
        <div className="space-y-3">
          {resources.map((r) => (
            <div
              key={r.id}
              className="border border-border/30 p-4 flex items-start justify-between gap-4"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium truncate">{r.title}</span>
                  <span className="text-[10px] font-mono uppercase tracking-widest px-2 py-0.5 border border-border/40 text-muted-foreground">
                    {accessBadge(r, pointNames)}
                  </span>
                  {r.hideCodeWhenPaid === 1 && (
                    <span className="text-[10px] font-mono uppercase tracking-widest px-2 py-0.5 border border-border/40 text-muted-foreground">
                      收费隐藏解压码
                    </span>
                  )}
                </div>
                {r.extractCode && (
                  <p className="text-xs text-muted-foreground mt-1">
                    解压码：<span className="font-mono">{r.extractCode}</span>
                  </p>
                )}
                <p className="text-xs text-muted-foreground/70 mt-1">
                  {r.links?.length ?? 0} 个网盘链接
                </p>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <button
                  type="button"
                  onClick={() => openEdit(r)}
                  title="编辑"
                  className="p-2 text-muted-foreground hover:text-foreground transition-colors border border-transparent hover:border-border/30"
                >
                  <Pencil size={14} />
                </button>
                <button
                  type="button"
                  onClick={() => setPendingDelete(r)}
                  title="删除"
                  className="p-2 text-muted-foreground hover:text-destructive transition-colors border border-transparent hover:border-destructive/30"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <PostResourceModal
        isOpen={modalOpen}
        postId={postId}
        resource={editing}
        onClose={() => {
          setModalOpen(false);
          setEditing(null);
        }}
      />
      <ConfirmationModal
        isOpen={!!pendingDelete}
        onClose={() => setPendingDelete(null)}
        onConfirm={confirmDelete}
        title="删除下载资源"
        message={
          pendingDelete
            ? `确定要删除资源「${pendingDelete.title}」吗？此操作不可撤销。`
            : ""
        }
        confirmLabel="删除"
        isLoading={remove.isPending}
      />
    </section>
  );
}
