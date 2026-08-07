import { Suspense } from "react";
import { cn } from "@/lib/utils";
import { Profile } from "./profile";
import { Tags, TagsSkeleton } from "./tags";

export function Sidebar({ className, hideProfile }: { className?: string; hideProfile?: boolean }) {
  return (
    <aside className={cn("flex flex-col gap-4", className)}>
      {!hideProfile && (
      <div
      >
        <Profile />
      </div>
      )}
      <div
        className="sticky top-4"
      >
        <Suspense fallback={<TagsSkeleton />}>
          <Tags />
        </Suspense>
      </div>
    </aside>
  );
}
