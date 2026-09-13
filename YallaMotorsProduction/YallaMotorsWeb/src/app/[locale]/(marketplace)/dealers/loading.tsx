import * as React from 'react';
import { Skeleton } from '@/components/ui/skeleton';

export default function DealersLoading() {
  return (
    <div
      className="min-h-screen bg-background text-foreground pb-16"
      data-testid="dealers-loading"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-4 sm:pt-6 space-y-6 sm:space-y-8">
        {/* Breadcrumb Skeleton */}
        <div className="flex items-center gap-2 py-1">
          <Skeleton className="h-4 w-12 rounded-sm" />
          <Skeleton className="h-4 w-4 rounded-sm" />
          <Skeleton className="h-4 w-24 rounded-sm" />
        </div>

        {/* Heading Skeleton */}
        <div className="space-y-2">
          <Skeleton className="h-9 w-64 sm:w-80 rounded-md" />
          <Skeleton className="h-4 w-full max-w-xl rounded-md" />
        </div>

        {/* 12-Column Responsive Layout Skeleton */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 items-start">
          {/* Filter Rail Skeleton (3 cols) */}
          <div className="lg:col-span-4 xl:col-span-3 rounded-xl border border-border bg-card p-5 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b">
              <Skeleton className="h-5 w-32 rounded-md" />
            </div>
            <div className="space-y-2">
              <Skeleton className="h-4 w-20 rounded-md" />
              <Skeleton className="h-10 w-full rounded-lg" />
            </div>
          </div>

          {/* Directory Content Skeleton (9 cols) */}
          <div className="lg:col-span-8 xl:col-span-9 space-y-6">
            <div className="flex items-center justify-between pb-3 border-b">
              <Skeleton className="h-5 w-40 rounded-md" />
              <Skeleton className="h-4 w-20 rounded-md" />
            </div>

            {/* 9 Directory Card Skeletons in 1/2/3 responsive columns */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
              {Array.from({ length: 9 }).map((_, idx) => (
                <div
                  key={`dealer-card-skeleton-${idx}`}
                  className="rounded-xl border border-border bg-card p-5 space-y-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <Skeleton className="h-16 w-16 rounded-xl shrink-0" />
                    <Skeleton className="h-5 w-20 rounded-full" />
                  </div>
                  <div className="space-y-2">
                    <Skeleton className="h-5 w-3/4 rounded-md" />
                    <Skeleton className="h-4 w-1/2 rounded-md" />
                  </div>
                  <div className="pt-4 border-t flex items-center justify-between">
                    <Skeleton className="h-4 w-24 rounded-md" />
                    <Skeleton className="h-4 w-12 rounded-md" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
