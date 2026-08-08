import { ClientOnly, Link } from "@tanstack/react-router";
import { Calendar, Folder, Tag } from "lucide-react";
import type { PostItem } from "@/features/posts/schema/posts.schema";
import { cn, formatDate } from "@/lib/utils";
import { m } from "@/paraglide/messages";

interface PostMetaProps {
  post: PostItem;
  className?: string;
}

export function PostMeta({ post, className }: PostMetaProps) {
  const published = post.publishedAt;

  return (
    <div
      className={cn(
        "flex flex-wrap text-black/50 dark:text-white/40 items-center gap-4 gap-x-4 gap-y-2",
        className,
      )}
    >
      {/* Publish date */}
      <div className="flex items-center">
        <div className="fuwari-meta-icon">
          <Calendar strokeWidth={1.5} size={20} />
        </div>
        <span className="text-sm font-medium fuwari-text-50">
          <ClientOnly fallback="-">{formatDate(published)}</ClientOnly>
        </span>
      </div>

      {/* Category */}
      {post.categories && post.categories.length > 0 && (
        <div className="flex items-center">
          <div className="fuwari-meta-icon">
            <Folder strokeWidth={1.5} size={20} />
          </div>
          <div className="flex flex-row flex-nowrap items-center gap-x-1.5">
            {post.categories.map((cat, i) => (
              <span key={cat.id} className="flex items-center">
                {i > 0 && (
                  <span className="mx-1.5 text-(--fuwari-meta-divider) text-sm">
                    /
                  </span>
                )}
                <Link
                  to="/posts"
                  search={{ categoryId: cat.id }}
                  className="transition fuwari-text-50 text-sm font-medium hover:text-(--fuwari-primary) whitespace-nowrap"
                >
                  {cat.name}
                </Link>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Tags */}
      <div className="flex items-center">
        <div className="fuwari-meta-icon">
          <Tag strokeWidth={1.5} size={20} />
        </div>
        <div className="flex flex-row flex-nowrap items-center gap-x-1.5">
          {post.tags && post.tags.length > 0 ? (
            post.tags.map((tag, i) => (
              <span key={tag.name} className="flex items-center">
                {i > 0 && (
                  <span className="mx-1.5 text-(--fuwari-meta-divider) text-sm">
                    /
                  </span>
                )}
                <Link
                  to="/posts"
                  search={{ tagName: tag.name }}
                  className="transition fuwari-text-50 text-sm font-medium hover:text-(--fuwari-primary) whitespace-nowrap"
                >
                  {tag.name}
                </Link>
              </span>
            ))
          ) : (
            <span className="transition fuwari-text-50 text-sm font-medium">
              {m.post_no_tags()}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
