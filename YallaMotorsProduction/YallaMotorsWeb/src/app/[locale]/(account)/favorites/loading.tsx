import { Skeleton } from '@/components/ui/skeleton';

export default function FavoritesLoading() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Loading favorites">
      <div className="space-y-2"><Skeleton className="h-4 w-24" /><Skeleton className="h-9 w-64 max-w-full" /></div>
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 6 }, (_, index) => <Skeleton key={index} className="aspect-[4/5] rounded-xl" />)}
      </div>
    </div>
  );
}

