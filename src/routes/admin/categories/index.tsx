import { createFileRoute } from "@tanstack/react-router";
import { CategoryManager } from "@/features/navigation/components/category-manager";

export const Route = createFileRoute("/admin/categories/")({
  ssr: "data-only",
  component: CategoryManagerRoute,
  loader: async () => ({ title: "分类管理" }),
  head: ({ loaderData }) => ({
    meta: [{ title: loaderData?.title }],
  }),
});

function CategoryManagerRoute() {
  return <CategoryManager />;
}
