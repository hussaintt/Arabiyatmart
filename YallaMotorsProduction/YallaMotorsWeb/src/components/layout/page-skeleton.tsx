import { Skeleton } from '@/components/ui/skeleton';

export function PageSkeleton({ cards = 6 }: { cards?: number }) {
  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-8 motion-reduce:[&_*]:animate-none sm:px-6 lg:px-8" aria-busy="true" aria-label="Loading">
      <Skeleton className="h-9 w-56" />
      <Skeleton className="mt-3 h-5 w-full max-w-xl" />
      <div className="mt-8 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {Array.from({ length: cards }, (_, index) => <div key={index} className="overflow-hidden rounded-xl border bg-card"><Skeleton className="aspect-[4/3] w-full rounded-none" /><div className="space-y-3 p-4"><Skeleton className="h-5 w-4/5" /><Skeleton className="h-4 w-2/3" /><Skeleton className="h-7 w-1/2" /></div></div>)}
      </div>
      <span className="sr-only">Loading content</span>
    </div>
  );
}
