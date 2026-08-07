import {
  createAdminTestContext,
  createTestContext,
  seedUser,
  waitForBackgroundTasks,
} from "tests/test-utils";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import * as PostService from "@/features/posts/services/posts.service";
import { extractCoverImage } from "@/features/posts/data/posts.data";
import { unwrap } from "@/lib/errors";

// 复现用例：验证「文章封面图」功能在本地 D1（已应用 0022 迁移）下，
// 对有图 / 无图文章都不会导致列表或详情查询报错，且自动抓封面逻辑正确。
describe("Cover image repro (with/without body images)", () => {
  let adminContext: ReturnType<typeof createAdminTestContext>;

  beforeEach(async () => {
    adminContext = createAdminTestContext();
    await seedUser(adminContext.db, adminContext.session.user);
  });

  afterEach(async () => {
    await waitForBackgroundTasks(adminContext.executionCtx);
  });

  const updatePost = async (
    input: Parameters<typeof PostService.updatePost>[1],
  ) => unwrap(await PostService.updatePost(adminContext, input));

  it("extractCoverImage: picks first >=200px image, skips tiny ones, returns null when no image", () => {
    const tiny = extractCoverImage({
      type: "doc",
      content: [
        {
          type: "image",
          attrs: { src: "https://x.com/tiny.jpg", width: 50, height: 50 },
        },
      ],
    });
    expect(tiny).toBeNull();

    const ok = extractCoverImage({
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [{ type: "text", text: "hi" }],
        },
        {
          type: "image",
          attrs: { src: "https://x.com/big.jpg", width: 800, height: 600 },
        },
      ],
    });
    expect(ok).toBe("https://x.com/big.jpg");

    const none = extractCoverImage({
      type: "doc",
      content: [{ type: "paragraph", content: [{ type: "text", text: "no img" }] }],
    });
    expect(none).toBeNull();
  });

  it("auto-extracts cover from body image when coverImage left empty on save", async () => {
    const { id } = await PostService.createEmptyPost(adminContext);
    const updated = await updatePost({
      id,
      data: {
        title: "Post With Image",
        slug: "post-with-image",
        status: "published",
        publishedAt: new Date(),
        coverImage: "", // 用户未填封面 -> 触发自动抓取
        contentJson: {
          type: "doc",
          content: [
            { type: "paragraph", content: [{ type: "text", text: "lead" }] },
            {
              type: "image",
              attrs: {
                src: "https://cdn.example.com/cover.jpg",
                width: 1200,
                height: 800,
              },
            },
          ],
        },
      },
    });

    expect(updated.coverImage).toBe("https://cdn.example.com/cover.jpg");
  });

  it("keeps coverImage null for text-only post when left empty on save", async () => {
    const { id } = await PostService.createEmptyPost(adminContext);
    const updated = await updatePost({
      id,
      data: {
        title: "Text Only Post",
        slug: "text-only-post",
        status: "published",
        publishedAt: new Date(),
        coverImage: "",
        contentJson: {
          type: "doc",
          content: [
            { type: "paragraph", content: [{ type: "text", text: "no image" }] },
          ],
        },
      },
    });

    expect(updated.coverImage).toBeNull();
  });

  it("list query returns both with/without image posts without error", async () => {
    const { id: withImgId } = await PostService.createEmptyPost(adminContext);
    await updatePost({
      id: withImgId,
      data: {
        title: "Has Image",
        slug: "has-image",
        status: "published",
        publishedAt: new Date(),
        coverImage: "",
        contentJson: {
          type: "doc",
          content: [
            {
              type: "image",
              attrs: { src: "https://cdn.example.com/a.jpg", width: 900, height: 600 },
            },
          ],
        },
      },
    });

    const { id: noImgId } = await PostService.createEmptyPost(adminContext);
    await updatePost({
      id: noImgId,
      data: {
        title: "No Image",
        slug: "no-image",
        status: "published",
        publishedAt: new Date(),
        coverImage: "",
        contentJson: {
          type: "doc",
          content: [{ type: "paragraph", content: [{ type: "text", text: "x" }] }],
        },
      },
    });

    const publicContext = createTestContext();
    const list = await PostService.getPostsCursor(publicContext, {});
    const slugs = list.items.map((p) => p.slug);
    expect(slugs).toContain("has-image");
    expect(slugs).toContain("no-image");

    const hasImgItem = list.items.find((p) => p.slug === "has-image");
    const noImgItem = list.items.find((p) => p.slug === "no-image");
    expect(hasImgItem?.coverImage).toBe("https://cdn.example.com/a.jpg");
    expect(noImgItem?.coverImage).toBeNull();
  });

  it("detail query (findPostBySlug) works for posts with and without images", async () => {
    const { id } = await PostService.createEmptyPost(adminContext);
    await updatePost({
      id,
      data: {
        title: "Detail Has Image",
        slug: "detail-has-image",
        status: "published",
        publishedAt: new Date(),
        coverImage: "",
        contentJson: {
          type: "doc",
          content: [
            {
              type: "image",
              attrs: { src: "https://cdn.example.com/d.jpg", width: 1000, height: 700 },
            },
          ],
        },
      },
    });

    const { id: id2 } = await PostService.createEmptyPost(adminContext);
    await updatePost({
      id: id2,
      data: {
        title: "Detail No Image",
        slug: "detail-no-image",
        status: "published",
        publishedAt: new Date(),
        coverImage: "",
        contentJson: {
          type: "doc",
          content: [{ type: "paragraph", content: [{ type: "text", text: "y" }] }],
        },
      },
    });

    const publicContext = createTestContext();
    const withImg = await PostService.findPostBySlug(publicContext, {
      slug: "detail-has-image",
    });
    const withoutImg = await PostService.findPostBySlug(publicContext, {
      slug: "detail-no-image",
    });

    expect(withImg).not.toBeNull();
    expect(withImg?.coverImage).toBe("https://cdn.example.com/d.jpg");
    expect(withoutImg).not.toBeNull();
    expect(withoutImg?.coverImage).toBeNull();
  });
});
