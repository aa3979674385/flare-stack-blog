import { Link, useRouteContext } from "@tanstack/react-router";
import { Calendar, Crown, Folder, ImageIcon, Lock, Unlock, User } from "lucide-react";
import type { PostItem } from "@/features/posts/schema/posts.schema";
import { formatDate } from "@/lib/utils";

interface GridPostCardProps {
  post: PostItem;
}

/** 收费状态徽章：free=免费 / member=会员免费 / paid=付费 */
function AccessBadge({ type }: { type?: "free" | "member" | "paid" | null }) {
  if (type === "paid") {
    return (
      <span className="inline-flex items-center gap-1 rounded-md bg-amber-50 px-1.5 py-0.5 text-[11px] font-medium text-amber-700 dark:bg-amber-500/15 dark:text-amber-400">
        <Lock size={11} strokeWidth={2} />
        付费
      </span>
    );
  }
  if (type === "member") {
    return (
      <span className="inline-flex items-center gap-1 rounded-md bg-purple-50 px-1.5 py-0.5 text-[11px] font-medium text-purple-700 dark:bg-purple-500/15 dark:text-purple-400">
        <Crown size={11} strokeWidth={2} />
        会员免费
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-1.5 py-0.5 text-[11px] font-medium text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400">
      <Unlock size={11} strokeWidth={2} />
      免费
    </span>
  );
}

export function GridPostCard({ post }: GridPostCardProps) {
  // 发布者信息来自站点配置（单作者博客，所有文章共用同一个发布者头像/昵称）
  const { siteConfig } = useRouteContext({ from: "__root__" });
  const avatar = siteConfig.theme.mytheme.avatar;
  const authorName = siteConfig.author;

  // 封面优先读取文章封面字段（保存时已自动兜底：用户未填则取正文第一张尺寸足够的图）。
  // 外链图若加载失败，按需求保留裂图状态，不自动回退，便于后续手动修复该文章封面。
  const cover = post.coverImage ?? null;
  const category = post.categories?.[0];
  const dateText = formatDate(post.publishedAt);

  const postLink = {
    to: "/post/$slug" as const,
    params: { slug: post.slug },
  };

  return (
    <div className="group flex flex-col gap-3 rounded-2xl bg-(--fuwari-card-bg) p-3 transition hover:-translate-y-1 hover:shadow-lg">
      {/* 封面图容器（置顶角标 / 分类药丸），封面本身可点进文章 */}
      <div className="relative aspect-4/5 w-full overflow-hidden rounded-xl bg-(--fuwari-bg)">
        <Link
          {...postLink}
          className="block h-full w-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--fuwari-primary) rounded-xl"
        >
          {cover ? (
            <img
              src={cover}
              alt={post.title}
              loading="lazy"
              className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-(--fuwari-meta)">
              <ImageIcon size={48} strokeWidth={1.2} />
            </div>
          )}
        </Link>
        {post.pinnedAt && (
          <span className="absolute left-2 top-2 rounded-full bg-(--fuwari-primary) px-2 py-0.5 text-xs font-medium text-white">
            置顶
          </span>
        )}
        {/* 分类：药丸型，浮于图片右下角；可点击跳转该分类 */}
        {category?.name &&
          (category.id ? (
            <Link
              to="/posts"
              search={{ categoryId: category.id }}
              onClick={(e) => e.stopPropagation()}
              className="absolute bottom-2 right-2 z-10 inline-flex items-center gap-1 rounded-full bg-black/55 px-2.5 py-1 text-xs font-medium text-white backdrop-blur-sm transition-colors hover:bg-black/75 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
            >
              <Folder size={11} strokeWidth={2} />
              {category.name}
            </Link>
          ) : (
            <span className="absolute bottom-2 right-2 inline-flex items-center gap-1 rounded-full bg-black/55 px-2.5 py-1 text-xs font-medium text-white backdrop-blur-sm">
              <Folder size={11} strokeWidth={2} />
              {category.name}
            </span>
          ))}
      </div>

      {/* 标题行：前面加发布者圆形头像；整行可点进文章 */}
      <Link
        {...postLink}
        className="flex items-start gap-2 px-1 pt-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--fuwari-primary) rounded-lg"
      >
        <span
          className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden rounded-full bg-(--fuwari-btn-regular-bg) text-(--fuwari-btn-content)"
          title={authorName}
        >
          {avatar ? (
            <img
              src={avatar}
              alt={authorName}
              className="h-full w-full object-cover"
            />
          ) : (
            <User size={16} strokeWidth={2} />
          )}
        </span>
        <h3 className="line-clamp-2 text-base font-semibold leading-snug text-(--fuwari-title) group-hover:text-(--fuwari-primary)">
          {post.title}
        </h3>
      </Link>

      {/* 元信息行：收费状态（左）+ 发布时间（靠最右） */}
      <div className="flex flex-wrap items-center justify-between gap-x-2.5 gap-y-1 px-1 text-xs text-(--fuwari-meta)">
        <AccessBadge type={post.accessType} />
        {dateText && (
          <span className="inline-flex items-center gap-1">
            <Calendar size={12} strokeWidth={1.8} />
            {dateText}
          </span>
        )}
      </div>
    </div>
  );
}
