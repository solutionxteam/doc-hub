/**
 * Copyright © 2026 SolutionX Co., Ltd. (บริษัท โซลูชั่น เอ็กซ์ จำกัด)
 * All rights reserved.
 *
 * This software is proprietary and confidential.
 * Unauthorized copying, modification, distribution, or use of this software,
 * in whole or in part, is strictly prohibited without prior written permission.
 */

import { Skeleton }       from "@/components/ui/skeleton"
import { StatGridSkeleton } from "@/components/skeletons/stat-card-skeleton"
import { ChartSkeleton }   from "@/components/skeletons/chart-skeleton"

export default function AnalyticsLoading() {
  return (
    <div className="p-6 space-y-6">
      {/* Title */}
      <Skeleton className="h-7 w-28" />

      {/* KPI grid */}
      <StatGridSkeleton count={4} />

      {/* Monthly expense chart */}
      <ChartSkeleton height={260} />

      {/* Two-col bottom row */}
      <div className="grid grid-cols-2 gap-6">

        {/* Top vendors list */}
        <div className="rounded-xl border bg-card p-5 space-y-4">
          <Skeleton className="h-5 w-32" />
          <div className="space-y-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="space-y-1.5">
                <div className="flex justify-between">
                  <Skeleton className="h-3.5 w-36" />
                  <Skeleton className="h-3.5 w-20" />
                </div>
                <Skeleton className="h-1.5 w-full rounded-full" />
              </div>
            ))}
          </div>
        </div>

        {/* AI performance chart */}
        <div className="rounded-xl border bg-card p-5 space-y-4">
          <Skeleton className="h-5 w-32" />
          <div className="relative h-[220px]">
            {/* Fake zigzag line hint */}
            <div className="absolute inset-0 flex items-center">
              <Skeleton className="w-full h-0.5" />
            </div>
            <div className="absolute inset-x-0 bottom-0 flex items-end justify-between px-2 gap-1">
              {Array.from({ length: 12 }).map((_, i) => (
                <Skeleton key={i} className="flex-1 h-2" />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
