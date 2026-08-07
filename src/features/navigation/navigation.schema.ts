import { z } from "zod";

/**
 * 导航菜单项：首页(home) / 自定义链接(link) / 分类(category)
 * 分类为「真实独立分类」（categories 表），菜单项通过 target 关联分类 id。
 */
export const navMenuItemSchema = z.object({
  id: z.string().min(1).max(64),
  label: z.string().min(1).max(50),
  type: z.enum(["home", "link", "category"]),
  /** home: 忽略; link: 完整 URL(支持内外部); category: 关联的真实分类 id(字符串) */
  target: z.string().max(500),
  enabled: z.boolean(),
  sortOrder: z.number().int(),
  /** 上级菜单 id（形成二级目录）；null/空表示顶级菜单。最大嵌套深度限制为 2 级。 */
  parentId: z.string().max(64).nullable().optional(),
});
export type NavMenuItem = z.infer<typeof navMenuItemSchema>;

/**
 * 系统默认导航：仅一个不可删除的「首页」，链接锁定为 /
 * 注意：未分类不再作为导航项 —— 它是分类体系内的兜底（无分类的文章自动归入），
 *       由文章列表页 /?uncategorized=true 访问，详见分类管理页。
 */
export const DEFAULT_HOME_NAV_ITEM: NavMenuItem = {
  id: "home",
  label: "首页",
  type: "home",
  target: "",
  enabled: true,
  sortOrder: 0,
  parentId: null,
};
