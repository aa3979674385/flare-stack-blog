/**
 * 主题契约 — 布局 Props 接口
 */

export interface NavOption {
  id: string;
  label: string;
  /** 内部路由路径（如 /posts），与外部链接二选一 */
  to?: string;
  /** 内部路由的 search 参数（如 { tagName: "技术" }） */
  search?: Record<string, string | undefined>;
  /** 外部链接完整 URL（设置此项则用 <a target="_blank"> 渲染，忽略 to/search） */
  href?: string;
  /** 是否为外部链接 */
  external?: boolean;
  /** 同级排序权重（小在前） */
  sortOrder?: number;
  /** 子菜单项（二级目录）；存在时前台以下拉/缩进形式展示 */
  children?: Array<NavOption>;
}

export interface UserInfo {
  name: string;
  image?: string | null;
  role?: string | null;
}

export interface PublicLayoutProps {
  children: React.ReactNode;
  navOptions: Array<NavOption>;
  user?: UserInfo;
  isSessionLoading: boolean;
  logout: () => Promise<void>;
}

export interface AuthLayoutProps {
  onBack: () => void;
  children: React.ReactNode;
}

export interface UserLayoutProps {
  isAuthenticated: boolean;
  navOptions: Array<NavOption>;
  user?: UserInfo;
  isSessionLoading: boolean;
  logout: () => Promise<void>;
  children: React.ReactNode;
}
