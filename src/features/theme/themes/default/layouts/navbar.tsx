import { Link, useRouteContext } from "@tanstack/react-router";
import { ChevronDown, Search, UserIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { ThemeToggle } from "@/components/common/theme-toggle";
import { Skeleton } from "@/components/ui/skeleton";
import type { NavOption, UserInfo } from "@/features/theme/contract/layouts";
import { m } from "@/paraglide/messages";
import { LanguageSwitcher } from "./language-switcher";

interface NavbarProps {
  navOptions: Array<NavOption>;
  onMenuClick: () => void;
  isLoading?: boolean;
  user?: UserInfo;
}
export function Navbar({
  onMenuClick,
  user,
  navOptions,
  isLoading,
}: NavbarProps) {
  const { siteConfig } = useRouteContext({ from: "__root__" });
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <>
      <header
        className={`fixed top-0 left-0 right-0 z-40 flex items-center transition-all duration-500 ${
          isScrolled
            ? "bg-background/80 backdrop-blur-md border-b border-border/40 py-4 shadow-sm"
            : "bg-transparent border-transparent py-8"
        }`}
      >
        <div className="max-w-3xl mx-auto w-full px-6 md:px-0 flex items-center justify-between">
          {/* Left: Brand */}
          <Link to="/" className="group select-none">
            <span className="font-serif text-xl font-bold tracking-tighter text-foreground transition-colors group-hover:text-muted-foreground">
              [ {siteConfig.theme.default.navBarName} ]
            </span>
          </Link>

          {/* Center: Main Nav */}
          <nav className="hidden lg:flex items-center gap-8">
            {navOptions.map((option) => {
              const children = option.children?.length
                ? option.children
                : null;
              if (children) {
                return (
                  <div key={option.id} className="relative group">
                    <Link
                      to={option.to ?? "/"}
                      search={option.search}
                      className="flex items-center gap-1 text-[11px] font-medium uppercase tracking-widest text-muted-foreground/60 hover:text-foreground transition-colors"
                    >
                      {option.label}
                      <ChevronDown
                        size={12}
                        strokeWidth={2}
                        className="transition-transform group-hover:rotate-180"
                      />
                    </Link>
                    <div className="absolute left-0 top-full pt-3 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50">
                      <div className="min-w-[160px] bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 shadow-lg rounded-md py-2 flex flex-col">
                        {children.map((child) =>
                          child.external && child.href ? (
                            <a
                              key={child.id}
                              href={child.href}
                              target="_blank"
                              rel="noreferrer"
                              className="px-4 py-2 text-[11px] font-medium uppercase tracking-widest text-zinc-600 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-700 transition-colors"
                            >
                              {child.label}
                            </a>
                          ) : (
                            <Link
                              key={child.id}
                              to={child.to ?? "/"}
                              search={child.search}
                              className="px-4 py-2 text-[11px] font-medium uppercase tracking-widest text-zinc-600 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-700 transition-colors"
                            >
                              {child.label}
                            </Link>
                          ),
                        )}
                      </div>
                    </div>
                  </div>
                );
              }
              return option.external && option.href ? (
                <a
                  key={option.id}
                  href={option.href}
                  target="_blank"
                  rel="noreferrer"
                  className="text-[11px] font-medium uppercase tracking-widest text-muted-foreground/60 hover:text-foreground transition-colors"
                >
                  {option.label}
                </a>
              ) : (
                <Link
                  key={option.id}
                  to={option.to ?? "/"}
                  search={option.search}
                  className="text-[11px] font-medium uppercase tracking-widest text-muted-foreground/60 hover:text-foreground transition-colors"
                  activeProps={{
                    className: "!text-foreground",
                  }}
                >
                  {option.label}
                </Link>
              );
            })}
          </nav>

          {/* Right: Actions */}
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1">
              <ThemeToggle />
              <LanguageSwitcher className="hidden text-muted-foreground hover:text-foreground h-8 w-8" />
              <Link
                to="/search"
                className="text-muted-foreground hover:text-foreground h-8 w-8 flex items-center justify-center transition-colors"
                aria-label={m.nav_search()}
              >
                <Search
                  size={16}
                  strokeWidth={1.5}
                  style={{ viewTransitionName: "search-input" }}
                />
              </Link>
            </div>

            {/* Profile / Menu Toggle */}
            <div className="flex items-center gap-3 pl-3">
              <div className="hidden md:flex items-center">
                {isLoading ? (
                  <Skeleton className="w-8 h-8 rounded-full" />
                ) : (
                  <div className="flex items-center gap-3 animate-in fade-in">
                    {user ? (
                      <>
                        <Link
                          to="/membership"
                          className="w-7 h-7 rounded-full overflow-hidden ring-1 ring-border hover:ring-foreground transition-all relative z-10"
                          style={{ viewTransitionName: "user-avatar" }}
                        >
                          {user.image ? (
                            <img
                              src={user.image}
                              alt={user.name}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="w-full h-full bg-muted flex items-center justify-center">
                              <UserIcon
                                size={12}
                                className="text-muted-foreground"
                              />
                            </div>
                          )}
                        </Link>
                      </>
                    ) : (
                      <Link
                        to="/login"
                        className="text-[10px] uppercase tracking-widest font-bold text-muted-foreground hover:text-foreground transition-colors"
                      >
                        {m.nav_login()}
                      </Link>
                    )}
                  </div>
                )}
              </div>

              <button
                className="w-8 h-8 flex flex-col items-center justify-center gap-1.5 group lg:hidden"
                onClick={onMenuClick}
                aria-label={m.common_open_menu()}
                type="button"
              >
                <div className="w-5 h-px bg-foreground transition-all group-hover:w-3"></div>
                <div className="w-5 h-px bg-foreground transition-all group-hover:w-6"></div>
              </button>
            </div>
          </div>
        </div>
      </header>
      <div className="h-32"></div>
    </>
  );
}
