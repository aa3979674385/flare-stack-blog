import type { PostItem } from "@/features/posts/schema/posts.schema";
import type {
  PostSortDirection,
  PostSortField,
} from "@/features/posts/schema/posts.schema";
import type { TagWithCount } from "@/features/tags/tags.schema";

export interface PostsPageProps {
  posts: Array<PostItem>;
  tags: Array<Omit<TagWithCount, "createdAt">>;
  selectedTag?: string;
  onTagClick: (tag?: string) => void;
  page: number;
  totalPages: number;
  /** 文章总数（可选，用于显示「第 X–Y 篇 / 共 N 篇」） */
  totalCount?: number;
  onPageChange: (page: number) => void;
  /** 当前排序字段（可选，由支持排序的主题使用） */
  sortBy?: PostSortField;
  /** 当前排序方向（可选） */
  sortDir?: PostSortDirection;
  /** 切换排序时的回调（可选） */
  onSortChange?: (sortBy: PostSortField, sortDir: PostSortDirection) => void;
  /** 当前选中的分类名称（可选，用于分类页头部） */
  categoryName?: string;
  /** 当前是否为未分类视图（可选） */
  uncategorized?: boolean;
}
