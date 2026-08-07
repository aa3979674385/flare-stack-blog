import { Hono } from "hono";
import { eq } from "drizzle-orm";
import { getAuth } from "@/lib/auth/auth.server";
import { getDb } from "@/lib/db";
import { user } from "@/lib/db/schema";
import * as PostResourcesData from "@/features/post-resources/data/post-resources.data";

/**
 * 下载中转路由：/dl/:resourceId/:linkIdx
 *
 * 前台外链（网盘等）按钮只展示本站路径 /dl/...，点击后由本路由在服务端：
 *   1. 校验登录与访问权限（会员 / 已购 / 免费）；
 *   2. 记录一次下载（下载日志落在服务端，真实链接不进入前端）；
 *   3. 302 跳转到真实网盘链接。
 * 这样前端代码 / 审查元素 / 接口 JSON 里都不再出现真实网盘地址。
 */
export const resourceDownloadRedirectRoute = new Hono<{ Bindings: Env }>();

resourceDownloadRedirectRoute.get("/:resourceId/:linkIdx", async (c) => {
  const db = getDb(c.env);
  const auth = await getAuth({ db, env: c.env });
  const session = await auth.api.getSession({ headers: c.req.raw.headers });

  // 未登录：引导去登录页（登录后重新点击按钮即可）
  if (!session?.user) {
    return c.redirect("/login", 302);
  }

  const resourceId = c.req.param("resourceId");
  const linkIdx = Number(c.req.param("linkIdx"));
  if (!resourceId || !Number.isInteger(linkIdx) || linkIdx < 0) {
    return c.text("Bad Request", 400);
  }

  const resource = await PostResourcesData.getResourceById(db, resourceId);
  if (!resource) return c.text("Not Found", 404);

  const links = resource.links;
  if (!Array.isArray(links) || linkIdx >= links.length) {
    return c.text("Not Found", 404);
  }
  const link = links[linkIdx];

  // 校验访问权限（会员专享 / 已购解锁 / 免费）
  const u = await db.query.user.findFirst({
    where: eq(user.id, session.user.id),
    columns: { membershipPlanId: true, membershipExpiresAt: true },
  });
  const isMember = PostResourcesData.isUserMember(u);
  const order = await PostResourcesData.getOrder(db, session.user.id, resourceId);
  const access = PostResourcesData.computeAccess(resource, {
    isMember,
    orderStatus: order?.status ?? null,
    pointsPerYuan: 10,
  });
  if (!access.accessible) {
    return c.text("无权限访问该资源", 403);
  }

  const target = link.url;
  // 仅允许 http(s) 外链或本站相对路径，避免开放重定向
  const isSafe = /^https?:\/\//i.test(target) || target.startsWith("/");
  if (!isSafe) {
    return c.text("Forbidden", 403);
  }

  // 记录一次下载（服务端子写，真实链接不进前端）
  // 若达到每日下载上限，logResourceDownload 会抛错，这里拦截并返回提示，不跳转。
  try {
    await PostResourcesData.logResourceDownload(db, {
      orderId: order?.id ?? null,
      resourceId,
      userId: session.user.id,
      fileUrl: target,
      fileName: link.type,
    });
  } catch (e) {
    return c.text(e instanceof Error ? e.message : "今日下载次数已达上限", 403);
  }

  // 不缓存这个重定向，避免跨用户串号 / 缓存真实地址
  c.header("Cache-Control", "no-store, private");
  return c.redirect(target, 302);
});
