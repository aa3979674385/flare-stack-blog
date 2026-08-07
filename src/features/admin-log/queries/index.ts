import {
  queryOptions,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import {
  clearAdminLogsFn,
  deleteAdminLogsFn,
  listAdminLogsFn,
} from "../api/admin-log.api";

export const ADMIN_LOG_KEYS = {
  all: ["admin-logs"] as const,
};

export function adminLogsListQuery(input: {
  search?: string;
  limit: number;
  offset: number;
}) {
  return queryOptions({
    queryKey: [...ADMIN_LOG_KEYS.all, "list", input],
    queryFn: () => listAdminLogsFn({ data: input }),
  });
}

export function useAdminLogsList(input: {
  search?: string;
  limit: number;
  offset: number;
}) {
  return useQuery(adminLogsListQuery(input));
}

export function useDeleteAdminLogs() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (ids: string[]) => deleteAdminLogsFn({ data: { ids } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-logs"] }),
  });
}

export function useClearAdminLogs() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => clearAdminLogsFn(),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-logs"] }),
  });
}
