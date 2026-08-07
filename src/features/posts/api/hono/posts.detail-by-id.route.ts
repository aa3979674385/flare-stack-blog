import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { z } from "zod";
import * as PostService from "@/features/posts/services/posts.service";
import { getServiceContext, setCacheHeaders } from "@/lib/hono/helper";
import { baseMiddleware } from "@/lib/hono/middlewares";
import { generateTableOfContents } from "@/features/posts/utils/toc";

const app = new Hono<{ Bindings: Env }>();

app.use("*", baseMiddleware);

// 公开「按 id 取文章」端点，与 /api/post/:slug 对齐：匿名可读、仅已发布文章。
// 详情页 id 模式（/post/{id}.html）的客户端查询走这里，避免走需登录的 admin serverFn（post.view）。
const route = app.get(
  "/:id",
  zValidator("param", z.object({ id: z.coerce.number() })),
  async (c) => {
    const { id } = c.req.valid("param");
    const post = await PostService.findPostById(getServiceContext(c), { id });
    if (!post || post.status !== "published") {
      return c.json({ error: "not found" }, 404);
    }
    setCacheHeaders(c.res.headers, "public");
    return c.json({
      ...post,
      toc: generateTableOfContents(post.contentJson),
    });
  },
);

export default route;
