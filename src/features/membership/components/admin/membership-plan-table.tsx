import { Eye, EyeOff, Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import ConfirmationModal from "@/components/ui/confirmation-modal";
import {
  useDeleteMembershipPlan,
  useMembershipPlans,
  useSetMembershipPlanVisible,
} from "@/features/membership/queries";
import type { MembershipPlan } from "@/lib/db/schema";

interface MembershipPlanTableProps {
  onEdit: (plan: MembershipPlan) => void;
  onAdd: () => void;
}

function formatPrice(cents: number): string {
  return `¥${(cents / 100).toFixed(2)}`;
}

export function MembershipPlanTable({
  onEdit,
  onAdd,
}: MembershipPlanTableProps) {
  const { data: plans, isLoading } = useMembershipPlans();
  const setVisible = useSetMembershipPlanVisible();
  const remove = useDeleteMembershipPlan();
  const [pendingDelete, setPendingDelete] = useState<MembershipPlan | null>(
    null,
  );

  if (isLoading) {
    return (
      <div className="py-24 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const handleToggleVisible = async (plan: MembershipPlan) => {
    const next = plan.visible === 1 ? 0 : 1;
    try {
      await setVisible.mutateAsync({ data: { id: plan.id, visible: next } });
      toast.success(next === 1 ? "已显示该套餐" : "已隐藏该套餐");
    } catch {
      toast.error("操作失败，请重试");
    }
  };

  const confirmDelete = async () => {
    if (!pendingDelete) return;
    try {
      await remove.mutateAsync({ data: { id: pendingDelete.id } });
      toast.success("套餐已删除");
    } catch {
      toast.error("删除失败，请重试");
    } finally {
      setPendingDelete(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button
          onClick={onAdd}
          className="rounded-none bg-foreground text-background hover:bg-foreground/90 font-mono text-[10px] uppercase tracking-widest h-9 px-4"
        >
          <Plus size={14} className="mr-2" />
          添加套餐
        </Button>
      </div>

      {!plans || plans.length === 0 ? (
        <div className="border border-border/30 py-20 text-center text-muted-foreground">
          <p className="text-sm">暂无会员套餐</p>
          <p className="text-xs mt-2">点击右上角「添加套餐」创建第一个套餐</p>
        </div>
      ) : (
        <div className="border border-border/30 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border/30 bg-muted/20 text-left text-[11px] font-mono uppercase tracking-widest text-muted-foreground">
                <th className="px-4 py-3 font-medium">套餐名称</th>
                <th className="px-4 py-3 font-medium">说明</th>
                <th className="px-4 py-3 font-medium">价格</th>
                <th className="px-4 py-3 font-medium">有效期</th>
                <th className="px-4 py-3 font-medium">状态</th>
                <th className="px-4 py-3 font-medium text-right">操作</th>
              </tr>
            </thead>
            <tbody>
              {plans.map((plan) => (
                <tr
                  key={plan.id}
                  className="border-b border-border/20 last:border-0 hover:bg-muted/10 transition-colors"
                >
                  <td className="px-4 py-3 font-medium">{plan.name}</td>
                  <td className="px-4 py-3 text-muted-foreground max-w-xs truncate">
                    {plan.description || "—"}
                  </td>
                  <td className="px-4 py-3 font-mono">
                    {formatPrice(plan.priceCents)}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {plan.durationDays} 天
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex items-center gap-1 text-[11px] font-mono uppercase tracking-widest ${
                        plan.visible === 1
                          ? "text-foreground"
                          : "text-muted-foreground"
                      }`}
                    >
                      {plan.visible === 1 ? (
                        <>
                          <Eye size={12} /> 显示
                        </>
                      ) : (
                        <>
                          <EyeOff size={12} /> 隐藏
                        </>
                      )}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        type="button"
                        onClick={() => handleToggleVisible(plan)}
                        disabled={setVisible.isPending}
                        title={plan.visible === 1 ? "隐藏" : "显示"}
                        className="p-2 text-muted-foreground hover:text-foreground transition-colors border border-transparent hover:border-border/30"
                      >
                        {plan.visible === 1 ? (
                          <EyeOff size={14} />
                        ) : (
                          <Eye size={14} />
                        )}
                      </button>
                      <button
                        type="button"
                        onClick={() => onEdit(plan)}
                        title="编辑"
                        className="p-2 text-muted-foreground hover:text-foreground transition-colors border border-transparent hover:border-border/30"
                      >
                        <Pencil size={14} />
                      </button>
                      <button
                        type="button"
                        onClick={() => setPendingDelete(plan)}
                        title="删除"
                        className="p-2 text-muted-foreground hover:text-destructive transition-colors border border-transparent hover:border-destructive/30"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <ConfirmationModal
        isOpen={!!pendingDelete}
        onClose={() => setPendingDelete(null)}
        onConfirm={confirmDelete}
        title="删除会员套餐"
        message={
          pendingDelete
            ? `确定要删除套餐「${pendingDelete.name}」吗？此操作不可撤销。`
            : ""
        }
        confirmLabel="删除"
        isLoading={remove.isPending}
      />
    </div>
  );
}
