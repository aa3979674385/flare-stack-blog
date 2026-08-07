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
import { getPostUrlSuffix, postPath } from "@/lib/post-url";

const searchSchema = z.object({
  highlightCommentId: z.coerce.number().optional(),
  rootId: z.number().optional(),
});

const { relatedPostsLimit } = theme.config.post;

/**
 * 主查询解析：loader 与组件必须共用同一份逻辑，保证客户端水合命中同一份缓存，
 * 否则会出现「loader 预取的是 slug 查询、组件却按 id 查询」的 key 不一致 → 404 / 崩溃。
 *  - "id" 模式且段落为数字：按 id 取
 *  - 其它情况（none / html，或 id 模式下的旧 slug 链接）：按 slug 取
 * 段落末尾的 .html 在这里统一剥掉。
 */
function primaryPostQuery(segment: string) {
  const clean = segment.replace(/\.html$/i, "");
  const idNum = Number(clean);
  const isNumeric = Number.isInteger(idNum) && idNum > 0;
  const mode = getPostUrlSuffix();
  if (mode === "id" && isNumeric) return postByIdQuery(idNum);
  return postBySlugQuery(clean);
}

/**
 * 按当前 URL 模式加载文章。
 * 主查询与 primaryPostQuery 完全一致；当 html/none 模式下数字段落按 slug 取不到时，
 * 再退回按 id 取（兼容旧的 id 形式链接），并把结果写回 slug 查询缓存，
 * 这样组件（始终走 slug 查询 key）也能拿到数据，不会水合失败。
 */
async function loadPostBySegment(
  queryClient: QueryClient,
  segment: string,
): Promise<PostWithToc | null> {
  const clean = segment.replace(/\.html$/i, "");
  const idNum = Number(clean);
  const isNumeric = Number.isInteger(idNum) && idNum > 0;
  const mode = getPostUrlSuffix();

  const post = (await queryClient
    .ensureQueryData(primaryPostQuery(segment))
    .catch(() => null)) as PostWithToc | null;
  if (post) return post;

  // html/none 模式：slug 没命中时退回按 id 取，并把结果镜像到 slug key
  if (mode !== "id" && isNumeric) {
    const byId = (await queryClient
      .ensureQueryData(postByIdQuery(idNum))
      .catch(() => null)) as PostWithToc | null;
    if (byId) {
      queryClient.setQueryData(postBySlugQuery(clean).queryKey, byId);
      return byId;
    }
  }
  return null;
}

export const Route = createFileRoute("/_public/post/$slug")({
  validateSearch: searchSchema,
  component: RouteComponent,
  loader: async ({ context, params }) => {
    // 1. Critical: Main post data - use serverFn (executes directly on server, no HTTP)
    const [post, domain, siteConfig] = await Promise.all([
      loadPostBySegment(context.queryClient, params.slug),
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
  // 与 loader 共用同一份解析逻辑（primaryPostQuery），保证水合命中同一缓存 key
  const postQuery = primaryPostQuery(slug);
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
