/**
 * 文章 URL 格式中枢。
 *
 * 后台「站点设置」里可切换文章链接的形态：
 *  - "none" → /post/{slug}
 *  - "html" → /post/{slug}.html
 *  - "id"   → /post/{id}.html
 *
 * 路由对 /post/$slug 做解析时会把末尾的 .html 剥掉，所以三种 URL 都能打开同一篇文章
 * （旧链接 / 已收录页面不会 404）。切换开关 = 全站文章链接一起变。
 *
 * 模块级单例在 __root.tsx 的 beforeLoad（服务端 + 客户端渲染子路由前都会跑）里被写入，
 * 因此 <Link> 生成 href 与路由解析时都能同步读到当前模式。
 */

export type PostUrlMode = "none" | "html" | "id";

let currentMode: PostUrlMode = "html";

export function setPostUrlSuffix(mode: PostUrlMode): void {
  currentMode = mode;
}

export function getPostUrlSuffix(): PostUrlMode {
  return currentMode;
}

export type PostRef = { id?: number | string | null; slug: string };

/**
 * 把文章 id 统一规整成正整数（兼容 number / 字符串数字 / 空值）。
 * 搜索结果、会员中心等场景拿到的 id 可能是字符串，需要归一化后才能在 id 模式下正确拼 URL。
 */
function toNumericId(id: PostRef["id"]): number | null {
  if (id === null || id === undefined || id === "") return null;
  const n = Number(id);
  return Number.isInteger(n) && n > 0 ? n : null;
}

/**
 * 返回放进路由 $slug 参数里的「段落」：
 *  - none → my-slug
 *  - html → my-slug.html
 *  - id   → 123.html（id 无效 / 缺失时回退到 slug）
 * <Link to="/post/$slug" params={{ slug: postSegment(post) }}> 即可生成正确 href。
 */
export function postSegment(post: PostRef): string {
  const slug = encodeURIComponent(post.slug || "");
  const idNum = toNumericId(post.id);
  if (currentMode === "id") {
    if (idNum !== null) return `${idNum}.html`;
    return slug;
  }
  if (currentMode === "html") return `${slug}.html`;
  return slug;
}

/**
 * 返回完整文章路径（含前导 /post/），用于 sitemap / RSS / 评论通知 / canonical 等字符串拼接场景。
 */
export function postPath(post: PostRef): string {
  const slug = encodeURIComponent(post.slug || "");
  const idNum = toNumericId(post.id);
  if (currentMode === "id") {
    if (idNum !== null) return `/post/${idNum}.html`;
    return `/post/${slug}`;
  }
  if (currentMode === "html") return `/post/${slug}.html`;
  return `/post/${slug}`;
}
