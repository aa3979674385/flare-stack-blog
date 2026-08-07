import { sql } from "drizzle-orm";
import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { createdAt, updatedAt } from "./helper";
import { PostsTable } from "./posts.table";

/** 单条网盘链接：支持百度网盘 / 夸克 / 阿里云盘 / 其他，可带提取码（密码）。 */
export interface ResourceLink {
  /** 网盘类型，自由文本，如「百度网盘」「夸克网盘」「阿里云盘」 */
  type: string;
  /** 链接地址 */
  url: string;
  /** 提取码 / 密码，可空 */
  password?: string | null;
}

/**
 * 文章下载资源（下载框）。
 * - accessType：free=免费，member=会员专享（会员免费看，非会员不可见），paid=收费（需购买/积分兑换）。
 * - priceType：points=普通积分，credits=会员积分（系统为双积分制，资源可指定用哪种积分支付）。
 * - priceAmount：积分数量（整数）。
 * - memberAccess：会员权益。none=会员同价；free=会员免费（非会员按基础价）；discount=会员按折扣（1=1折…10=不打折）；required=仅会员可购买（非会员不可见）。
 * - memberDiscount：会员折扣系数（1-10），仅当 memberAccess=discount 时生效。
 * - extractCode：解压码（压缩包密码）。原「说明」字段改造而来，存资源压缩包的解压密码，前台展示为「解压码」。
 * - hideCodeWhenPaid：是否「收费时隐藏解压码」。true 时，若该资源为收费(paid)且用户尚未解锁，则解压码不展示、接口也不下发（与收费内容同等保密）。
 * - links：网盘链接数组（JSON）。
 */
export const postResource = sqliteTable(
  "post_resource",
  {
    id: text("id").primaryKey(),
    postId: integer("post_id")
      .notNull()
      .references(() => PostsTable.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    extractCode: text("extract_code"),
    hideCodeWhenPaid: integer("hide_code_when_paid").notNull().default(0),
    links: text("links", { mode: "json" }).$type<ResourceLink[]>().notNull(),
    accessType: text("access_type", { enum: ["free", "member", "paid"] })
      .notNull()
      .default("free"),
    priceType: text("price_type", { enum: ["points", "credits"] })
      .notNull()
      .default("points"),
    priceAmount: integer("price_amount").notNull().default(0),
    memberAccess: text("member_access", {
      enum: ["none", "free", "required", "discount"],
    })
      .notNull()
      .default("none"),
    memberDiscount: integer("member_discount").notNull().default(10),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: createdAt,
    updatedAt: updatedAt,
  },
  (table) => [index("post_resource_post_idx").on(table.postId, table.sortOrder)],
);

/**
 * 资源购买 / 解锁记录。
 * - status：paid=已支付（积分已扣或人民币已付），pending=待支付（人民币占位，未接网关），free=会员免费解锁。
 */
export const postResourceOrder = sqliteTable(
  "post_resource_order",
  {
    id: text("id").primaryKey(),
    orderNo: text("order_no"),
    resourceId: text("resource_id")
      .notNull()
      .references(() => postResource.id, { onDelete: "cascade" }),
    userId: text("user_id").notNull(),
    priceType: text("price_type", { enum: ["points", "credits", "rmb"] }),
    amount: integer("amount"),
    status: text("status", { enum: ["paid", "pending", "free"] })
      .notNull()
      .default("paid"),
    createdAt: createdAt,
  },
  (table) => [
    index("post_resource_order_resource_idx").on(
      table.resourceId,
      table.userId,
    ),
    index("post_resource_order_user_idx").on(table.userId),
    index("post_resource_order_no_idx").on(table.orderNo),
  ],
);

/**
 * 附件下载记录（仅记录「本地附件」的实际下载行为，用于审计与统计）。
 * - orderId：若该下载对应一笔购买订单，则关联 post_resource_order.id（可空，免费/会员资源下载时为 null）。
 * - resourceId / userId / fileUrl / fileName：记录下载了哪个资源的哪个文件。
 */
export const postResourceDownload = sqliteTable(
  "post_resource_download",
  {
    id: text("id").primaryKey(),
    orderId: text("order_id"),
    resourceId: text("resource_id")
      .notNull()
      .references(() => postResource.id, { onDelete: "cascade" }),
    userId: text("user_id").notNull(),
    fileUrl: text("file_url").notNull(),
    fileName: text("file_name"),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`),
  },
  (table) => [
    index("post_resource_download_resource_idx").on(
      table.resourceId,
      table.userId,
    ),
    index("post_resource_download_user_idx").on(table.userId),
  ],
);

export type PostResource = typeof postResource.$inferSelect;
export type NewPostResource = typeof postResource.$inferInsert;
export type PostResourceOrder = typeof postResourceOrder.$inferSelect;
export type PostResourceDownload = typeof postResourceDownload.$inferSelect;
