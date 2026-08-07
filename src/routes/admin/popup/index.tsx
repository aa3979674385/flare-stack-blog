import { createFileRoute, redirect } from "@tanstack/react-router";

// 弹窗设置已并入「模板设置」(/admin/template-settings)，访问旧地址直接跳转
export const Route = createFileRoute("/admin/popup/")({
  beforeLoad: () => {
    throw redirect({ to: "/admin/template-settings" });
  },
});
