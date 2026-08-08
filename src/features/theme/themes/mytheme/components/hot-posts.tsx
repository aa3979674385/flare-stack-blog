import { ClientOnly, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Flame, Clock } from "lucide-react";
import { popularPostsQuery } from "@/features/posts/queries";
import { cn, formatDate } from "@/lib/utils";
import { postSegment } from "@/lib/post-url";

/** 数字排名配色：1 红、2 橙、3 绿、4 灰、5 浅灰蓝 */
const RANK_ACCENT = [
  "text-rose-500",
  "text-orange-500",
  "text-emerald-500",
  "text-slate-400",
  "text-sky-400",
];

/** 粗略相对时间：把日期转为"X天/月前" */
function timeAgo(date: Date | string | number | null | undefined): string {
  if (!date) return "";
  const d = new Date(date);
  const diff = Date.now() - d.getTime();
  const days = Math.floor(diff / 86400000);
  if (days < 1) return "今天";
  if (days < 30) return `${days}天前`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}个月前`;
  return `${Math.floor(months / 12)}年前`;
}

export function HotPosts() {
  const { data: posts } = useQuery(popularPostsQuery(5));

  if (!posts || posts.length === 0) return null;

  const top1 = posts[0];
  const rest = posts.slice(1, 5);

  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-black/5 dark:border-white/10 overflow-hidden">
      {/* ── 标题栏（带火苗图标 + 分隔线）── */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-black/5 dark:border-white/10">
        <span className="inline-flex items-center justify-center w-6 h-6 rounded-md bg-gradient-to-br from-rose-500 to-orange-500 text-white">
          <Flame size={14} strokeWidth={2.5} />
        </span>
        <h3 className="text-sm font-bold text-foreground tracking-wide">
          热门文章
        </h3>
        <span className="ml-auto text-[10px] text-muted-foreground font-normal">
          本周热榜
        </span>
      </div>

      <div className="p-3 flex flex-col gap-3">
        {/* ── TOP1 大卡片（封面满铺 + 底部通透渐变）── */}
        <Link
          to="/post/$slug"
          params={{ slug: postSegment(top1) }}
          className="relative block overflow-hidden rounded-lg h-40 group shadow-sm"
        >
          {top1.coverImage ? (
            <img
              src={top1.coverImage}
              alt={top1.title}
              className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
            />
          ) : (
            <div className="absolute inset-0 bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500" />
          )}
          {/* 仅底部渐变遮罩，让图片更通透 */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/25 to-transparent" />

          <div className="relative z-10 flex flex-col justify-end h-full p-3 gap-1.5">
            {/* 玻璃质感 TOP1 徽章 */}
            <div className="flex items-center">
              <span className="inline-flex items-center text-[10px] font-bold tracking-wider text-white bg-white/20 backdrop-blur-sm border border-white/30 px-2 py-0.5 rounded">
                TOP 1
              </span>
            </div>
            <p className="text-white text-[14px] font-bold leading-snug line-clamp-2 drop-shadow-sm">
              {top1.title}
            </p>
          </div>
        </Link>

        {/* ── TOP2 ~ TOP5 列表行 ── */}
        <div className="flex flex-col">
          {rest.map((post, i) => {
            const rank = i + 2; // 2,3,4,5
            return (
              <Link
                key={post.id}
                to="/post/$slug"
                params={{ slug: postSegment(post) }}
                className="group flex items-center gap-3 py-2.5 px-1 -mx-1 rounded-lg hover:bg-black/[0.03] dark:hover:bg-white/[0.04] transition-colors"
              >
                {/* 缩略图（固定 56×56） */}
                <div className="shrink-0 w-14 h-14 rounded-md overflow-hidden bg-black/5 dark:bg-white/5">
                  {post.coverImage ? (
                    <img
                      src={post.coverImage}
                      alt={post.title}
                      className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-110"
                    />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-br from-slate-200 to-slate-300 dark:from-slate-700 dark:to-slate-800" />
                  )}
                </div>

                {/* 标题 + 元信息 */}
                <div className="flex-1 min-w-0 flex flex-col justify-center gap-1">
                  <p className="text-[13px] font-medium leading-snug line-clamp-2 text-foreground group-hover:text-primary transition-colors">
                    {post.title}
                  </p>
                  <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
                    <Clock size={10} />
                    <ClientOnly
                      fallback={<span>{formatDate(post.publishedAt)}</span>}
                    >
                      <span>{timeAgo(post.publishedAt)}</span>
                    </ClientOnly>
                  </div>
                </div>

                {/* 大号排名数字（最右侧） */}
                <span
                  className={cn(
                    "ml-auto shrink-0 w-5 text-right text-lg font-black leading-none tabular-nums",
                    RANK_ACCENT[i],
                  )}
                >
                  {rank}
                </span>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
