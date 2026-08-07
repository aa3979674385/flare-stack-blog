import { createFileRoute, redirect } from "@tanstack/react-router";

// 已整合进「记录中心」(/admin/logs)，访问旧地址直接跳到对应 tab
export const Route = createFileRoute("/admin/purchase-orders/")({
  beforeLoad: () => {
    throw redirect({ to: "/admin/logs", search: { tab: "purchase" } });
  },
});
