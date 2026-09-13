import { Skeleton } from '@/components/ui/skeleton';

export default function LeadsLoading() {
  return <div className="space-y-5" aria-busy="true"><Skeleton className="h-10 w-56" /><Skeleton className="h-10 w-full" />{Array.from({ length: 3 }, (_, index) => <Skeleton key={index} className="h-36 w-full rounded-xl" />)}</div>;
}
