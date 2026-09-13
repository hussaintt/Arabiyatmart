import { Skeleton } from "@/components/ui/skeleton";

export default function MyListingsLoading() {
  return (
    <div className="space-y-6" data-testid="my-listings-loading">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <Skeleton className="h-8 w-40" />
          <Skeleton className="h-4 w-64" />
        </div>
        <Skeleton className="h-10 w-36 rounded-md" />
      </div>

      <div className="flex gap-2 border-b pb-2">
        <Skeleton className="h-9 w-24 rounded-t-lg" />
        <Skeleton className="h-9 w-20 rounded-t-lg" />
        <Skeleton className="h-9 w-28 rounded-t-lg" />
        <Skeleton className="h-9 w-20 rounded-t-lg" />
      </div>

      <div className="space-y-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="flex flex-col sm:flex-row rounded-xl border p-4 gap-4">
            <Skeleton className="aspect-[4/3] sm:w-48 sm:h-36 rounded-lg shrink-0" />
            <div className="flex flex-1 flex-col justify-between space-y-3">
              <div className="space-y-2">
                <Skeleton className="h-6 w-3/4" />
                <Skeleton className="h-4 w-1/3" />
              </div>
              <div className="flex justify-end pt-3 border-t">
                <Skeleton className="h-9 w-28 rounded-md" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
