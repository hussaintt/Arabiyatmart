import { Skeleton } from '@/components/ui/skeleton';

export default function BestOfferLoading() {
  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl space-y-8" data-testid="best-offer-loading">
      <div className="flex items-center gap-2">
        <Skeleton className="h-4 w-20" />
        <Skeleton className="h-4 w-4" />
        <Skeleton className="h-4 w-40" />
      </div>

      <div className="flex items-center justify-between p-4 rounded-xl border border-border">
        <div className="flex items-center gap-4">
          <Skeleton className="h-16 w-24 rounded-lg" />
          <div className="space-y-2">
            <Skeleton className="h-5 w-48" />
            <Skeleton className="h-4 w-24" />
          </div>
        </div>
        <Skeleton className="h-8 w-28 rounded-full" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        <div className="lg:col-span-8 space-y-6">
          <div className="space-y-2">
            <Skeleton className="h-7 w-56" />
            <Skeleton className="h-4 w-96" />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <Skeleton className="h-80 rounded-xl" />
            <Skeleton className="h-80 rounded-xl" />
          </div>
        </div>

        <div className="lg:col-span-4">
          <Skeleton className="h-64 rounded-xl" />
        </div>
      </div>
    </div>
  );
}
