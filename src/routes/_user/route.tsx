import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Outlet, useNavigate } from "@tanstack/react-router";
import theme from "@theme";
import { useEffect } from "react";
import { toast } from "sonner";
import { ErrorPage } from "@/components/common/error-page";
import { AUTH_KEYS, sessionQuery } from "@/features/auth/queries";
import { navMenuQuery } from "@/features/navigation/queries";
import { authClient } from "@/lib/auth/auth.client";
import { getLogoutAuthErrorMessage } from "@/lib/auth/auth-errors";
import { CACHE_CONTROL } from "@/lib/constants";
import { m } from "@/paraglide/messages";

export const Route = createFileRoute("/_user")({
  loader: async ({ context }) => {
    const session = await context.queryClient.fetchQuery(sessionQuery);
    // 预取导航数据：消除用户区布局层 SSR 空壳导致的全站水合 mismatch
    await context.queryClient.ensureQueryData(navMenuQuery);
    return { session };
  },
  component: UserLayout,
  errorComponent: ({ error }) => <ErrorPage error={error} />,
  headers: () => {
    return CACHE_CONTROL.private;
  },
});

function UserLayout() {
  const { session } = Route.useLoaderData();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: navMenu = [] } = useQuery(navMenuQuery);
  const navOptions = navMenu;

  const logout = async () => {
    const { error } = await authClient.signOut();
    if (error) {
      toast.error(m.auth_logout_failed(), {
        description:
          getLogoutAuthErrorMessage(error, m) ?? m.auth_logout_failed_desc(),
      });
      return;
    }

    queryClient.removeQueries({ queryKey: AUTH_KEYS.session });

    toast.success(m.auth_logout_success(), {
      description: m.auth_logout_success_desc(),
    });
  };

  // Global shortcut: Cmd/Ctrl + K to navigate to search
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const isToggle = (e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k";
      if (isToggle) {
        e.preventDefault();
        navigate({ to: "/search" });
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [navigate]);

  // isSessionLoading 恒为 false：loader 已 fetchQuery(sessionQuery) 拿到真实
  // session（本布局是 CACHE_CONTROL.private，可安全 SSR 登录态）。不再使用
  // authClient.useSession() 的 pending 态——它在服务端恒为 true、客户端首帧
  // 可能为 false，会造成「骨架 vs 真实内容」的水合 mismatch (#418)。
  return (
    <>
      <theme.UserLayout
        isAuthenticated={!!session?.user}
        navOptions={navOptions}
        user={session?.user}
        isSessionLoading={false}
        logout={logout}
      >
        <Outlet />
      </theme.UserLayout>
      <theme.Toaster />
    </>
  );
}
