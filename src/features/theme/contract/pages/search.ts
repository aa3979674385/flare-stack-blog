export interface SearchResultItem {
  post: {
    id: string;
    slug: string;
    title: string;
    summary: string | null;
    tags: Array<string>;
    /** 封面图 URL（可能为空，卡片需兜底显示占位图） */
    cover?: string | null;
    /** 收费状态：free=免费 / member=会员专享 / paid=收费 */
    accessType?: "free" | "member" | "paid" | null;
    /** 分类名（取第一个分类） */
    categoryName?: string | null;
    /** 分类 id（取第一个分类），用于卡片分类药丸跳转 */
    categoryId?: number | null;
    /** 发布时间（经 JSON 序列化后可能为字符串） */
    publishedAt?: string | Date | null;
  };
  score: number;
  matches: {
    title: string | null;
    summary: string | null;
  };
}

export interface SearchPageProps {
  query: string;
  results: Array<SearchResultItem>;
  isSearching: boolean;
  onQueryChange: (query: string) => void;
  onSelectPost: (post: { id: string | number; slug: string }) => void;
  onBack: () => void;
}
