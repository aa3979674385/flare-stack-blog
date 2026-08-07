import {
  createFileRoute,
  Link,
  Outlet,
  redirect,
} from "@tanstack/react-router";
import { ArrowUpRight, Menu, Settings } from "lucide-react";
import { useState } from "react";
import { SideBar } from "@/components/admin/side-bar";
import { Breadcrumbs } from "@/components/breadcrumbs";
import Toaster from "@/components/ui/toaster";
import { sessionQuery } from "@/features/auth/queries";
import { useMyPermissions } from "@/features/auth/permissions";
import { CACHE_CONTROL } from "@/lib/constants";
import { hasPermission, type PermissionSubject } from "@/lib/permissions";
import { m } from "@/paraglide/messages";
// 管理后台固定使用 default 主题样式，不随 THEME 变量切换
import "@/features/theme/themes/default/styles/index.css";
import "@/styles/admin.css";

export const Route = createFileRoute("/admin")({
  beforeLoad: async ({ context, location }) => {
    const session = await context.queryClient.ensureQueryData(sessionQuery);

    if (!session) {
      throw redirect({ to: "/login" });
    }
    if (session.user.role !== "admin") {
      throw redirect({ to: "/" });
    }

    // 按路径前缀校验细粒度权限（最长前缀优先）
    // 注意：/admin 根路径（后台外壳/仪表盘容器）不要求 dashboard.view，
    // 否则无 dashboard.view 的管理员被弹回 /admin 时又会因缺权限再次重定向 → 死循环。
    // 仪表盘数据本身仍由 getDashboardStatsFn 的 dashboard.view 守卫，缺权限时不显示数据即可。
    const permissionByPath: Record<string, string> = {
      "/admin/posts": "post.view",
      "/admin/tags": "tag.manage",
      "/admin/media": "media.manage",
      "/admin/comments": "comment.manage",
      "/admin/friend-links": "link.manage",
      "/admin/users": "user.manage",
      "/admin/points-settings": "config.manage",
      // 注意：/admin/logs（记录中心）及其旧重定向路由（points-log / purchase-orders /
      // download-logs）不再在此做路由级权限拦截。记录中心内部已按 tab 各自鉴权
      // （log.view / points.view / post.manage），数据接口另有后端权限兜底；若在此硬性
      // 绑定单一权限，会导致只拥有部分记录权限的管理员被弹回 /admin，或旧地址重定向后
      // 再次被拦截。
      "/admin/membership": "membership.manage",
      "/admin/categories": "config.manage",
      "/admin/nav-menu": "config.manage",
      "/admin/settings": "config.manage",
      "/admin/template-settings": "config.manage",
      "/admin/popup": "config.manage",
      "/admin/card-keys": "cardkey.manage",
    };
    const path = location.pathname;
    let required: string | undefined;
    for (const key of Object.keys(permissionByPath)) {
      if (path === key || path.startsWith(key + "/")) {
        if (!required || key.length > required.length) {
          required = permissionByPath[key];
        }
      }
    }
    if (required && !hasPermission(session.user, required)) {
      throw redirect({ to: "/admin" });
    }

    return { session };
  },
  component: AdminLayout,
  loader: () => ({
    title: m.admin_layout_title(),
  }),
  head: ({ loaderData }) => ({
    meta: [
      {
        title: loaderData?.title,
      },
    ],
  }),
  headers: () => {
    return CACHE_CONTROL.private;
  },
});

function AdminLayout() {
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const closeMobileSidebar = () => setIsMobileSidebarOpen(false);
  const { data: myPerms } = useMyPermissions();
  const mySubject = myPerms as PermissionSubject | undefined;

  return (
    <div className="h-screen overflow-hidden bg-background text-foreground flex relative font-sans admin-layout">
      <SideBar
        isMobileSidebarOpen={isMobileSidebarOpen}
        closeMobileSidebar={closeMobileSidebar}
      />

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col min-w-0 min-h-0">
        {/* Top Header */}
        <header className="h-20 border-b border-border/30 bg-background flex items-center justify-between px-6 md:px-10 sticky top-0 z-30 shrink-0">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setIsMobileSidebarOpen(true)}
              className="lg:hidden p-2 hover:bg-muted/50 rounded-sm transition-colors text-foreground"
              aria-label={m.admin_layout_open_navigation()}
            >
              <Menu size={20} strokeWidth={1.5} />
            </button>
            <Breadcrumbs />
          </div>

          <div className="flex items-center gap-6">
            {hasPermission(mySubject, "config.manage") && (
              <Link
                to="/admin/settings"
                className="group p-2 -mr-2 text-muted-foreground hover:text-foreground transition-colors"
                title={m.admin_layout_settings()}
              >
                <Settings
                  size={18}
                  strokeWidth={1.5}
                  className="group-hover:rotate-45 transition-transform duration-500 ease-in-out"
                />
              </Link>
            )}
            <div className="h-4 w-px bg-border/40" />
            <Link
              to="/"
              className="flex items-center gap-2 text-[10px] uppercase tracking-[0.2em] font-mono font-medium text-muted-foreground hover:text-foreground transition-colors group"
            >
              <span>{m.admin_layout_back_to_site()}</span>
              <ArrowUpRight
                size={10}
                strokeWidth={1.5}
                className="group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform"
              />
            </Link>
          </div>
        </header>

        {/* Content Scroll */}
        <div className="flex-1 min-h-0 overflow-y-auto p-6 md:p-12 custom-scrollbar">
          <div className="max-w-7xl mx-auto">
            <Outlet />
          </div>
        </div>
      </main>
      <Toaster />
    </div>
  );
}
