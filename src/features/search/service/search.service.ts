import { insert, search as oramaSearch, remove } from "@orama/orama";
import { and, eq, inArray, lte } from "drizzle-orm";
import { convertToPlainText } from "@/features/posts/utils/content";
import { createMyDb, type MyOramaDB } from "@/features/search/model/schema";
import {
  getOramaDb,
  getOramaMeta,
  persistOramaDb,
} from "@/features/search/model/store";
import {
  CONTENT_SLICE,
  SNIPPET_SLICE,
} from "@/features/search/search.constants";
import type {
  DeleteSearchDocInput,
  SearchQueryInput,
  UpsertSearchDocInput,
} from "@/features/search/search.schema";
import {
  buildSnippet,
  getMatchedTerms,
} from "@/features/search/utils/search.utils";
import { getDb } from "@/lib/db";
import {
  CategoriesTable,
  PostCategoriesTable,
  PostsTable,
} from "@/lib/db/schema";
import { postResource } from "@/lib/db/schema/post-resources.table";

type SearchMetaDb = Awaited<ReturnType<typeof getDb>>;

/** 读取搜索卡片所需的元信息：收费状态 / 分类名 / 发布时间（均不进分词索引） */
async function fetchPostSearchMeta(db: SearchMetaDb, postId: number) {
  const [resource] = await db
    .select({ accessType: postResource.accessType })
    .from(postResource)
    .where(eq(postResource.postId, postId))
    .limit(1);

  const catRows = await db
    .select({
      id: CategoriesTable.id,
      name: CategoriesTable.name,
    })
    .from(PostCategoriesTable)
    .innerJoin(
      CategoriesTable,
      eq(PostCategoriesTable.categoryId, CategoriesTable.id),
    )
    .where(eq(PostCategoriesTable.postId, postId))
    .limit(1);

  const [postRow] = await db
    .select({ publishedAt: PostsTable.publishedAt })
    .from(PostsTable)
    .where(eq(PostsTable.id, postId))
    .limit(1);

  return {
    accessType: (resource?.accessType ?? "free") as "free" | "member" | "paid",
    categoryId: (catRows[0]?.id ?? null) as number | null,
    categoryName: (catRows[0]?.name ?? null) as string | null,
    publishedAt: postRow?.publishedAt ?? null,
  };
}

export async function search(
  context: DbContext,
  data: SearchQueryInput,
  waitUntil?: (p: Promise<unknown>) => void,
) {
  const db = await getOramaDb(context.env, waitUntil);
  const result = await oramaSearch(db, {
    term: data.q,
    // 仅检索标题字段
    properties: ["title"],
    // 说明：标题按「字符」建索引（见 schema.ts），单字符无前缀概念，
    // 且 Orama v3 的 SearchParams 并无 prefix 选项；真正的子串语义
    // 由下方 includes() 后过滤保证，这里只负责多召回候选。
    limit: 200,
  });

  const query = data.q.toLowerCase();
  return (
    result.hits
      // 子串包含匹配：标题里出现完整查询串即命中
      // （测 / 测试 / 测试文 / 测试文章 全部命中；标题不含查询串的被过滤掉）
      .filter((hit) =>
        String(hit.document.title ?? "")
          .toLowerCase()
          .includes(query),
      )
      .slice(0, Math.min(data.limit, 25))
      .map((hit) => {
        const { document, score } = hit;
        // summary/tags 已从分词索引移除（仅标题参与检索），
        // 但随文档存储用于结果展示，故以类型断言读取
        const doc = document as {
          summary?: string;
          tags?: string[];
        };
        const titleHighlight = buildSnippet({
          text: document.title,
          terms: getMatchedTerms(hit, "title"),
          fallbackTerm: data.q,
        });
        const summaryHighlight = buildSnippet({
          text: doc.summary ?? "",
          terms: getMatchedTerms(hit, "summary"),
          fallbackTerm: data.q,
        });

        return {
          post: {
            id: document.id,
            slug: document.slug,
            title: document.title,
            summary: doc.summary ?? "",
            tags: doc.tags ?? [],
            // 以下均为非 schema 字段，仅存储、不进分词索引
            cover: (document as { cover?: string }).cover ?? null,
            accessType:
              (document as { accessType?: "free" | "member" | "paid" | null })
                .accessType ?? null,
            categoryName:
              (document as { categoryName?: string | null }).categoryName ??
              null,
            categoryId:
              (document as { categoryId?: number | null }).categoryId ?? null,
            publishedAt:
              (document as { publishedAt?: string | Date | null })
                .publishedAt ?? null,
          },
          score,
          matches: {
            title: titleHighlight,
            summary: summaryHighlight,
          },
        };
      })
  );
}

export async function upsert(
  context: { env: Env },
  data: UpsertSearchDocInput,
) {
  const db = await getOramaDb(context.env);

  try {
    await remove(db, data.id.toString());
  } catch {}

  const plain = convertToPlainText(data.contentJson ?? null);
  const content =
    plain.length > CONTENT_SLICE ? plain.slice(0, CONTENT_SLICE) : plain;
  const summary =
    data.summary && data.summary.trim().length > 0
      ? data.summary
      : content.slice(0, SNIPPET_SLICE);

  // 收费状态 / 分类 / 发布时间：优先用入参，缺失时回源查询（保证卡片信息准确）
  let meta: Awaited<ReturnType<typeof fetchPostSearchMeta>>;
  if (
    data.accessType !== undefined &&
    data.categoryName !== undefined &&
    data.categoryId !== undefined &&
    data.publishedAt !== undefined
  ) {
    meta = {
      accessType: (data.accessType ?? "free") as "free" | "member" | "paid",
      categoryId: data.categoryId ?? null,
      categoryName: data.categoryName ?? null,
      publishedAt: (data.publishedAt as Date | null) ?? null,
    };
  } else {
    meta = await fetchPostSearchMeta(getDb(context.env), data.id);
  }

  await insert(db, {
    id: data.id.toString(),
    slug: data.slug,
    title: data.title,
    summary,
    tags: data.tags ?? [],
    // 以下均为仅存储、不进分词索引的字段
    cover: data.coverImage ?? "",
    accessType: meta.accessType,
    categoryId: meta.categoryId,
    categoryName: meta.categoryName,
    publishedAt: meta.publishedAt,
    // biome-ignore lint/suspicious/noExplicitAny: Orama insert 接受动态文档字段，需绕过严格类型
  } as any);

  await persistOramaDb(context.env, db);
  return { id: data.id };
}

export async function deleteIndex(
  context: { env: Env },
  data: DeleteSearchDocInput,
) {
  const db = await getOramaDb(context.env);
  await remove(db, data.id.toString());
  await persistOramaDb(context.env, db);
  return { id: data.id };
}

export async function rebuildIndex(context: DbContext, targetDb?: MyOramaDB) {
  const { env, db } = context;
  const start = Date.now();
  console.log("[search] Start backfilling index...");

  const searchDb = targetDb ?? (await createMyDb());

  const posts = await db.query.PostsTable.findMany({
    where: and(
      eq(PostsTable.status, "published"),
      lte(PostsTable.publishedAt, new Date()),
    ),
    with: {
      postTags: {
        with: {
          tag: true,
        },
      },
    },
  });

  // 批量读取收费状态 / 分类名（避免逐篇查询）
  const ids = posts.map((p) => p.id);
  const resourceRows =
    ids.length > 0
      ? await db
          .select({
            postId: postResource.postId,
            accessType: postResource.accessType,
          })
          .from(postResource)
          .where(inArray(postResource.postId, ids))
      : [];
  const accessByPostId = new Map<number, "free" | "member" | "paid">();
  for (const r of resourceRows) {
    accessByPostId.set(r.postId, r.accessType);
  }

  const catRows =
    ids.length > 0
      ? await db
          .select({
            postId: PostCategoriesTable.postId,
            id: CategoriesTable.id,
            name: CategoriesTable.name,
          })
          .from(PostCategoriesTable)
          .innerJoin(
            CategoriesTable,
            eq(PostCategoriesTable.categoryId, CategoriesTable.id),
          )
          .where(inArray(PostCategoriesTable.postId, ids))
      : [];
  const categoryIdByPostId = new Map<number, number>();
  const categoryByPostId = new Map<number, string>();
  for (const r of catRows) {
    // 取每篇文章的第一个分类
    if (!categoryByPostId.has(r.postId)) {
      categoryByPostId.set(r.postId, r.name);
      categoryIdByPostId.set(r.postId, r.id);
    }
  }

  for (const post of posts) {
    if (!post.title || !post.slug) continue;
    const plain = convertToPlainText(post.contentJson);
    const content =
      plain.length > CONTENT_SLICE ? plain.slice(0, CONTENT_SLICE) : plain;
    const summary =
      post.summary && post.summary.trim().length > 0
        ? post.summary
        : content.slice(0, SNIPPET_SLICE);

    const tags = post.postTags.map((pt) => pt.tag.name);

    await insert(searchDb, {
      id: post.id.toString(),
      title: post.title,
      slug: post.slug,
      tags,
      summary,
      // 以下均为仅存储、不进分词索引的字段
      cover: post.coverImage ?? "",
      accessType: accessByPostId.get(post.id) ?? "free",
      categoryId: categoryIdByPostId.get(post.id) ?? null,
      categoryName: categoryByPostId.get(post.id) ?? null,
      publishedAt: post.publishedAt ?? null,
      // biome-ignore lint/suspicious/noExplicitAny: Orama insert 接受动态文档字段，需绕过严格类型
    } as any);
  }

  await persistOramaDb(env, searchDb, posts.length);

  const duration = Date.now() - start;
  console.log(`[search] Indexed ${posts.length} posts in ${duration}ms`);

  return { indexed: posts.length, duration };
}

export async function getIndexVersion(context: DbContext) {
  return await getOramaMeta(context.env);
}
