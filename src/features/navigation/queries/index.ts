import { queryOptions, useQuery } from "@tanstack/react-query";
import { getNavMenuFn, getNavigationFn } from "@/features/navigation/api/navigation.api";

export const NAV_KEYS = {
  navMenu: ["navMenu"] as const,
  admin: ["navigation", "admin"] as const,
};

export const navMenuQuery = queryOptions({
  queryKey: NAV_KEYS.navMenu,
  queryFn: () => getNavMenuFn(),
});

export const navigationAdminQuery = queryOptions({
  queryKey: NAV_KEYS.admin,
  queryFn: () => getNavigationFn(),
});

export function useNavMenu() {
  return useQuery(navMenuQuery);
}
