import {
  queryOptions,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import {
  checkInFn,
  getMyCheckInStatusFn,
  getMyPointsFn,
  getMyPointTransactionsFn,
} from "../api/my-points.api";
import {
  type AdjustUserPointsPayload,
  adjustPointsFn,
  clearPointTransactionsFn,
  deletePointTransactionsFn,
  deleteUserFn,
  getBanInfoByEmailFn,
  getBannedStatusFn,
  getPointTransactionsFn,
  getUserFn,
  listUsersFn,
  setUserMembershipFn,
  type UpdateUserPayload,
  updateUserFn,
} from "../api/users.admin.api";

export const USERS_KEYS = {
  all: ["users"] as const,
  list: (options: { offset: number; limit: number; search?: string }) =>
    ["users", "list", options] as const,
  detail: (id: string) => ["users", "detail", id] as const,
  banStatus: ["users", "ban-status"] as const,
  banInfoByEmail: (email: string) => ["users", "ban-info", email] as const,
};

export function usersListQuery(options: {
  offset: number;
  limit: number;
  search?: string;
}) {
  return queryOptions({
    queryKey: USERS_KEYS.list(options),
    queryFn: () => listUsersFn({ data: options }),
  });
}

export function userDetailQuery(id: string) {
  return queryOptions({
    queryKey: USERS_KEYS.detail(id),
    queryFn: () => getUserFn({ data: { id } }),
  });
}

/** 当前访问者是否处于封禁状态（用于全站拦截） */
export function bannedStatusQuery() {
  return queryOptions({
    queryKey: USERS_KEYS.banStatus,
    queryFn: () => getBannedStatusFn(),
    staleTime: 0,
    refetchOnWindowFocus: false,
  });
}

/** 通过邮箱查询封禁信息（登录失败场景） */
export function banInfoByEmailQuery(email: string) {
  return queryOptions({
    queryKey: USERS_KEYS.banInfoByEmail(email),
    queryFn: () => getBanInfoByEmailFn({ data: { email } }),
  });
}

export function useUpdateUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: UpdateUserPayload) => updateUserFn({ data }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: USERS_KEYS.all });
    },
  });
}

export function useDeleteUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteUserFn({ data: { id } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: USERS_KEYS.all });
    },
  });
}

export function useSetUserMembership() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: {
      id: string;
      planId: string | null;
      expiresAt: number | null;
    }) => setUserMembershipFn({ data }),
    onSuccess: (_d, vars) => {
      queryClient.invalidateQueries({ queryKey: USERS_KEYS.detail(vars.id) });
    },
  });
}

/** 当前登录用户的双积分余额（普通积分 points + 会员积分 credits） */
export function myPointsQuery() {
  return queryOptions({
    queryKey: ["myPoints"],
    queryFn: () => getMyPointsFn(),
  });
}

export function useMyPoints() {
  return useQuery(myPointsQuery());
}

/** 后台调整某用户的双积分（扣除/添加） */
export function useAdjustUserPoints() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: AdjustUserPointsPayload) => adjustPointsFn({ data }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: USERS_KEYS.all });
    },
  });
}

/** 当前登录用户自己的积分流水（分页） */
export function myPointTransactionsQuery(offset: number, limit: number) {
  return queryOptions({
    queryKey: ["myPointTx", offset, limit],
    queryFn: () => getMyPointTransactionsFn({ data: { offset, limit } }),
  });
}

export function useMyPointTransactions(offset = 0, limit = 20) {
  return useQuery(myPointTransactionsQuery(offset, limit));
}

/** 当前用户签到状态 */
export function useMyCheckInStatus() {
  return useQuery({
    queryKey: ["myCheckIn"],
    queryFn: () => getMyCheckInStatusFn(),
  });
}

/** 执行签到 */
export function useCheckIn() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => checkInFn(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["myPoints"] });
      queryClient.invalidateQueries({ queryKey: ["myCheckIn"] });
      queryClient.invalidateQueries({ queryKey: ["myPointTx"] });
    },
  });
}

/** 后台：积分流水列表（支持筛选） */
export function pointTransactionsQuery(filters: {
  offset: number;
  limit: number;
  userId?: string;
  type?: "points" | "credits";
  source?: string;
  orderNo?: string;
}) {
  return queryOptions({
    queryKey: ["pointTx", filters],
    queryFn: () => getPointTransactionsFn({ data: filters }),
  });
}

export function usePointTransactions(filters: {
  offset: number;
  limit: number;
  userId?: string;
  type?: "points" | "credits";
  source?: string;
  orderNo?: string;
}) {
  return useQuery(pointTransactionsQuery(filters));
}

export function useDeletePointTransactions() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (ids: string[]) => deletePointTransactionsFn({ data: { ids } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["pointTx"] }),
  });
}

export function useClearPointTransactions() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => clearPointTransactionsFn(),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["pointTx"] }),
  });
}
