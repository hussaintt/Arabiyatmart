import { Skeleton } from '@/components/ui/skeleton';

export default function DashboardLoading() { return <div className="space-y-6" aria-busy="true"><Skeleton className="h-10 w-64" /><Skeleton className="h-20 w-full rounded-xl" /><div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{Array.from({ length: 5 }, (_, index) => <Skeleton key={index} className="h-36 rounded-xl" />)}</div><Skeleton className="h-72 rounded-xl" /></div>; }
