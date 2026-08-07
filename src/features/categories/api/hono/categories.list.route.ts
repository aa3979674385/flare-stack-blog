import { Hono } from "hono";
import * as CategoryService from "@/features/categories/categories.service";
import { getServiceContext, setCacheHeaders } from "@/lib/hono/helper";
import { baseMiddleware } from "@/lib/hono/middlewares";

const app = new Hono<{ Bindings: Env }>();

app.use("*", baseMiddleware);

const route = app.get("/", async (c) => {
  const result = await CategoryService.getPublicCategories(getServiceContext(c));
  setCacheHeaders(c.res.headers, "public");
  return c.json(result);
});

export default route;
