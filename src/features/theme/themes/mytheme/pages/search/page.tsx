import { ArrowLeft, Keyboard, Loader2, Search } from "lucide-react";
import { useEffect, useRef } from "react";
import type { SearchPageProps } from "@/features/theme/contract/pages";
import { m } from "@/paraglide/messages";
import { GridPostCard } from "../../components/grid-post-card";
import type { PostItem } from "@/features/posts/schema/posts.schema";

export function SearchPage({
  query,
  results,
  isSearching,
  onQueryChange,
  onBack,
}: SearchPageProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Small delay to ensure the page has transitioned before focusing
    const timer = setTimeout(() => inputRef.current?.focus(), 150);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="w-full max-w-6xl mx-auto flex flex-col gap-6 pb-12">
      {/* Header Area */}
      <div
        className="fuwari-card-base p-6 md:p-8 flex items-center gap-4"
      >
        <button
          onClick={onBack}
          className="group flex items-center justify-center w-10 h-10 rounded-xl bg-(--fuwari-btn-regular-bg) text-(--fuwari-btn-content) hover:bg-(--fuwari-btn-regular-bg-hover) transition-colors shrink-0"
          title={m.search_back()}
        >
          <ArrowLeft
            size={18}
            className="group-hover:-translate-x-0.5 transition-transform"
          />
        </button>

        <div className="relative flex-1 flex items-center">
          <Search className="absolute left-4 w-5 h-5 fuwari-text-30 pointer-events-none" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            placeholder={m.search_placeholder()}
            className="w-full pl-12 pr-12 py-3 rounded-xl border border-(--fuwari-input-border) bg-(--fuwari-input-bg) focus:outline-none focus:border-(--fuwari-primary)/50 focus:bg-(--fuwari-primary)/5 transition-all fuwari-text-90 text-lg md:text-xl placeholder:text-black/30 dark:placeholder:text-white/30"
          />
          {isSearching && (
            <div className="absolute right-4 w-5 h-5 fuwari-text-50 pointer-events-none flex items-center justify-center">
              <Loader2 className="w-4 h-4 animate-spin" />
            </div>
          )}
        </div>
      </div>

      {/* Results Area */}
      <div className="flex flex-col gap-4">
        {query.trim() === "" && (
          <div
            className="fuwari-card-base rounded-(--fuwari-radius-large) p-16 flex flex-col items-center justify-center text-center"
          >
            <div className="w-20 h-20 rounded-full bg-(--fuwari-btn-regular-bg) flex items-center justify-center mb-6 text-(--fuwari-btn-content)">
              <Keyboard size={32} strokeWidth={1.5} />
            </div>
            <h3 className="text-xl font-bold fuwari-text-75 mb-3">
              {m.search_fuwari_intro_title()}
            </h3>
            <p className="text-sm fuwari-text-50 max-w-sm">
              {m.search_fuwari_intro_desc()}
            </p>
          </div>
        )}

        {query.trim() !== "" && !isSearching && results.length === 0 && (
          <div
            className="fuwari-card-base rounded-(--fuwari-radius-large) p-12 flex flex-col items-center justify-center text-center"
          >
            <div className="w-16 h-16 rounded-full bg-(--fuwari-btn-regular-bg) flex items-center justify-center mb-4 text-(--fuwari-btn-content)">
              <Search size={24} strokeWidth={1.5} />
            </div>
            <h3 className="text-lg font-bold fuwari-text-75 mb-2">
              {m.search_no_results()}
            </h3>
            <p className="text-sm fuwari-text-50">
              {m.search_no_results_with_query({ query })}
            </p>
          </div>
        )}

        {results.length > 0 && (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-4">
            {results.map((result) => (
              <GridPostCard
                key={result.post.id}
                post={
                  {
                    id: result.post.id,
                    slug: result.post.slug,
                    title: result.post.title,
                    coverImage: result.post.cover,
                    accessType: result.post.accessType ?? null,
                    categories: result.post.categoryId
                      ? [
                          {
                            id: result.post.categoryId,
                            name: result.post.categoryName,
                          },
                        ]
                      : result.post.categoryName
                        ? [{ name: result.post.categoryName }]
                        : [],
                    publishedAt: result.post.publishedAt
                      ? new Date(result.post.publishedAt)
                      : null,
                  } as unknown as PostItem
                }
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
