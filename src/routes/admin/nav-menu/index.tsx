import { createFileRoute } from "@tanstack/react-router";
import { NavMenuManager } from "@/features/navigation/components/nav-menu-manager";

export const Route = createFileRoute("/admin/nav-menu/")({
  ssr: "data-only",
  component: NavMenuManagerRoute,
  loader: async () => ({ title: "导航菜单" }),
  head: ({ loaderData }) => ({
    meta: [{ title: loaderData?.title }],
  }),
});

function NavMenuManagerRoute() {
  return <NavMenuManager />;
}
