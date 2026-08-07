import { useMemo, useState } from "react";
import { useSuspenseQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { ChevronRight } from "lucide-react";
import type { HomeCategoryTabConfig, HomePageProps } from "@/features/theme/contract/pages";
import { CategoryTabs, type Tab } from "../../components/category-tabs";
import { GridPostCard } from "../../components/grid-post-card";
import { Pagination } from "@/features/theme/components/pagination";
import { postsPagedQueryOptions } from "@/features/posts/queries";

const LATEST_TAB_ID = "__latest__";
const HOME_DEFAULT_PAGE_SIZE = 12;

type StyleMode = "tabs" | "stacked";

export function HomePage({
  recentPostsLimit,
  categoryTabs = [],
  homeCategoryStyle = "tabs",
}: HomePageProps) {
  const mode: StyleMode =
    homeCategoryStyle === "stacked" ? "stacked" : "tabs";

  if (mode === "stacked") {
    return (
      <HomeStackedView
        recentPostsLimit={recentPostsLimit}
        categoryTabs={categoryTabs}
      />
    );
  }
  return (
    <HomeTabsView
      recentPostsLimit={recentPostsLimit}
      categoryTabs={categoryTabs}
    />
  );
}

/** 标签切换式：顶部一排 tab，选一个分类显示其文章（原逻辑） */
function HomeTabsView({
  recentPostsLimit,
  categoryTabs,
}: {
  recentPostsLimit?: number;
  categoryTabs: Array<HomeCategoryTabConfig>;
}) {
  const [activeId, setActiveId] = useState<string>(LATEST_TAB_ID);
  const [page, setPage] = useState(1);

  // tab 列表：最新发布 + 后台配置的分类 tab（按配置顺序）
  const tabs = useMemo<Tab[]>(() => {
    const list: Tab[] = [{ id: LATEST_TAB_ID, label: "最新发布" }];
    for (const cfg of categoryTabs) {
      list.push({ id: `cat_${cfg.categoryId}`, label: cfg.displayName });
    }
    return list;
  }, [categoryTabs]);

  // 当前选中的分类 id（"最新发布"为 undefined → 查全部）
  const activeCategoryId = activeId.startsWith("cat_")
    ? Number(activeId.slice(4))
    : undefined;

  // 当前 tab 每页数量：最新发布用 recentPostsLimit，分类用该 tab 的 postLimit
  const pageSize = useMemo(() => {
    if (activeCategoryId === undefined) {
      return recentPostsLimit && recentPostsLimit > 0
        ? recentPostsLimit
        : HOME_DEFAULT_PAGE_SIZE;
    }
    const tab = categoryTabs.find((t) => t.categoryId === activeCategoryId);
    return tab?.postLimit && tab.postLimit > 0
      ? tab.postLimit
      : HOME_DEFAULT_PAGE_SIZE;
  }, [activeCategoryId, recentPostsLimit, categoryTabs]);

  // “更多”链接目标：选中具体分类 → /posts?categoryId=X；选中“最新发布”(全部) → /posts
  const moreSearch = useMemo<{ categoryId?: number }>(() => {
    if (activeCategoryId !== undefined) {
      return { categoryId: activeCategoryId };
    }
    return {};
  }, [activeCategoryId]);

  // 按当前 tab + 当前页实时分页查询（最新发布不传 categoryId → 全部文章）
  const { data } = useSuspenseQuery(
    postsPagedQueryOptions({
      categoryId: activeCategoryId,
      page,
      limit: pageSize,
    }),
  );
  const visiblePosts = data.items;
  const totalPages = data.totalPages;

  // 切换分类 tab 时回到第 1 页
  const handleTabChange = (id: string) => {
    setActiveId(id);
    setPage(1);
  };

  return (
    <div className="flex flex-col gap-6">
      {tabs.length > 1 && (
        <div className="flex items-center gap-4">
          <CategoryTabs
            tabs={tabs}
            activeId={activeId}
            onChange={handleTabChange}
          />
          <Link
            to="/posts"
            search={moreSearch}
            className="group ml-auto flex shrink-0 items-center gap-0.5 text-sm font-medium text-(--fuwari-meta) transition hover:text-(--fuwari-primary)"
          >
            更多
            <ChevronRight
              size={16}
              className="transition-transform group-hover:translate-x-0.5"
            />
          </Link>
        </div>
      )}

      {visiblePosts.length === 0 ? (
        <div className="flex min-h-40 items-center justify-center rounded-2xl bg-(--fuwari-card-bg) py-16 text-(--fuwari-meta)">
          {activeCategoryId === undefined ? "暂无最新发布" : "该分类下暂无文章"}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-4">
          {visiblePosts.map((post) => (
            <GridPostCard key={post.slug} post={post} />
          ))}
        </div>
      )}

      <Pagination
        currentPage={page}
        totalPages={totalPages}
        onPageChange={setPage}
      />
    </div>
  );
}

/** 单个分类区块（含标题、文章网格、独立分页、更多），堆叠式复用 */
function CategorySection({
  categoryId,
  limit,
  title,
}: {
  categoryId?: number;
  limit: number;
  title: string;
}) {
  const [page, setPage] = useState(1);

  // 按分类 + 当前页实时分页查询（categoryId 为 undefined → 最新发布/全部）
  const { data } = useSuspenseQuery(
    postsPagedQueryOptions({ categoryId, page, limit }),
  );
  const visiblePosts = data.items;
  const totalPages = data.totalPages;

  const moreSearch = useMemo<{ categoryId?: number }>(
    () => (categoryId !== undefined ? { categoryId } : {}),
    [categoryId],
  );

  return (
    <section className="flex flex-col gap-4">
      <div className="flex items-center gap-4">
        <h2 className="text-lg font-semibold text-(--fuwari-title)">{title}</h2>
        <Link
          to="/posts"
          search={moreSearch}
          className="group ml-auto flex shrink-0 items-center gap-0.5 text-sm font-medium text-(--fuwari-meta) transition hover:text-(--fuwari-primary)"
        >
          更多
          <ChevronRight
            size={16}
            className="transition-transform group-hover:translate-x-0.5"
          />
        </Link>
      </div>

      {visiblePosts.length === 0 ? (
        <div className="flex min-h-32 items-center justify-center rounded-2xl bg-(--fuwari-card-bg) py-12 text-(--fuwari-meta)">
          暂无文章
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-4">
          {visiblePosts.map((post) => (
            <GridPostCard key={post.slug} post={post} />
          ))}
        </div>
      )}

      <Pagination
        currentPage={page}
        totalPages={totalPages}
        onPageChange={setPage}
      />
    </section>
  );
}

/** 垂直堆叠式：最新发布 + 各分类依次向下堆叠成多个区块，每块独立翻页 */
function HomeStackedView({
  recentPostsLimit,
  categoryTabs,
}: {
  recentPostsLimit?: number;
  categoryTabs: Array<HomeCategoryTabConfig>;
}) {
  const latestLimit =
    recentPostsLimit && recentPostsLimit > 0
      ? recentPostsLimit
      : HOME_DEFAULT_PAGE_SIZE;

  return (
    <div className="flex flex-col gap-10">
      <CategorySection
        categoryId={undefined}
        limit={latestLimit}
        title="最新发布"
      />
      {categoryTabs.map((tab) => {
        const limit =
          tab.postLimit && tab.postLimit > 0
            ? tab.postLimit
            : HOME_DEFAULT_PAGE_SIZE;
        return (
          <CategorySection
            key={tab.categoryId}
            categoryId={tab.categoryId}
            limit={limit}
            title={tab.displayName}
          />
        );
      })}
    </div>
  );
}

// 类型 re-export keep TS happy in other themes that may reference HomeCategoryTabConfig
export type { HomeCategoryTabConfig };
