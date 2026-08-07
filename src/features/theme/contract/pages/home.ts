import type { PostItem } from "@/features/posts/schema/posts.schema";

/**
 * 首页分类标签配置项（对应后台 mytheme 设置面板里的"首页分类"区块）。
 * 一项一个分类标签。`posts` 在首页 loader 里由前端按 categoryId + postLimit 拉取。
 */
export interface HomeCategoryTabConfig {
  /** 关联的分类 id */
  categoryId: number;
  /** 自定义显示名（不填时使用该分类在后台的"name"） */
  label?: string;
  /** 该 tab 最多显示多少篇文章 */
  postLimit: number;
  /** 该 tab 下要展示的已发布文章（服务端按 publishedAt 倒序取前 postLimit 篇） */
  posts: Array<PostItem>;
  /** 分辨率展示时使用的 display 名（后台 label 优先，否则用分类本身名字） */
  displayName: string;
}

export interface HomePageProps {
  posts: Array<PostItem>;
  pinnedPosts?: Array<PostItem>;
  popularPosts?: Array<PostItem>;
  /** 首页"最新发布"最多显示的卡片数量（后台 recentPostsLimit 设置） */
  recentPostsLimit?: number;
  /**
   * 首页分类展示样式：
   * - "tabs"：标签切换式（默认），顶部一排 tab 选一个分类显示
   * - "stacked"：垂直堆叠式，最新发布 + 各分类依次向下堆叠成多个区块
   */
  homeCategoryStyle?: "tabs" | "stacked";
  /**
   * 首页分类标签配置（后台 mytheme 设置 - "首页分类"）。
   * 数组顺序即 tab 顺序；空数组时首页只显示"最新发布"一个 tab。
   */
  categoryTabs?: Array<HomeCategoryTabConfig>;
}
