import { Link, useRouteContext } from "@tanstack/react-router";
import { ContentRenderer } from "@theme/components/content/content-renderer";
import { Clock, FileText, Pencil } from "lucide-react";
import type { PostPageProps } from "@/features/theme/contract/pages";
// 注意：@theme/* 别名在 tsconfig 里固定指向 themes/default，
// 而本主题的评论组件导出名是 FuwariCommentSection，
// 因此改用本主题的显式路径（与 fuwari 主题写法一致），避免 TS2724。
import { FuwariCommentSection } from "@/features/theme/themes/mytheme/components/comments/view/comment-section";
import { SidebarDownloadBox } from "@/features/post-resources/components/public/sidebar-download-box";
import { authClient } from "@/lib/auth/auth.client";
import { m } from "@/paraglide/messages";
import { PostMeta } from "./components/post-meta";
import { PostSummary } from "./components/post-summary";
import TableOfContents from "./components/table-of-contents";

export function PostPage({ post }: PostPageProps) {
  const { data: session } = authClient.useSession();
  const { siteConfig } = useRouteContext({ from: "__root__" });
  // Approximate word count
  const wordCount = post.readTimeInMinutes * 300;

  const copyrightNotice: string =
    siteConfig?.theme?.mytheme?.copyrightNotice ?? "";

  return (
    <div className="relative flex flex-col rounded-(--fuwari-radius-large) py-1 md:py-0 md:bg-transparent gap-4 mb-4 w-full">
      {/* Table Of Contents (Desktop Floating Left, mirrors the right sidebar) */}
      <div
        className="hidden 2xl:block absolute top-0 h-full pr-4"
        style={{
          left: "calc(var(--fuwari-toc-width) * -1)",
          width: "var(--fuwari-toc-width)",
        }}
      >
        <TableOfContents headers={post.toc} />
      </div>

      {/* Main Post Container */}
      <div className="fuwari-card-base z-10 px-6 md:px-9 pt-6 pb-4 relative w-full">
        {/* Word count and reading time */}
        <div className="flex flex-row flex-wrap fuwari-text-30 gap-5 mb-3 transition">
          <div className="flex flex-row items-center">
            <div className="transition h-6 w-6 rounded-md bg-black/5 dark:bg-white/10 fuwari-text-50 flex items-center justify-center mr-2">
              <FileText strokeWidth={1.5} size={16} />
            </div>
            <div className="text-sm">
              {m.post_word_count({ count: wordCount })}
            </div>
          </div>
          <div className="flex flex-row items-center">
            <div className="transition h-6 w-6 rounded-md bg-black/5 dark:bg-white/10 fuwari-text-50 flex items-center justify-center mr-2">
              <Clock strokeWidth={1.5} size={16} />
            </div>
            <div className="text-sm">
              {m.read_time({ count: post.readTimeInMinutes })}
            </div>
          </div>
          {session?.user.role === "admin" && (
            <Link
              to="/admin/posts/edit/$id"
              params={{ id: String(post.id) }}
              className="flex flex-row items-center fuwari-text-30 hover:fuwari-text-90 transition animate-in fade-in duration-500"
            >
              <div className="transition h-6 w-6 rounded-md bg-black/5 dark:bg-white/10 fuwari-text-50 flex items-center justify-center mr-2">
                <Pencil strokeWidth={1.5} size={16} />
              </div>
              <div className="text-sm">{m.post_edit()}</div>
            </Link>
          )}
        </div>

        {/* Title */}
        <div className="relative">
          <h1
            className="transition w-full block font-bold mb-3
              text-3xl md:text-[2.25rem]/[2.75rem]
              fuwari-text-90
              md:before:w-1 before:h-5 before:rounded-md before:bg-(--fuwari-primary)
              before:absolute before:top-3 before:-left-4.5"
            style={{ viewTransitionName: `post-title-${post.slug}` }}
          >
            {post.title}
          </h1>
        </div>

        {/* Metadata */}
        <div>
          <PostMeta post={post} className="mb-5" />
        </div>

        {/* Summary */}
        <PostSummary summary={post.summary} />

        {/* Markdown Content */}
        <div className="mb-6 prose dark:prose-invert prose-base max-w-none! fuwari-custom-md">
          <ContentRenderer content={post.contentJson} />
        </div>

        {/* Download Module (Mobile only - between content and END, looks part of article) */}
        <div className="block lg:hidden mb-6">
          <SidebarDownloadBox postId={post.id} postTitle={post.title} />
        </div>

        {/* End of Content Notice */}
        <div className="my-8 flex items-center justify-center w-full">
          <div className="h-px w-full bg-linear-to-r from-transparent via-(--fuwari-meta-divider) to-transparent opacity-20" />
          <span className="mx-4 text-sm font-mono tracking-widest text-(--fuwari-meta-divider) opacity-50 whitespace-nowrap">
            END
          </span>
          <div className="h-px w-full bg-linear-to-r from-(--fuwari-meta-divider) via-transparent to-transparent opacity-20" />
        </div>

        {/* Copyright Notice */}
        {copyrightNotice ? (
          <div className="mt-6">
            <div
              // biome-ignore lint/security/noDangerouslySetInnerHtml: 管理员在后台配置的 HTML 内容，非用户生成
              dangerouslySetInnerHTML={{ __html: copyrightNotice }}
              className="prose dark:prose-invert prose-sm max-w-none! text-(--fuwari-meta-divider)/70"
            />
          </div>
        ) : null}
      </div>

      {/* Prev/Next buttons (Mock implementation for layout, actual data would come from the server in an ideal setup) */}
      <div className="hidden flex-col md:flex-row justify-between gap-4 overflow-hidden w-full">
        {/* Note: the backend schema doesn't currently provide prev/next slugs in PostWithToc. Using placeholder layouts to match Fuwari exactly. */}
      </div>

      {/* Comments Section */}
      <div className="fuwari-card-base p-6">
        <FuwariCommentSection postId={post.id} />
      </div>
    </div>
  );
}
