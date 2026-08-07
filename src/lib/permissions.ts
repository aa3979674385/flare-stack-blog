/**
 * 后台管理员「细粒度权限」注册表与判定助手。
 *
 * 设计要点（可扩展）：
 * - 所有权限都登记在 PERMISSIONS 中，新增权限只需在此追加一条，
 *   并在对应后台 server fn 用 requirePermission("xxx") 守卫即可。
 * - user.permissions 存储为 JSON 数组字符串；null/未设置 表示「超级管理员」，
 *   拥有当前+未来所有权限（向后兼容：老管理员无该列即视为超级管理员，不会锁死）。
 * - permissions 为空数组 [] 表示「受限管理员但当前无任何权限」。
 */

export interface PermissionDef {
  key: string;
  label: string;
  category: string;
}

export interface PermissionCategory {
  key: string;
  label: string;
}

export const PERMISSION_CATEGORIES: PermissionCategory[] = [
  { key: "dashboard", label: "仪表盘" },
  { key: "content", label: "内容管理" },
  { key: "community", label: "社区管理" },
  { key: "users", label: "用户与权限" },
  { key: "system", label: "系统设置" },
];

export const PERMISSIONS: PermissionDef[] = [
  { key: "dashboard.view", label: "查看仪表盘", category: "dashboard" },

  { key: "post.view", label: "查看 / 列表文章", category: "content" },
  { key: "post.create", label: "创建与发布文章", category: "content" },
  { key: "post.manage", label: "编辑 / 删除文章", category: "content" },
  { key: "tag.manage", label: "标签管理", category: "content" },
  { key: "media.manage", label: "媒体资源管理", category: "content" },

  { key: "comment.manage", label: "评论管理", category: "community" },
  { key: "link.manage", label: "友链管理", category: "community" },

  { key: "user.manage", label: "用户与权限管理", category: "users" },
  { key: "points.view", label: "查看积分动态", category: "users" },
  { key: "membership.manage", label: "会员套餐管理", category: "users" },
  { key: "cardkey.manage", label: "卡密管理", category: "users" },

  { key: "config.manage", label: "站点配置", category: "system" },
  { key: "log.view", label: "查看操作日志", category: "system" },
  { key: "cache.manage", label: "缓存管理", category: "system" },
  { key: "import.manage", label: "数据导入导出", category: "system" },
  { key: "email.manage", label: "邮件 / SMTP 设置", category: "system" },
  { key: "oauth.manage", label: "OAuth 应用管理", category: "system" },
];

export const ALL_PERMISSION_KEYS: string[] = PERMISSIONS.map((p) => p.key);

/**
 * 权限蕴含关系：拥有某权限即隐式拥有其依赖的权限。
 * 例：能"创建/编辑文章"必然应能"查看文章列表"，否则菜单进了也加载不出数据。
 * 仅在此声明依赖，无需改动各 server fn（hasPermission 已统一处理）。
 */
export const PERMISSION_IMPLIES: Record<string, string[]> = {
  "post.create": ["post.view"],
  "post.manage": ["post.view"],
};

export interface PermissionSubject {
  role?: string | null;
  permissions?: unknown;
}

/** 将 db/session 中的 permissions 规范化：字符串(JSON) / 数组 / null */
function normalizePermissions(input: unknown): string[] | null {
  if (input == null) return null;
  if (Array.isArray(input)) return input as string[];
  if (typeof input === "string") {
    try {
      const parsed = JSON.parse(input);
      return Array.isArray(parsed) ? (parsed as string[]) : [];
    } catch {
      return [];
    }
  }
  return [];
}

/** 是否为超级管理员（拥有全部权限）：role=admin 且未显式限定权限 */
export function isSuperAdmin(
  subject: PermissionSubject | null | undefined,
): boolean {
  if (!subject || subject.role !== "admin") return false;
  return normalizePermissions(subject.permissions) === null;
}

/** 校验某主体是否拥有指定权限（超级管理员始终为 true） */
export function hasPermission(
  subject: PermissionSubject | null | undefined,
  key: string,
): boolean {
  if (!subject || subject.role !== "admin") return false;
  const perms = normalizePermissions(subject.permissions);
  if (perms === null) return true;
  if (perms.includes(key)) return true;
  // 检查蕴含关系：已授予的权限是否隐式包含目标权限
  for (const p of perms) {
    const implied = PERMISSION_IMPLIES[p];
    if (implied && implied.includes(key)) return true;
  }
  return false;
}

/** 返回某主体实际拥有的权限键列表（超级管理员返回全部） */
export function effectivePermissions(
  subject: PermissionSubject | null | undefined,
): string[] {
  if (!subject || subject.role !== "admin") return [];
  const perms = normalizePermissions(subject.permissions);
  if (perms === null) return [...ALL_PERMISSION_KEYS];
  return perms;
}

export function getPermissionDef(key: string): PermissionDef | undefined {
  return PERMISSIONS.find((p) => p.key === key);
}
