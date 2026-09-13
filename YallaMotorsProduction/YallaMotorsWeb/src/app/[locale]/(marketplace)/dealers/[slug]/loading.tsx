import * as React from 'react';
import { Skeleton } from '@/components/ui/skeleton';

export default function DealerProfileLoading() {
  return (
    <div
      className="min-h-screen bg-background text-foreground pb-16"
      data-testid="dealer-profile-loading"
    >
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-4 sm:pt-6 space-y-6 sm:space-y-8">
        {/* Breadcrumb Skeleton */}
        <div className="flex items-center gap-2 py-1">
          <Skeleton className="h-4 w-16 rounded-md" />
          <Skeleton className="h-4 w-4 rounded-full" />
          <Skeleton className="h-4 w-24 rounded-md" />
          <Skeleton className="h-4 w-4 rounded-full" />
          <Skeleton className="h-4 w-32 rounded-md" />
        </div>

        {/* Header Skeleton */}
        <div className="overflow-hidden rounded-2xl border bg-card shadow-xs">
          <Skeleton className="h-32 sm:h-44 md:h-56 w-full" />
          <div className="px-4 sm:px-6 md:px-8 pb-6 pt-0">
            <div className="relative -mt-12 sm:-mt-16 flex flex-col sm:flex-row items-start sm:items-end justify-between gap-4 pb-4 border-b">
              <div className="flex items-end gap-4">
                <Skeleton className="h-24 w-24 sm:h-28 sm:w-28 rounded-2xl border-4 border-background" />
                <div className="space-y-2 pb-1">
                  <Skeleton className="h-8 w-48 sm:w-64 rounded-md" />
                  <div className="flex items-center gap-2">
                    <Skeleton className="h-4 w-20 rounded-md" />
                    <Skeleton className="h-4 w-16 rounded-md" />
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 w-full sm:w-auto">
                <Skeleton className="h-10 w-28 rounded-lg" />
                <Skeleton className="h-10 w-28 rounded-lg" />
              </div>
            </div>

            <div className="pt-4 grid grid-cols-2 sm:grid-cols-4 gap-4">
              <Skeleton className="h-10 rounded-lg" />
              <Skeleton className="h-10 rounded-lg" />
            </div>
          </div>
        </div>

        {/* 12-Column Responsive Layout Skeleton */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 items-start">
          {/* Main Inventory Skeleton (8 cols) */}
          <div className="lg:col-span-8 space-y-6">
            <div className="flex items-center justify-between pb-4 border-b">
              <div className="space-y-1">
                <Skeleton className="h-6 w-40 rounded-md" />
                <Skeleton className="h-4 w-60 rounded-md" />
              </div>
              <Skeleton className="h-8 w-36 rounded-lg" />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="rounded-xl border bg-card p-4 space-y-3">
                  <Skeleton className="h-40 w-full rounded-lg" />
                  <Skeleton className="h-5 w-3/4 rounded-md" />
                  <Skeleton className="h-4 w-1/2 rounded-md" />
                  <div className="flex justify-between pt-2 border-t">
                    <Skeleton className="h-5 w-20 rounded-md" />
                    <Skeleton className="h-5 w-16 rounded-md" />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Dealer Information Rail Skeleton (4 cols) */}
          <div className="lg:col-span-4 space-y-6">
            <div className="rounded-2xl border bg-card p-5 space-y-3">
              <Skeleton className="h-5 w-32 rounded-md" />
              <Skeleton className="h-16 w-full rounded-md" />
            </div>

            <div className="rounded-2xl border bg-card p-5 space-y-3">
              <Skeleton className="h-5 w-36 rounded-md" />
              <Skeleton className="h-24 w-full rounded-md" />
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
