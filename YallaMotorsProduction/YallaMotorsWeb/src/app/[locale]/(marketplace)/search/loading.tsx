import * as React from 'react';
import { Skeleton } from '@/components/ui/skeleton';

export default function SearchLoading() {
  return (
    <div className="container mx-auto px-4 py-6 sm:py-8 space-y-6" data-testid="search-loading">
      {/* Mobile Toolbar Skeleton */}
      <div className="lg:hidden flex items-center justify-between gap-3 p-3 rounded-xl border border-border bg-card">
        <Skeleton className="h-10 w-28 rounded-lg" />
        <Skeleton className="h-10 w-36 rounded-lg" />
      </div>

      {/* Main Grid: 3-column sidebar + 9-column content */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 items-start">
        {/* Desktop Sidebar Skeleton */}
        <div className="hidden lg:block lg:col-span-4 xl:col-span-3 rounded-2xl border border-border bg-card p-5 space-y-6">
          <Skeleton className="h-6 w-32" />
          <div className="space-y-2">
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-10 w-full rounded-md" />
          </div>
          <div className="space-y-2">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-8 w-full rounded-lg" />
          </div>
          <div className="space-y-4">
            <div className="space-y-2">
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-10 w-full rounded-md" />
            </div>
            <div className="space-y-2">
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-10 w-full rounded-md" />
            </div>
          </div>
          <div className="space-y-2">
            <Skeleton className="h-4 w-20" />
            <div className="grid grid-cols-2 gap-2">
              <Skeleton className="h-9 w-full rounded-md" />
              <Skeleton className="h-9 w-full rounded-md" />
            </div>
          </div>
        </div>

        {/* Content Area Skeleton */}
        <div className="col-span-1 lg:col-span-8 xl:col-span-9 space-y-6">
          {/* Header Row */}
          <div className="hidden lg:flex items-center justify-between pb-3 border-b border-border">
            <div className="space-y-1">
              <Skeleton className="h-7 w-48" />
              <Skeleton className="h-4 w-32" />
            </div>
            <Skeleton className="h-10 w-52 rounded-lg" />
          </div>

          {/* Cards Grid Skeleton: 9 cards in 3 columns */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
            {Array.from({ length: 9 }).map((_, idx) => (
              <div
                key={`search-card-skeleton-${idx}`}
                className="flex flex-col rounded-2xl border border-border bg-card overflow-hidden shadow-xs"
              >
                <Skeleton className="aspect-[16/10] w-full" />
                <div className="p-4 space-y-3">
                  <Skeleton className="h-5 w-3/4" />
                  <Skeleton className="h-6 w-1/2" />
                  <div className="flex gap-2 pt-2">
                    <Skeleton className="h-4 w-16 rounded-full" />
                    <Skeleton className="h-4 w-16 rounded-full" />
                    <Skeleton className="h-4 w-16 rounded-full" />
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Pagination Skeleton */}
          <div className="pt-4 flex justify-center">
            <Skeleton className="h-10 w-64 rounded-lg" />
          </div>
        </div>
      </div>
    </div>
  );
}
