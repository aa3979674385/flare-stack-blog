import {
  queryOptions,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import {
  clearPurchaseOrdersFn,
  clearResourceDownloadsFn,
  createPostResourceFn,
  deletePostResourceFn,
  deletePurchaseOrdersFn,
  deleteResourceDownloadsFn,
  listPostResourcesFn,
  listPurchaseOrdersFn,
  listResourceDownloadsFn,
  reorderPostResourcesFn,
  updatePostResourceFn,
} from "../api/post-resources.admin.api";
import {
  getMyDailyDownloadQuotaFn,
  listMyPurchaseOrdersFn,
  listPublicPostResourcesFn,
  unlockPostResourceFn,
} from "../api/post-resources.public.api";

/* ======================= 后台管理 ======================= */

export function postResourcesQueryOptions(postId: number) {
  return queryOptions({
    queryKey: ["postResources", postId] as const,
    queryFn: ({ signal }) => listPostResourcesFn({ data: { postId }, signal }),
  });
}

export function usePostResources(postId: number) {
  return useQuery(postResourcesQueryOptions(postId));
}

export function useCreatePostResource() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: Parameters<typeof createPostResourceFn>[0]) =>
      createPostResourceFn(input),
    onSuccess: (_d, vars) =>
      qc.invalidateQueries({
        queryKey: ["postResources", vars.data.postId],
      }),
  });
}

export function useUpdatePostResource() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: Parameters<typeof updatePostResourceFn>[0]) =>
      updatePostResourceFn(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["postResources"] }),
  });
}

export function useDeletePostResource() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: Parameters<typeof deletePostResourceFn>[0]) =>
      deletePostResourceFn(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["postResources"] }),
  });
}

export function useReorderPostResources() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: Parameters<typeof reorderPostResourcesFn>[0]) =>
      reorderPostResourcesFn(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["postResources"] }),
  });
}

/* ======================= 前台公开 ======================= */

export function publicPostResourcesQuery(postId: number) {
  return queryOptions({
    queryKey: ["publicPostResources", postId] as const,
    queryFn: ({ signal }) =>
      listPublicPostResourcesFn({ data: { postId }, signal }),
  });
}

export function usePublicPostResources(postId: number) {
  return useQuery(publicPostResourcesQuery(postId));
}

export function useUnlockPostResource(postId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: Parameters<typeof unlockPostResourceFn>[0]) =>
      unlockPostResourceFn(input),
    onSuccess: () =>
      qc.invalidateQueries({
        queryKey: ["publicPostResources", postId],
      }),
  });
}

/* ======================= 后台审计 ======================= */

export function usePurchaseOrders(filters: {
  offset: number;
  limit: number;
  orderNo?: string;
  userId?: string;
  keyword?: string;
}) {
  return useQuery({
    queryKey: ["purchaseOrders", filters],
    queryFn: () => listPurchaseOrdersFn({ data: filters }),
  });
}

export function useResourceDownloads(filters: {
  offset: number;
  limit: number;
  keyword?: string;
}) {
  return useQuery({
    queryKey: ["resourceDownloads", filters],
    queryFn: () => listResourceDownloadsFn({ data: filters }),
  });
}

/** 当前登录用户自己的购买记录（会员中心「积分余额」页用）。 */
export function useMyPurchaseOrders(offset = 0, limit = 20) {
  return useQuery({
    queryKey: ["myPurchaseOrders", offset, limit],
    queryFn: () => listMyPurchaseOrdersFn({ data: { offset, limit } }),
  });
}

/* ======================= 每日下载配额 ======================= */

export const myDailyDownloadQuotaQuery = queryOptions({
  queryKey: ["myDailyDownloadQuota"] as const,
  queryFn: () => getMyDailyDownloadQuotaFn(),
});

/** 当前登录用户今日下载配额（已下篇数 / 上限 / 剩余）。未登录时不启用。 */
export function useMyDailyDownloadQuota() {
  return useQuery(myDailyDownloadQuotaQuery);
}

/* ======================= 后台审计：删除 / 清空 ======================= */

export function useDeletePurchaseOrders() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (ids: string[]) => deletePurchaseOrdersFn({ data: { ids } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["purchaseOrders"] }),
  });
}

export function useClearPurchaseOrders() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => clearPurchaseOrdersFn(),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["purchaseOrders"] }),
  });
}

export function useDeleteResourceDownloads() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (ids: string[]) => deleteResourceDownloadsFn({ data: { ids } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["resourceDownloads"] }),
  });
}

export function useClearResourceDownloads() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => clearResourceDownloadsFn(),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["resourceDownloads"] }),
  });
}
