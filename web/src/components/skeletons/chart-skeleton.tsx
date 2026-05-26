/**
 * Copyright © 2026 SolutionX Co., Ltd. (บริษัท โซลูชั่น เอ็กซ์ จำกัด)
 * All rights reserved.
 *
 * This software is proprietary and confidential.
 * Unauthorized copying, modification, distribution, or use of this software,
 * in whole or in part, is strictly prohibited without prior written permission.
 */

import { Skeleton } from "@/components/ui/skeleton"

// Deterministic bar heights — no Math.random() to avoid SSR/client hydration mismatch
const BAR_HEIGHTS = [42, 65, 38, 75, 55, 82, 48, 70, 35, 90, 62, 78]

/** Placeholder for a bar/line chart area */
export function ChartSkeleton({ height = 260 }: { height?: number }) {
  return (
    <div className="rounded-xl border bg-card p-5">
      <Skeleton className="h-5 w-40 mb-4" />
      <div className="flex items-end gap-2" style={{ height }}>
        {BAR_HEIGHTS.map((pct, i) => (
          <div key={i} className="flex-1 flex flex-col justify-end gap-1">
            <Skeleton
              className="w-full rounded-t-sm"
              style={{ height: `${pct}%` }}
            />
          </div>
        ))}
      </div>
      {/* X axis ticks */}
      <div className="flex gap-2 mt-2">
        {Array.from({ length: 12 }).map((_, i) => (
          <Skeleton key={i} className="flex-1 h-2.5" />
        ))}
      </div>
    </div>
  )
}

/** Small line chart placeholder */
export function LineChartSkeleton({ height = 220 }: { height?: number }) {
  return (
    <div className="rounded-xl border bg-card p-5">
      <Skeleton className="h-5 w-36 mb-4" />
      <div className="relative" style={{ height }}>
        <Skeleton className="absolute inset-0 rounded-lg opacity-40" />
        {/* Fake polyline dots */}
        <div className="absolute inset-x-4 inset-y-4 flex items-end justify-between">
          {[65,72,68,85,78,91,80,88,76,92,87,95].map((v, i) => (
            <div
              key={i}
              className="w-2 h-2 rounded-full bg-brand-300 dark:bg-brand-700 shrink-0"
              style={{ marginBottom: `${(v / 100) * (height - 32)}px` }}
            />
          ))}
        </div>
      </div>
    </div>
  )
}
