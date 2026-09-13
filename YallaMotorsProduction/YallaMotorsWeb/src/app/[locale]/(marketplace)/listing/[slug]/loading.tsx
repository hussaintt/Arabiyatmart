import * as React from 'react';
import { Skeleton } from '@/components/ui/skeleton';

export default function ListingDetailLoading() {
  return (
    <div
      className="min-h-screen bg-background text-foreground pb-24 lg:pb-12"
      data-testid="listing-detail-loading"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-4 sm:pt-6 space-y-6">
        {/* Breadcrumb Skeleton */}
        <div className="flex items-center gap-2 py-1">
          <Skeleton className="h-4 w-12 rounded-sm" />
          <Skeleton className="h-4 w-4 rounded-sm" />
          <Skeleton className="h-4 w-16 rounded-sm" />
          <Skeleton className="h-4 w-4 rounded-sm" />
          <Skeleton className="h-4 w-20 rounded-sm" />
          <Skeleton className="h-4 w-4 rounded-sm" />
          <Skeleton className="h-4 w-32 rounded-sm" />
        </div>

        {/* 7 / 5 Grid Skeleton */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Main Primary Content Column (7 cols) */}
          <div className="lg:col-span-7 space-y-8 min-w-0">
            {/* Gallery Skeleton with Reserved Aspect Ratio */}
            <div className="space-y-3">
              <Skeleton className="relative aspect-[16/10] w-full rounded-2xl" />
              <div className="flex items-center gap-2.5 overflow-hidden">
                <Skeleton className="aspect-[16/10] w-24 rounded-lg shrink-0" />
                <Skeleton className="aspect-[16/10] w-24 rounded-lg shrink-0" />
                <Skeleton className="aspect-[16/10] w-24 rounded-lg shrink-0" />
                <Skeleton className="aspect-[16/10] w-24 rounded-lg shrink-0" />
              </div>
            </div>

            {/* Summary Skeleton */}
            <div className="space-y-6">
              <div className="flex gap-2">
                <Skeleton className="h-6 w-16 rounded-full" />
                <Skeleton className="h-6 w-20 rounded-full" />
              </div>

              <div className="space-y-2">
                <Skeleton className="h-9 w-3/4 rounded-md" />
                <Skeleton className="h-4 w-40 rounded-md" />
              </div>

              {/* Price Block Skeleton */}
              <div className="rounded-xl border border-border/60 bg-card/60 p-5 space-y-3">
                <Skeleton className="h-10 w-48 rounded-md" />
                <Skeleton className="h-4 w-32 rounded-md" />
              </div>

              {/* Key Facts Grid Skeleton (6 cards) */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {Array.from({ length: 6 }).map((_, idx) => (
                  <div
                    key={`fact-skeleton-${idx}`}
                    className="flex items-center gap-3 rounded-xl border border-border bg-card p-3.5"
                  >
                    <Skeleton className="h-10 w-10 rounded-lg shrink-0" />
                    <div className="space-y-1 flex-1">
                      <Skeleton className="h-3 w-12" />
                      <Skeleton className="h-4 w-20" />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Specifications Skeleton */}
            <div className="space-y-4">
              <Skeleton className="h-7 w-48 rounded-md" />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="rounded-xl border border-border bg-card p-4 space-y-3">
                  <Skeleton className="h-5 w-32" />
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-4 w-4/5" />
                  </div>
                </div>
                <div className="rounded-xl border border-border bg-card p-4 space-y-3">
                  <Skeleton className="h-5 w-32" />
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-4 w-4/5" />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Secondary Action Rail Skeleton (5 cols) */}
          <div className="hidden lg:flex lg:col-span-5 flex-col space-y-6 min-w-0">
            <div className="rounded-xl border border-border bg-card p-6 space-y-4">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-9 w-40" />
              <Skeleton className="h-12 w-full rounded-lg" />
              <Skeleton className="h-12 w-full rounded-lg" />
              <Skeleton className="h-12 w-full rounded-lg" />
            </div>

            <div className="rounded-xl border border-border bg-card p-5 space-y-4">
              <Skeleton className="h-5 w-28" />
              <div className="flex items-center gap-3">
                <Skeleton className="h-14 w-14 rounded-xl shrink-0" />
                <div className="space-y-2 flex-1">
                  <Skeleton className="h-5 w-36" />
                  <Skeleton className="h-4 w-24" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
