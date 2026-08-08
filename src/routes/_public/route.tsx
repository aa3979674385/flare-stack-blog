import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Outlet, useNavigate } from "@tanstack/react-router";
import theme from "@theme";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { AUTH_KEYS } from "@/features/auth/queries";
import { getThemePreloadImages } from "@/features/theme/site-config.helpers";
import { navMenuQuery } from "@/features/navigation/queries";
import { authClient } from "@/lib/auth/auth.client";
import { getLogoutAuthErrorMessage } from "@/lib/auth/auth-errors";
import { CACHE_CONTROL } from "@/lib/constants";
import { m } from "@/paraglide/messages";

export const Route = createFileRoute("/_public")({
  loader: async ({ context }) => {
    // 预取导航数据：让 SSR 首屏就渲染出真实导航菜单。
    // 否则组件里的 useQuery(navMenuQuery) 在服务端处于 pending（空壳 <nav>），
    // 客户端注水后才有数据 → 全站水合不匹配 (#418)。
    await context.queryClient.ensureQueryData(navMenuQuery);
    return {
      preloadImages: getThemePreloadImages(context.siteConfig),
    };
  },
  component: PublicLayout,
  headers: () => {
    return CACHE_CONTROL.public;
  },
  head: ({ loaderData }) => ({
    links: (loaderData?.preloadImages ?? []).map((href) => ({
      rel: "preload" as const,
      as: "image",
      href,
    })),
  }),
});

function PublicLayout() {
  const navigate = useNavigate();
  const { data: session, isPending: isSessionPending } =
    authClient.useSession();
  const queryClient = useQueryClient();

  // 水合守卫：/_public 走 CDN 公共缓存（CACHE_CONTROL.public），SSR 绝不能输出
  // 用户专属的登录态（否则会被 CDN 缓存串给其他访客）。因此服务端必然渲染
  // 「未登录 / 加载中」骨架，而 better-auth 的 useSession 在客户端首帧就可能
  // 已有缓存态（isPending=false）→ 服务端 <div>Skeleton 对上客户端 <a>Link，
  // 结构不匹配 → 全站 #418。这里强制客户端首帧与服务端一致，useEffect 之后
  // （水合完成）再切换到真实登录态。
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => {
    setHydrated(true);
  }, []);

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

  return (
    <>
      <theme.PublicLayout
        navOptions={navOptions}
        user={hydrated ? session?.user : undefined}
        isSessionLoading={!hydrated || isSessionPending}
        logout={logout}
      >
        <Outlet />
      </theme.PublicLayout>
      <theme.Toaster />
    </>
  );
}
