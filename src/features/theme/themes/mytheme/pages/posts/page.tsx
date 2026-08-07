import type { ChangeEvent } from "react";
import type { PostsPageProps } from "@/features/theme/contract/pages";
import type {
  PostSortDirection,
  PostSortField,
} from "@/features/posts/schema/posts.schema";
import { Folder } from "lucide-react";
import { m } from "@/paraglide/messages";
import { Pagination } from "@/features/theme/components/pagination";
import { GridPostCard } from "../../components/grid-post-card";

/** 排序选项（与后端 POST_SORT_FIELDS 对应） */
const SORT_OPTIONS: Array<{
  value: string;
  label: string;
  sortBy: PostSortField;
  sortDir: PostSortDirection;
}> = [
  { value: "publishedAt:desc", label: "最新发布", sortBy: "publishedAt", sortDir: "desc" },
  { value: "updatedAt:desc", label: "最近更新", sortBy: "updatedAt", sortDir: "desc" },
  { value: "publishedAt:asc", label: "最早发布", sortBy: "publishedAt", sortDir: "asc" },
  { value: "title:asc", label: "标题 A→Z", sortBy: "title", sortDir: "asc" },
];

export function PostsPage({
  posts,
  page,
  totalPages,
  totalCount = 0,
  onPageChange,
  sortBy = "publishedAt",
  sortDir = "desc",
  onSortChange,
  categoryName,
  selectedTag,
  uncategorized,
}: PostsPageProps) {
  const currentSortValue = `${sortBy}:${sortDir}`;

  // 头部标题：分类名 > 标签 > 未分类 > 全部文章
  const listTitle = categoryName
    ? categoryName
    : selectedTag
      ? `标签：${selectedTag}`
      : uncategorized
        ? "未分类"
        : "全部文章";

  const handleSortChange = (e: ChangeEvent<HTMLSelectElement>) => {
    const opt = SORT_OPTIONS.find((o) => o.value === e.target.value);
    if (opt && onSortChange) {
      onSortChange(opt.sortBy, opt.sortDir);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      {/* 标题横栏：图标 + 分类名 + · + 共 N 篇 + 排序（合并为一行） */}
      <div className="flex flex-wrap items-center gap-3 rounded-2xl bg-(--fuwari-card-bg) px-5 py-4">
        <Folder className="shrink-0 text-(--fuwari-primary)" size={22} />
        <h1 className="text-lg font-semibold text-(--fuwari-title)">
          {listTitle}
        </h1>
        <span className="text-(--fuwari-meta)">·</span>
        <span className="text-sm text-(--fuwari-meta)">共 {totalCount} 篇</span>
        <label className="ml-auto flex items-center gap-2 text-sm text-(--fuwari-meta)">
          排序
          <select
            value={currentSortValue}
            onChange={handleSortChange}
            className="fuwari-card-base cursor-pointer rounded-lg px-3 py-1.5 text-sm text-(--fuwari-title) outline-none transition hover:border-(--fuwari-primary)"
          >
            {SORT_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      {posts.length > 0 ? (
        <>
          {/* 文章网格卡片排列（与首页一致） */}
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-4">
            {posts.map((post) => (
              <GridPostCard key={post.slug} post={post} />
            ))}
          </div>
          <Pagination
            currentPage={page}
            totalPages={totalPages}
            onPageChange={onPageChange}
          />
        </>
      ) : (
        <div className="fuwari-card-base w-full px-8 py-12 text-center text-sm fuwari-text-50">
          {m.posts_no_posts()}
        </div>
      )}
    </div>
  );
}
