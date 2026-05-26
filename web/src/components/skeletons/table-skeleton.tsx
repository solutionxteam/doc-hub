/**
 * Copyright © 2026 SolutionX Co., Ltd. (บริษัท โซลูชั่น เอ็กซ์ จำกัด)
 * All rights reserved.
 *
 * This software is proprietary and confidential.
 * Unauthorized copying, modification, distribution, or use of this software,
 * in whole or in part, is strictly prohibited without prior written permission.
 */

import { Skeleton } from "@/components/ui/skeleton"

interface TableSkeletonProps {
  rows?:    number
  cols?:    number
  hasIcon?: boolean
}

/** Generic table row skeleton */
export function TableRowSkeleton({ cols = 4, hasIcon = true }: { cols?: number; hasIcon?: boolean }) {
  return (
    <div className="flex items-center gap-4 px-5 py-3.5">
      {hasIcon && <Skeleton className="w-9 h-9 rounded-lg shrink-0" />}
      <div className="flex-1 grid gap-3" style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}>
        {Array.from({ length: cols }).map((_, i) => (
          <Skeleton key={i} className={`h-4 ${i === 0 ? "w-3/4" : "w-1/2"}`} />
        ))}
      </div>
    </div>
  )
}

/** Table with header + N skeleton rows */
export function TableSkeleton({ rows = 6, cols = 4, hasIcon = true }: TableSkeletonProps) {
  return (
    <div className="rounded-xl border bg-card overflow-hidden">
      {/* Toolbar / filter bar */}
      <div className="px-5 py-3.5 border-b flex items-center gap-3">
        <div className="flex gap-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-7 w-16 rounded-lg" />
          ))}
        </div>
        <Skeleton className="ml-auto h-8 w-48 rounded-lg" />
      </div>
      {/* Header */}
      <div className="px-5 py-2.5 border-b bg-muted/40 flex items-center gap-4">
        {hasIcon && <Skeleton className="w-9 h-3 shrink-0 opacity-0" />}
        <div className="flex-1 grid gap-3" style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}>
          {Array.from({ length: cols }).map((_, i) => (
            <Skeleton key={i} className="h-3 w-20" />
          ))}
        </div>
      </div>
      {/* Rows */}
      <div className="divide-y">
        {Array.from({ length: rows }).map((_, i) => (
          <TableRowSkeleton key={i} cols={cols} hasIcon={hasIcon} />
        ))}
      </div>
    </div>
  )
}
