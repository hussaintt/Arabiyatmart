import { Skeleton } from '@/components/ui/skeleton';

export default function AuthLoading() {
  return (
    <main className="flex min-h-[calc(100vh-4rem)] items-center justify-center bg-muted/30 px-4 py-10" aria-busy="true" aria-label="Loading">
      <div className="w-full max-w-md space-y-5 rounded-2xl border bg-card p-6 shadow-sm motion-reduce:[&_*]:animate-none sm:p-8">
        <Skeleton className="mx-auto h-9 w-48" />
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-full" />
        <span className="sr-only">Loading authentication form</span>
      </div>
    </main>
  );
}
