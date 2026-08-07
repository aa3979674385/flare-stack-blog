import { useSuspenseQuery, type QueryClient } from "@tanstack/react-query";
import { createFileRoute, notFound } from "@tanstack/react-router";
import theme from "@theme";
import { useEffect } from "react";
import { z } from "zod";
import { siteConfigQuery, siteDomainQuery } from "@/features/config/queries";
import { recordPageViewFn } from "@/features/pageview/api/pageview.api";
import { postBySlugQuery, relatedPostsQuery, popularPostsQuery, postByIdQuery } from "@/features/posts/queries";
import type { PostWithToc } from "@/features/posts/schema/posts.schema";
import {
  buildArticleJsonLd,
  buildCanonicalUrl,
  canonicalLink,
} from "@/lib/seo";
import { getPostUrlSuffix, postPath, type PostUrlMode } from "@/lib/post-url";

const searchSchema = z.object({
  highlightCommentId: z.coerce.number().optional(),
  rootId: z.number().optional(),
});

const { relatedPostsLimit } = theme.config.post;

/**
 * 按当前 URL 模式加载文章：
 *  - "id" 模式：优先按数字 id 取，取不到再退回到 slug（保证旧链接 / 已收录页面仍可用）
 *  - 其它模式：按 slug 取；若段落是数字（如会员中心用 postId 拼的链接），退回到按 id 取
 * 段落末尾的 .html 在这里统一剥掉。
 */
async function loadPostBySegment(
  queryClient: QueryClient,
  segment: string,
  mode: PostUrlMode,
): Promise<PostWithToc | null> {
  const clean = segment.replace(/\.html$/i, "");
  const idNum = Number(clean);
  const isNumeric = Number.isInteger(idNum) && idNum > 0;

  if (mode === "id") {
    if (isNumeric) {
      const byId = await queryClient
        .ensureQueryData(postByIdQuery(idNum))
        .catch(() => null);
      if (byId) return byId as PostWithToc;
    }
    return (
      (await queryClient.ensureQueryData(postBySlugQuery(clean)).catch(() => null)) ??
      null
    );
  }

  const bySlug = await queryClient
    .ensureQueryData(postBySlugQuery(clean))
    .catch(() => null);
  if (bySlug) return bySlug;
  if (isNumeric) {
    return (
      (await queryClient.ensureQueryData(postByIdQuery(idNum)).catch(() => null)) as
        | PostWithToc
        | null ?? null
    );
  }
  return null;
}

export const Route = createFileRoute("/_public/post/$slug")({
  validateSearch: searchSchema,
  component: RouteComponent,
  loader: async ({ context, params }) => {
    const mode = getPostUrlSuffix();

    // 1. Critical: Main post data - use serverFn (executes directly on server, no HTTP)
    const [post, domain, siteConfig] = await Promise.all([
      loadPostBySegment(context.queryClient, params.slug, mode),
      context.queryClient.ensureQueryData(siteDomainQuery),
      context.queryClient.ensureQueryData(siteConfigQuery),
      // 热门文章：SSR 预取，整页刷新时客户端直接水合、不再重新请求后端
      context.queryClient
        .ensureQueryData(popularPostsQuery(5))
        .catch((err) => {
          console.error("[loader] 预取热门文章失败（不影响文章主体）", err);
          return undefined;
        }),
    ]);

    // 2. Deferred: Related posts (prefetch only, don't await)
    void context.queryClient.prefetchQuery(
      relatedPostsQuery(post?.slug ?? params.slug, relatedPostsLimit),
    );

    if (!post) throw notFound();

    return {
      post,
      authorName: siteConfig.author,
      canonicalHref: buildCanonicalUrl(domain, postPath(post)),
    };
  },
  head: ({ loaderData }) => {
    const post = loaderData?.post;
    const canonicalHref = loaderData?.canonicalHref ?? "";

    return {
      meta: [
        {
          title: post?.title,
        },
        {
          name: "description",
          content: post?.summary ?? "",
        },
        { property: "og:title", content: post?.title ?? "" },
        { property: "og:description", content: post?.summary ?? "" },
        { property: "og:type", content: "article" },
        { property: "og:url", content: canonicalHref },
      ],
      links: [canonicalLink(canonicalHref)],
      scripts: post
        ? [
            {
              type: "application/ld+json",
              children: buildArticleJsonLd({
                authorName: loaderData.authorName,
                canonicalHref,
                post,
              }),
            },
          ]
        : [],
    };
  },
  pendingComponent: () => <theme.PostPageSkeleton />,
  pendingMs: __THEME_CONFIG__.pendingMs,
});

function RouteComponent() {
  const { slug } = Route.useParams();
  const clean = slug.replace(/\.html$/i, "");
  const idNum = Number(clean);
  const isNumeric = Number.isInteger(idNum) && idNum > 0;
  // 与 loader 的解析保持一致（保证客户端水合命中同一份缓存，避免二次请求 404）：
  // 段落是数字 → 按 id 取（会员中心等用 postId 拼的链接、以及 id 模式下的 URL）；
  // 其余 → 按 slug 取（none / html 模式、以及 id 模式下旧链接用 slug 访问）。
  // 这里不需要按 mode 区分——数字段落无论在哪种模式下都该命中 id 查询。
  const postQuery = isNumeric ? postByIdQuery(idNum) : postBySlugQuery(clean);
  const { data: post } = useSuspenseQuery(postQuery);

  useEffect(() => {
    if (!post?.id) return;
    try {
      const key = `pv:${post.id}`;
      if (sessionStorage.getItem(key)) return;
      sessionStorage.setItem(key, "1");
    } catch {
      // Safari private mode / storage disabled — record anyway
    }
    void recordPageViewFn({ data: { postId: post.id } });
  }, [post?.id]);

  if (!post) throw notFound();

  return (
    <>
      <theme.PostPage post={post} />
    </>
  );
}
