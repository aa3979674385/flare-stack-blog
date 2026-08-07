import type { WorkflowEvent, WorkflowStep } from "cloudflare:workers";
import { WorkflowEntrypoint } from "cloudflare:workers";
import { toUTCMidnight } from "@/features/posts/utils/date";
import { getCategoriesByPostId } from "@/features/categories/categories.service";
import {
  fetchPost,
  invalidatePostCaches,
  upsertPostSearchIndex,
} from "@/features/posts/workflows/helpers";
import { getDb } from "@/lib/db";

interface Params {
  postId: number;
  publishedAt: string; // ISO 8601
}

export class ScheduledPublishWorkflow extends WorkflowEntrypoint<Env, Params> {
  async run(event: WorkflowEvent<Params>, step: WorkflowStep) {
    const { postId } = event.payload;

    await step.sleepUntil(
      "sleep until publish date",
      toUTCMidnight(new Date(event.payload.publishedAt)),
    );

    const post = await step.do("verify post status", async () => {
      return await fetchPost(this.env, postId);
    });

    if (!post || post.status !== "published") return;

    await step.do("invalidate caches", async () => {
      await invalidatePostCaches(this.env, post);
    });

    await step.do("update search index", async () => {
      const categoryId =
        (await getCategoriesByPostId({ db: getDb(this.env), env: this.env }, { postId }))[0]?.id ?? null;
      await upsertPostSearchIndex(this.env, {
        ...post,
        categoryId,
      });
    });
  }
}
