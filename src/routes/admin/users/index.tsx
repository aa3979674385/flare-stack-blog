import { createFileRoute } from "@tanstack/react-router";
import { User as UserIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { z } from "zod";
import { Input } from "@/components/ui/input";
import { UserTable } from "@/features/users/components/admin/user-table";

const searchSchema = z.object({
  search: z.string().optional(),
  page: z.number().optional().default(1).catch(1),
});

export const Route = createFileRoute("/admin/users/")({
  ssr: "data-only",
  validateSearch: searchSchema,
  component: UsersAdminPage,
  loader: () => ({ title: "用户管理" }),
  head: ({ loaderData }) => ({
    meta: [{ title: loaderData?.title }],
  }),
});

function UsersAdminPage() {
  const { search, page } = Route.useSearch();
  const navigate = Route.useNavigate();
  const [searchInput, setSearchInput] = useState(search || "");

  // 防抖搜索
  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchInput !== search) {
        navigate({
          search: (prev: { search?: string; page: number }) => ({
            ...prev,
            search: searchInput || undefined,
            page: 1,
          }),
        });
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [searchInput, navigate, search]);

  return (
    <div className="space-y-8 pb-20 animate-in fade-in slide-in-from-bottom-4 duration-1000">
      {/* 头部 */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-8 border-b border-border/30 pb-6">
        <div className="space-y-1">
          <h1 className="text-3xl font-serif font-medium tracking-tight text-foreground">
            用户管理
          </h1>
          <p className="text-xs font-mono tracking-widest text-muted-foreground uppercase">
            Users
          </p>
        </div>

        {/* 搜索 */}
        <div className="relative w-full md:w-64 group">
          <UserIcon className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground w-3.5 h-3.5 transition-colors group-focus-within:text-foreground" />
          <Input
            placeholder="搜索用户名或邮箱"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="pl-9 h-9 border-b border-border/50 bg-transparent rounded-none font-mono text-xs focus:border-foreground transition-all"
          />
        </div>
      </div>

      <div className="min-h-100">
        <UserTable search={search} page={page} />
      </div>
    </div>
  );
}
