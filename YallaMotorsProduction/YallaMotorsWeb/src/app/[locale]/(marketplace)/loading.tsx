import { Skeleton } from '@/components/ui/skeleton';
import '@/components/home/home.css';

export default function MarketplaceHomeLoading() {
  return <div className="marketplace-home" data-testid="home-loading-skeleton" aria-busy="true" aria-label="Loading / جارٍ التحميل">
    <div className="home-container home-loading">
      <Skeleton className="home-loading-hero" />
      <Skeleton className="home-loading-search" />
      <div className="grid grid-cols-3 gap-5 border-b py-8 sm:grid-cols-6">{Array.from({ length: 6 }, (_, index) => <Skeleton key={index} className="h-16 rounded-lg" />)}</div>
      <div className="home-section space-y-7"><Skeleton className="h-9 w-64" /><Skeleton className="h-11 w-56" />
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">{Array.from({ length: 4 }, (_, index) => <div key={index} className="overflow-hidden rounded-xl border"><Skeleton className="aspect-[16/10] w-full rounded-none" /><div className="space-y-4 p-4"><Skeleton className="h-5 w-3/4" /><Skeleton className="h-6 w-1/2" /><Skeleton className="h-4 w-full" /></div></div>)}</div>
      </div>
    </div>
  </div>;
}
