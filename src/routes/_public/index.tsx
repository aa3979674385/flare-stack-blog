import { useSuspenseQueries, useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import theme from "@theme";
import type { HomeCategoryTabConfig } from "@/features/theme/contract/pages";
import { siteDomainQuery } from "@/features/config/queries";
import {
  pinnedPostsQuery,
  popularPostsQuery,
  postsByCategoryQuery,
  recentPostsQuery,
} from "@/features/posts/queries";
import { categoriesQueryOptions } from "@/features/categories/queries";
import { buildCanonicalUrl, canonicalLink } from "@/lib/seo";

const { popularPostsLimit } = theme.config.home;

export const Route = createFileRoute("/_public/")({
  loader: async ({ context }) => {
    const homeCategoryTabs =
      context.siteConfig?.theme?.mytheme?.homeCategoryTabs ?? [];
    const recentPostsLimit =
      context.siteConfig?.theme?.mytheme?.recentPostsLimit ??
      theme.config.home.recentPostsLimit;
    const homeCategoryStyle =
      context.siteConfig?.theme?.mytheme?.homeCategoryStyle ?? "tabs";

    // 1) 基础数据：置顶/热门/最近/pinned/popular + 分类列表（用于 tab label fallback）
    const [, , , domain, publicCategories] = await Promise.all([
      context.queryClient.ensureQueryData(recentPostsQuery(recentPostsLimit)),
      context.queryClient.ensureQueryData(pinnedPostsQuery),
      context.queryClient.ensureQueryData(popularPostsQuery(popularPostsLimit)),
      context.queryClient.ensureQueryData(siteDomainQuery),
      context.queryClient.ensureQueryData(categoriesQueryOptions),
    ]);

    // 2) 给每个分类 tab 拉对应的 top N 篇
    const categoryNameById = new Map<number, string>();
    for (const cat of publicCategories ?? []) {
      categoryNameById.set(cat.id, cat.name);
    }
    const perCategoryPosts = await Promise.all(
      homeCategoryTabs.map((tab) =>
        context.queryClient.ensureQueryData(
          postsByCategoryQuery(tab.categoryId, tab.postLimit),
        ),
      ),
    );

    const categoryTabs: Array<HomeCategoryTabConfig> = homeCategoryTabs.map(
      (tab, idx) => ({
        categoryId: tab.categoryId,
        label: tab.label,
        postLimit: tab.postLimit,
        posts: perCategoryPosts[idx] ?? [],
        displayName:
          tab.label?.trim() ||
          categoryNameById.get(tab.categoryId) ||
          `分类#${tab.categoryId}`,
      }),
    );

    return {
      canonicalHref: buildCanonicalUrl(domain, "/"),
      recentPostsLimit,
      homeCategoryStyle,
      categoryTabs,
    };
  },
  head: ({ loaderData }) => ({
    links: [canonicalLink(loaderData?.canonicalHref ?? "/")],
  }),
  pendingComponent: HomePageSkeleton,
  component: HomeRoute,
});

function HomeRoute() {
  const { recentPostsLimit, categoryTabs, homeCategoryStyle } =
    Route.useLoaderData();
  const { data: posts } = useSuspenseQuery(recentPostsQuery(recentPostsLimit));
  const { data: pinnedPosts } = useSuspenseQuery(pinnedPostsQuery);
  const { data: popularPosts } = useSuspenseQuery(
    popularPostsQuery(popularPostsLimit),
  );
  const categoryQueries = useSuspenseQueries({
    queries: (categoryTabs ?? []).map((tab: HomeCategoryTabConfig) =>
      postsByCategoryQuery(tab.categoryId, tab.postLimit),
    ),
  });
  const postsByCategoryId = new Map<number, ReturnType<typeof useSuspenseQuery>["data"]>();
  (categoryTabs ?? []).forEach((tab: HomeCategoryTabConfig, i: number) => {
    postsByCategoryId.set(tab.categoryId, categoryQueries[i]?.data);
  });

  return (
    <theme.HomePage
      posts={posts}
      pinnedPosts={pinnedPosts}
      popularPosts={popularPosts}
      recentPostsLimit={recentPostsLimit}
      homeCategoryStyle={homeCategoryStyle}
      categoryTabs={(categoryTabs ?? []).map((tab: HomeCategoryTabConfig) => ({
        ...tab,
        posts: postsByCategoryId.get(tab.categoryId) ?? tab.posts ?? [],
      }))}
    />
  );
}

function HomePageSkeleton() {
  return <theme.HomePageSkeleton />;
}
