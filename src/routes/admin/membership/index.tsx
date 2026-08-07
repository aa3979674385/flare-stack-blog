import { createFileRoute } from "@tanstack/react-router";
import { Crown } from "lucide-react";
import { useState } from "react";
import { MembershipPlanModal } from "@/features/membership/components/admin/membership-plan-modal";
import { MembershipPlanTable } from "@/features/membership/components/admin/membership-plan-table";
import type { MembershipPlan } from "@/lib/db/schema";

export const Route = createFileRoute("/admin/membership/")({
  ssr: "data-only",
  component: MembershipAdminPage,
  loader: () => ({ title: "会员套餐" }),
  head: ({ loaderData }) => ({
    meta: [{ title: loaderData?.title }],
  }),
});

function MembershipAdminPage() {
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<MembershipPlan | null>(null);

  const openAdd = () => {
    setEditing(null);
    setShowModal(true);
  };

  const openEdit = (plan: MembershipPlan) => {
    setEditing(plan);
    setShowModal(true);
  };

  return (
    <div className="space-y-8 pb-20 animate-in fade-in slide-in-from-bottom-4 duration-1000">
      <div className="space-y-1">
        <h1 className="text-3xl font-serif font-medium tracking-tight text-foreground flex items-center gap-3">
          <Crown size={26} className="opacity-70" />
          会员套餐
        </h1>
        <p className="text-xs font-mono tracking-widest text-muted-foreground uppercase">
          VIP Membership Plans
        </p>
      </div>

      <p className="text-sm text-muted-foreground max-w-2xl">
        在后台创建并管理 VIP 会员套餐：自定义套餐名称、说明、价格与有效期，并可随时显示 / 隐藏、编辑或删除。用户侧的开通与支付能力可后续接入。
      </p>

      <MembershipPlanTable onEdit={openEdit} onAdd={openAdd} />

      <MembershipPlanModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        plan={editing}
      />
    </div>
  );
}
