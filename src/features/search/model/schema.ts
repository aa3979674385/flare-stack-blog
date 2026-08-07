import type { Orama, Tokenizer } from "@orama/orama";
import { create } from "@orama/orama";

export const chineseTokenizerConfig: Tokenizer = {
  language: "chinese",
  // 按「字符」切分：中文逐字、英文逐字母（转小写、去空白）。
  // 配合 search.service.ts 里对 title 的 includes 子串过滤，实现「标题包含查询串即命中」。
  tokenize: (text: string) => {
    return Array.from(text.toLowerCase()).filter((ch) => !/\s/.test(ch));
  },
  normalizationCache: new Map(),
};

export const searchSchema = {
  id: "string",
  slug: "string",
  title: "string",
} as const;

export type MyOramaDB = Orama<typeof searchSchema>;

export async function createMyDb() {
  return await create({
    schema: searchSchema,
    components: {
      tokenizer: chineseTokenizerConfig,
    },
  });
}
