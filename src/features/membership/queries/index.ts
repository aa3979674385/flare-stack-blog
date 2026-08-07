import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createMembershipPlanFn,
  deleteMembershipPlanFn,
  listMembershipPlanOptionsFn,
  listMembershipPlansFn,
  setMembershipPlanVisibleFn,
  updateMembershipPlanFn,
} from "../api/membership.admin.api";
import {
  getMyMembershipStatusFn,
  listPublicMembershipPlansFn,
  type PublicMembershipPlan,
} from "../api/membership.public.api";
import type { MembershipPlan } from "@/lib/db/schema";

export const membershipPlansQueryOptions = {
  queryKey: ["membership", "plans"] as const,
  queryFn: () => listMembershipPlansFn(),
};

export function useMembershipPlans() {
  return useQuery(membershipPlansQueryOptions);
}

/** 前台公开套餐列表（会员中心「会员套餐」页用）。 */
export function usePublicMembershipPlans() {
  return useQuery({
    queryKey: ["membership", "public-plans"],
    queryFn: () => listPublicMembershipPlansFn(),
  });
}

/** 当前登录用户的会员状态（会员中心概览用）。 */
export function useMyMembershipStatus() {
  return useQuery({
    queryKey: ["membership", "my-status"],
    queryFn: () => getMyMembershipStatusFn(),
  });
}

export type { PublicMembershipPlan };

export function useCreateMembershipPlan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: Parameters<typeof createMembershipPlanFn>[0]) =>
      createMembershipPlanFn(input),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: ["membership", "plans"] }),
  });
}

export function useUpdateMembershipPlan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: Parameters<typeof updateMembershipPlanFn>[0]) =>
      updateMembershipPlanFn(input),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: ["membership", "plans"] }),
  });
}

export function useDeleteMembershipPlan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: Parameters<typeof deleteMembershipPlanFn>[0]) =>
      deleteMembershipPlanFn(input),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: ["membership", "plans"] }),
  });
}

export function useMembershipPlanOptions() {
  return useQuery({
    queryKey: ["membership", "plan-options"],
    queryFn: () => listMembershipPlanOptionsFn(),
  });
}

export function useSetMembershipPlanVisible() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: Parameters<typeof setMembershipPlanVisibleFn>[0]) =>
      setMembershipPlanVisibleFn(input),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: ["membership", "plans"] }),
  });
}

export type { MembershipPlan };
