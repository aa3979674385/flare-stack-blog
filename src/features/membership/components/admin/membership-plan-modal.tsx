import { ClientOnly } from "@tanstack/react-router";
import { Eye, EyeOff, Loader2, X } from "lucide-react";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  useCreateMembershipPlan,
  useUpdateMembershipPlan,
} from "@/features/membership/queries";
import type { MembershipPlan } from "@/lib/db/schema";

interface MembershipPlanModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** 传入则为编辑模式，否则为新建 */
  plan?: MembershipPlan | null;
}

const EMPTY = {
  name: "",
  description: "",
  priceYuan: "",
  durationDays: "30",
  visible: 1 as 0 | 1,
};

const MembershipPlanModalInternal = ({
  isOpen,
  onClose,
  plan,
}: MembershipPlanModalProps) => {
  const isEdit = !!plan;
  const create = useCreateMembershipPlan();
  const update = useUpdateMembershipPlan();

  const [name, setName] = useState(EMPTY.name);
  const [description, setDescription] = useState(EMPTY.description);
  const [priceYuan, setPriceYuan] = useState(EMPTY.priceYuan);
  const [durationDays, setDurationDays] = useState(EMPTY.durationDays);
  const [visible, setVisible] = useState<0 | 1>(EMPTY.visible);

  useEffect(() => {
    if (!isOpen) return;
    if (plan) {
      setName(plan.name);
      setDescription(plan.description ?? "");
      setPriceYuan((plan.priceCents / 100).toString());
      setDurationDays(String(plan.durationDays));
      setVisible(plan.visible === 1 ? 1 : 0);
    } else {
      setName(EMPTY.name);
      setDescription(EMPTY.description);
      setPriceYuan(EMPTY.priceYuan);
      setDurationDays(EMPTY.durationDays);
      setVisible(EMPTY.visible);
    }
  }, [isOpen, plan]);

  if (!isOpen) return null;

  const busy = create.isPending || update.isPending;

  const handleClose = () => {
    if (busy) return;
    onClose();
  };

  const handleSubmit = async () => {
    if (name.trim() === "") {
      toast.error("请输入套餐名称");
      return;
    }
    const yuan = Number(priceYuan);
    if (!Number.isFinite(yuan) || yuan < 0) {
      toast.error("请输入有效的价格（元）");
      return;
    }
    const days = Math.round(Number(durationDays));
    if (!Number.isFinite(days) || days <= 0) {
      toast.error("请输入有效的有效期（天）");
      return;
    }
    const priceCents = Math.round(yuan * 100);

    try {
      if (isEdit && plan) {
        await update.mutateAsync({
          data: {
            id: plan.id,
            name: name.trim(),
            description: description.trim() || null,
            priceCents,
            durationDays: days,
            visible,
          },
        });
        toast.success("套餐已更新");
      } else {
        await create.mutateAsync({
          data: {
            name: name.trim(),
            description: description.trim() || null,
            priceCents,
            durationDays: days,
            visible,
          },
        });
        toast.success("套餐已创建");
      }
      onClose();
    } catch {
      toast.error(isEdit ? "更新失败，请重试" : "创建失败，请重试");
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="fixed inset-0 bg-background/80 backdrop-blur-sm animate-in fade-in duration-200"
        onClick={handleClose}
      />
      <div className="relative bg-background border border-border/30 p-8 max-w-lg w-full mx-4 animate-in fade-in zoom-in-95 duration-200 shadow-lg max-h-[90vh] overflow-y-auto custom-scrollbar">
        <button
          onClick={handleClose}
          className="absolute right-4 top-4 text-muted-foreground/50 hover:text-foreground transition-colors"
          type="button"
        >
          <X size={16} strokeWidth={1.5} />
        </button>
        <h3 className="text-xl font-serif font-medium mb-1">
          {isEdit ? "编辑会员套餐" : "新建会员套餐"}
        </h3>
        <p className="text-sm text-muted-foreground mb-6">
          设置套餐名称、说明、价格与有效期，并可控制是否在前台展示。
        </p>

        <div className="space-y-5">
          <div className="space-y-1.5">
            <label className="text-xs font-mono text-muted-foreground uppercase tracking-wider">
              套餐名称 *
            </label>
            <Input
              value={name}
              maxLength={50}
              onChange={(e) => setName(e.target.value)}
              placeholder="如：月度会员 / 年度尊享"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-mono text-muted-foreground uppercase tracking-wider">
              套餐说明
            </label>
            <Textarea
              value={description}
              maxLength={500}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="向用户展示的权益说明，可选"
              rows={3}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-mono text-muted-foreground uppercase tracking-wider">
                价格（元）*
              </label>
              <Input
                type="number"
                min={0}
                step="0.01"
                value={priceYuan}
                onChange={(e) => setPriceYuan(e.target.value)}
                placeholder="99.00"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-mono text-muted-foreground uppercase tracking-wider">
                有效期（天）*
              </label>
              <Input
                type="number"
                min={1}
                step="1"
                value={durationDays}
                onChange={(e) => setDurationDays(e.target.value)}
                placeholder="30"
              />
            </div>
          </div>

          <div className="flex items-center justify-between border border-border/30 px-4 py-3">
            <div className="space-y-0.5">
              <span className="text-sm">前台展示</span>
              <p className="text-xs text-muted-foreground">
                关闭后用户不可见该套餐
              </p>
            </div>
            <button
              type="button"
              onClick={() => setVisible((v) => (v === 1 ? 0 : 1))}
              className={`flex items-center gap-2 px-3 py-1.5 border text-[11px] font-mono uppercase tracking-widest transition-colors ${
                visible === 1
                  ? "border-foreground text-foreground"
                  : "border-border text-muted-foreground"
              }`}
            >
              {visible === 1 ? (
                <>
                  <Eye size={12} /> 显示
                </>
              ) : (
                <>
                  <EyeOff size={12} /> 隐藏
                </>
              )}
            </button>
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-6">
          <Button
            type="button"
            variant="ghost"
            onClick={handleClose}
            disabled={busy}
            className="font-mono text-xs uppercase tracking-widest rounded-none"
          >
            取消
          </Button>
          <Button
            type="button"
            onClick={handleSubmit}
            disabled={busy}
            className="rounded-none bg-foreground text-background hover:bg-foreground/90 font-mono text-xs uppercase tracking-widest"
          >
            {busy ? (
              <Loader2 size={12} className="animate-spin" />
            ) : isEdit ? (
              "保存"
            ) : (
              "创建"
            )}
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  );
};

export function MembershipPlanModal(props: MembershipPlanModalProps) {
  return (
    <ClientOnly>
      <MembershipPlanModalInternal {...props} />
    </ClientOnly>
  );
}
