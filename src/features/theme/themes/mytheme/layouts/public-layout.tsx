import { useRouterState, useRouteContext } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { cn } from "@/lib/utils";
import type { PublicLayoutProps } from "@/features/theme/contract/layouts";
import { postBySlugQuery, postByIdPublicQuery } from "@/features/posts/queries";
import { SidebarDownloadBox } from "@/features/post-resources/components/public/sidebar-download-box";
import { HotPosts } from "../components/hot-posts";
import { PopupModal } from "@/features/popup/components/popup-modal";
import { Sidebar } from "../components/sidebar";
import { FloatingToolbar } from "@/components/common/floating-toolbar";
import { Footer } from "./footer";
import { MobileMenu } from "./mobile-menu";
import { Navbar } from "./navbar";

const BANNER_HEIGHT_HOME = 65;
const BANNER_HEIGHT_PAGE = 35;

export function PublicLayout({
  children,
  navOptions,
  user,
  isSessionLoading,
  logout,
}: PublicLayoutProps) {
  const { siteConfig } = useRouteContext({ from: "__root__" });
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  // Use the resolved (destination) location instead of useLocation(): during a
  // navigation the layout must switch to the page we are GOING to, not the page
  // we are leaving. useLocation() lags one render behind on the pending route,
  // which made the sidebar flash in/out and look like a jump to the homepage.
  const pathname = useRouterState({
    select: (s) => s.resolvedLocation?.pathname ?? s.location.pathname,
  });
  const isHomePage = pathname === "/";
  // 详情页：/post/ 开头（注意与 /posts 列表页区分）
  const isPostPage = pathname.startsWith("/post/");
  // 全宽页面（隐藏右侧栏）：首页默认隐藏；/posts 分类列表页同样隐藏作者模块 + 标签云；
  // 搜索页完全不显示侧边栏；会员中心（_user 整组已并入 /membership 单页框架）同样关闭侧边栏。
  const hideSidebar =
    isHomePage ||
    pathname.startsWith("/posts") ||
    pathname.startsWith("/search") ||
    pathname.startsWith("/membership");
  const bannerHeightVh = isHomePage ? BANNER_HEIGHT_HOME : BANNER_HEIGHT_PAGE;
  // 侧边栏位置：详情页在右，其它页在左
  const gridCols = hideSidebar
    ? "lg:grid-cols-1"
    : isPostPage
      ? "lg:grid-cols-[1fr_17.5rem]"
      : "lg:grid-cols-[17.5rem_1fr]";
  const sidebarOrder = isPostPage ? "order-2 lg:order-2" : "order-2 lg:order-1";
  const mainOrder = isPostPage ? "order-1 lg:order-1" : "order-1 lg:order-2";
  // 详情页：从 URL 解析段落取 post，供侧边栏下载模块使用。
  // 后台 URL 模式为 html / id 时路径形如 /post/{slug}.html 或 /post/{id}.html；
  // 段落为数字时走「按 id 取」（id 模式），否则按 slug 取——与详情页 $slug.tsx 的解析逻辑一致，
  // 否则 id 模式下用 "123" 当 slug 去查会查不到，导致桌面端下载模块不渲染。
  const rawSegment = isPostPage ? pathname.slice("/post/".length) : "";
  const segment = rawSegment.replace(/\.html$/i, "");
  const idNum = Number(segment);
  const isNumeric = Number.isInteger(idNum) && idNum > 0;
  const { data: sidebarPost } = useQuery({
    ...(isNumeric ? postByIdPublicQuery(idNum) : postBySlugQuery(segment)),
    enabled: isPostPage && segment.length > 0,
  });

  return (
    <div className="relative min-h-screen bg-(--fuwari-page-bg) transition-colors">
      <MobileMenu
        navOptions={navOptions}
        isOpen={isMenuOpen}
        onClose={() => setIsMenuOpen(false)}
        user={user}
        logout={logout}
      />

      {/* Top row: Navbar - sticky */}
      <div className="sticky top-0 z-50 pointer-events-none">
        <div className="pointer-events-auto max-w-(--fuwari-page-width) mx-auto px-0 md:px-4">
          <Navbar
            navOptions={navOptions}
            onMenuClick={() => setIsMenuOpen(true)}
            user={user}
            isLoading={isSessionLoading}
            bannerHeightVh={bannerHeightVh}
          />
        </div>
      </div>

      {/* Banner - full width background */}
      <div
        className="absolute left-0 right-0 top-0 z-10 overflow-hidden"
        style={{ height: `${bannerHeightVh}vh` }}
      >
        <img
          src={siteConfig.theme.mytheme.homeBg}
          alt="banner"
          fetchPriority="high"
          className="w-full h-full object-cover object-center"
        />
      </div>

      {/* Main content - sits right below the banner */}
      <div
        className="relative z-30"
        style={{
          marginTop: `calc(${bannerHeightVh}vh - 3rem)`,
        }}
      >
        <div
          className={`relative mx-auto px-4 md:px-4 pb-8 grid grid-cols-1 ${gridCols} gap-4`}
          style={{ maxWidth: "var(--fuwari-page-width)" }}
        >
          {/* Sidebar Column (hidden on homepage / posts list / mobile; 详情页在右、其它页在左) */}
          {!hideSidebar && (
            <div className={cn("hidden lg:flex flex-col gap-4", sidebarOrder)}>
              {isPostPage && sidebarPost && (
                <SidebarDownloadBox postId={sidebarPost.id} postTitle={sidebarPost.title} />
              )}
              {isPostPage && <HotPosts />}
              <Sidebar hideProfile={isPostPage} />
            </div>
          )}

          {/* Main Content Column */}
          <main className={cn(mainOrder, "flex flex-col gap-4 min-w-0")}>
            {children}
          </main>

          <FloatingToolbar config={siteConfig.theme.mytheme.floatingToolbar} />
          <PopupModal />
        </div>

        {/* Footer：移出受限宽度的 grid，作为通栏块，分隔线一直到底 */}
        <Footer />
      </div>
    </div>
  );
}
