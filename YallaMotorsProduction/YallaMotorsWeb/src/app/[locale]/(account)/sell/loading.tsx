import { Skeleton } from "@/components/ui/skeleton";

export default function SellLoading() {
  return (
    <div className="space-y-6" data-testid="sell-loading">
      <div className="grid min-w-0 grid-cols-1 gap-6 lg:grid-cols-[15rem_minmax(0,1fr)] xl:grid-cols-[15rem_minmax(0,48rem)_1fr]">
        <aside aria-label="Loading steps" className="min-w-0 rounded-xl border bg-card p-4 lg:sticky lg:top-24 lg:self-start space-y-3">
          <Skeleton className="h-6 w-24" />
          <div className="space-y-2 pt-2">
            {Array.from({ length: 7 }).map((_, i) => (
              <Skeleton key={i} className="h-9 w-full rounded-lg" />
            ))}
          </div>
        </aside>

        <section aria-label="Loading step content" className="min-w-0 rounded-xl border bg-card p-5 sm:p-6 space-y-6">
          <div className="space-y-2">
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-8 w-48" />
          </div>

          <div className="space-y-4 pt-4">
            <Skeleton className="h-12 w-full rounded-lg" />
            <Skeleton className="h-12 w-full rounded-lg" />
            <Skeleton className="h-24 w-full rounded-lg" />
          </div>

          <div className="flex items-center justify-between border-t pt-5">
            <Skeleton className="h-10 w-24 rounded-md" />
            <Skeleton className="h-10 w-32 rounded-md" />
          </div>
        </section>

        <aside className="hidden rounded-xl border bg-muted/40 p-5 xl:block xl:self-start space-y-3">
          <Skeleton className="h-6 w-16" />
          <Skeleton className="h-12 w-full" />
        </aside>
      </div>
    </div>
  );
}
