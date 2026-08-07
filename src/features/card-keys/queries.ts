import { queryOptions } from "@tanstack/react-query";
import { listCardKeysFn } from "./api/card-keys.admin.api";

export interface CardKeysListParams {
  keyword?: string;
  status?: "unused" | "used";
  page: number;
  pageSize: number;
}

export function cardKeysQueryOptions(input: CardKeysListParams) {
  return queryOptions({
    queryKey: ["card-keys", "list", input],
    queryFn: () =>
      listCardKeysFn({
        data: {
          keyword: input.keyword,
          status: input.status,
          offset: input.page * input.pageSize,
          limit: input.pageSize,
        },
      }),
  });
}
