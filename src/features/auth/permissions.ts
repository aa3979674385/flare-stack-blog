import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { getMyPermissionsFn } from "./api/my-permissions.api";
import {
  hasPermission as hasPermissionUtil,
  type PermissionSubject,
} from "@/lib/permissions";

export interface MyPermissions {
  role: string | null;
  permissions: unknown;
  isSuper: boolean;
  effective: string[];
}

export const MY_PERMISSIONS_KEY = ["auth", "my-permissions"] as const;

export function useMyPermissions() {
  return useQuery({
    queryKey: MY_PERMISSIONS_KEY,
    queryFn: () => getMyPermissionsFn(),
    staleTime: 30_000,
  });
}

export function useHasPermission(key: string): boolean {
  const { data } = useMyPermissions();
  if (!data) return false;
  return hasPermissionUtil(data as PermissionSubject, key);
}

/** 在后台页面顶部调用：若无指定权限则跳转回 /admin 并提示 */
export function useRequirePermission(key: string) {
  const { data } = useMyPermissions();
  const navigate = useNavigate();
  useEffect(() => {
    if (data && !hasPermissionUtil(data as PermissionSubject, key)) {
      toast.error("无权访问该页面");
      void navigate({ to: "/admin" });
    }
  }, [data, key, navigate]);
}
