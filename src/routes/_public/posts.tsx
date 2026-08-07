import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import theme from "@theme";
import { z } from "zod";
import { siteConfigQuery, siteDomainQuery } from "@/features/config/queries";
import { categoriesQueryOptions } from "@/features/categories/queries";
import { postsPagedQueryOptions } from "@/features/posts/queries";
import {
  PostTagNameSchema,
  POST_SORT_DIRECTIONS,
  POST_SORT_FIELDS,
} from "@/features/posts/schema/posts.schema";
import { getNextPostTagFilter } from "@/features/posts/utils/post-tag-filter";
import { tagsQueryOptions } from "@/features/tags/queries";
import { buildCanonicalUrl, canonicalLink } from "@/lib/seo";
import { m } from "@/paraglide/messages";

const { postsPerPage } = theme.config.posts;

export const Route = createFileRoute("/_public/posts")({
  validateSearch: z.object({
    tagName: PostTagNameSchema,
    categoryId: z.coerce.number().optional(),
    uncategorized: z.coerce.boolean().optional(),
    page: z.coerce.number().int().min(1).optional(),
    sortBy: z.enum(POST_SORT_FIELDS).optional(),
    sortDir: z.enum(POST_SORT_DIRECTIONS).optional(),
  }),
  component: RouteComponent,
  pendingComponent: PostsSkeleton,
  loaderDeps: ({ search: { tagName, categoryId, uncategorized, page, sortBy, sortDir } }) => ({
    tagName,
    categoryId,
    uncategorized,
    page,
    sortBy,
    sortDir,
  }),
  loader: async ({ context, deps }) => {
    const [, categories, , domain, siteConfig] = await Promise.all([
      context.queryClient.ensureQueryData(
        postsPagedQueryOptions({
          tagName: deps.tagName,
          categoryId: deps.categoryId,
          uncategorized: deps.uncategorized,
          page: deps.page,
          limit: postsPerPage,
          sortBy: deps.sortBy,
          sortDir: deps.sortDir,
        }),
      ),
      context.queryClient.ensureQueryData(categoriesQueryOptions),
      context.queryClient.prefetchQuery(tagsQueryOptions),
      context.queryClient.ensureQueryData(siteDomainQuery),
      context.queryClient.ensureQueryData(siteConfigQuery),
    ]);

    const categoryName = deps.categoryId
      ? categories?.find((c) => c.id === deps.categoryId)?.name
      : undefined;
    const title = categoryName
      ? categoryName
      : deps.tagName
        ? `标签：${deps.tagName}`
        : deps.uncategorized
          ? "未分类"
          : m.posts_title();

    return {
      title,
      description: siteConfig.description,
      canonicalHref: buildCanonicalUrl(domain, "/posts", {
        tagName: deps.tagName,
      }),
    };
  },
  head: ({ loaderData }) => ({
    meta: [
      {
        title: loaderData?.title,
      },
      {
        name: "description",
        content: loaderData?.description,
      },
    ],
    links: [canonicalLink(loaderData?.canonicalHref ?? "/posts")],
  }),
});

function RouteComponent() {
  const {
    tagName,
    categoryId,
    uncategorized,
    page,
    sortBy,
    sortDir,
  } = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });

  const { data: tags } = useSuspenseQuery(tagsQueryOptions);
  const { data: categories } = useSuspenseQuery(categoriesQueryOptions);

  const { data } = useSuspenseQuery(
    postsPagedQueryOptions({
      tagName,
      categoryId,
      uncategorized,
      page,
      limit: postsPerPage,
      sortBy,
      sortDir,
    }),
  );

  const categoryName = categoryId
    ? categories.find((c) => c.id === categoryId)?.name
    : undefined;

  const handleTagClick = (clickedTag?: string) => {
    navigate({
      search: (prev: ReturnType<typeof Route.useSearch>) => ({
        ...prev,
        ...getNextPostTagFilter(tagName, clickedTag),
        page: 1,
      }),
      replace: true, // Replace history to avoid back-button clutter
    });
  };

  const handlePageChange = (newPage: number) => {
    navigate({
      search: (prev: ReturnType<typeof Route.useSearch>) => ({ ...prev, page: newPage }),
    });
  };

  const handleSortChange = (nextSortBy: string, nextSortDir: string) => {
    navigate({
      search: (prev: ReturnType<typeof Route.useSearch>) => ({
        ...prev,
        sortBy: nextSortBy as typeof sortBy,
        sortDir: nextSortDir as typeof sortDir,
        page: 1,
      }),
    });
  };

  return (
    <theme.PostsPage
      posts={data.items}
      tags={tags}
      selectedTag={tagName}
      onTagClick={handleTagClick}
      page={data.page}
      totalPages={data.totalPages}
      totalCount={data.totalCount}
      onPageChange={handlePageChange}
      sortBy={sortBy}
      sortDir={sortDir}
      onSortChange={handleSortChange}
      categoryName={categoryName}
      uncategorized={uncategorized}
    />
  );
}

function PostsSkeleton() {
  return <theme.PostsPageSkeleton />;
}
