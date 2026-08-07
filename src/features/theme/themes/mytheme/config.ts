import type { ThemeConfig } from "@/features/theme/contract/config";

export const config: ThemeConfig = {
  home: {
    recentPostsLimit: 24,
    popularPostsLimit: 3,
  },
  posts: {
    postsPerPage: 20,
  },
  post: {
    relatedPostsLimit: 4,
  },
};
