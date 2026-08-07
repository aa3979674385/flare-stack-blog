import { ClientOnly } from "@tanstack/react-router";
import { Loader2, X } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

export interface BanDialogValue {
  /** 封禁天数；null 表示永久封禁 */
  durationDays: number | null;
  reason: string;
}

interface BanDialogProps {
  open: boolean;
  isBanned?: boolean;
  initialReason?: string;
  initialDurationDays?: number | null;
  isLoading?: boolean;
  onClose: () => void;
  onConfirm: (value: BanDialogValue) => void;
}

const DURATION_OPTIONS: { label: string; value: number | null }[] = [
  { label: "1 天", value: 1 },
  { label: "7 天", value: 7 },
  { label: "30 天", value: 30 },
  { label: "永久封禁", value: null },
];

function BanDialogInternal({
  open,
  isBanned,
  initialReason = "",
  initialDurationDays = 7,
  isLoading,
  onClose,
  onConfirm,
}: BanDialogProps) {
  const [durationDays, setDurationDays] = useState<number | null>(
    initialDurationDays,
  );
  const [reason, setReason] = useState(initialReason);

  useEffect(() => {
    if (open) {
      setDurationDays(initialDurationDays);
      setReason(initialReason);
    }
  }, [open, initialDurationDays, initialReason]);

  return (
    <div
      className={`fixed inset-0 z-100 flex items-center justify-center p-4 md:p-6 transition-all duration-300 ${
        open ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
      }`}
    >
      <div
        className="absolute inset-0 bg-background/90 backdrop-blur-sm"
        onClick={isLoading ? undefined : onClose}
      />
      <div
        className={`relative w-full max-w-md bg-background border border-border/30 flex flex-col transform transition-all duration-300 ${
          open ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0"
        }`}
      >
        <div className="px-6 pt-8 pb-4 flex items-start justify-between">
          <div className="space-y-2">
            <p className="text-xs font-mono uppercase tracking-widest text-destructive/70">
              [ {isBanned ? "修改封禁" : "账号封禁"} ]
            </p>
            <h2 className="text-2xl font-serif font-medium text-foreground">
              {isBanned ? "修改封禁设置" : "封禁该账号"}
            </h2>
          </div>
          <button
            onClick={onClose}
            disabled={isLoading}
            className="p-2 -mr-2 text-muted-foreground/50 hover:text-foreground transition-colors disabled:opacity-50"
          >
            <X size={16} strokeWidth={1.5} />
          </button>
        </div>

        <div className="px-6 pb-6 space-y-6">
          <div className="space-y-3">
            <label className="text-[10px] font-mono uppercase tracking-[0.2em] text-muted-foreground">
              封禁时长
            </label>
            <div className="grid grid-cols-2 gap-2">
              {DURATION_OPTIONS.map((opt) => {
                const active = durationDays === opt.value;
                return (
                  <button
                    key={opt.label}
                    type="button"
                    onClick={() => setDurationDays(opt.value)}
                    className={`h-11 text-sm font-medium border transition-colors ${
                      active
                        ? "border-destructive bg-destructive/10 text-destructive"
                        : "border-border/40 text-foreground hover:border-foreground/40"
                    }`}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-mono uppercase tracking-[0.2em] text-muted-foreground">
              封禁原因（可选）
            </label>
            <Textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="记录封禁原因，将展示给该用户"
              maxLength={500}
              className="min-h-[88px] resize-none"
            />
          </div>

          <p className="text-[11px] text-muted-foreground/70 leading-relaxed">
            封禁后该用户将被强制退出并无法登录，直到封禁到期（永久封禁除外）。请谨慎操作。
          </p>
        </div>

        <div className="px-6 pb-6 flex justify-end gap-3">
          <button
            onClick={onClose}
            disabled={isLoading}
            className="px-4 py-2.5 text-xs font-mono uppercase tracking-widest text-muted-foreground/60 hover:text-foreground transition-colors disabled:opacity-50"
          >
            取消
          </button>
          <Button
            onClick={() => onConfirm({ durationDays, reason })}
            disabled={isLoading}
            className="flex items-center justify-center gap-2 bg-destructive text-destructive-foreground hover:opacity-80"
          >
            {isLoading && <Loader2 size={12} className="animate-spin" />}
            <span>{isLoading ? "处理中" : isBanned ? "保存修改" : "确认封禁"}</span>
          </Button>
        </div>
      </div>
    </div>
  );
}

export function BanDialog(props: BanDialogProps) {
  return (
    <ClientOnly>
      <BanDialogInternal {...props} />
    </ClientOnly>
  );
}
