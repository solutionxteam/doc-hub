import { Skeleton } from "@/components/ui/skeleton"

export default function ReviewLoading() {
  return (
    <div className="flex h-[calc(100vh-4rem)] overflow-hidden">

      {/* Left panel — PDF viewer */}
      <div className="w-1/2 border-r flex flex-col">
        {/* Toolbar */}
        <div className="px-4 py-3 border-b flex items-center gap-2 shrink-0">
          <Skeleton className="h-8 w-8 rounded" />
          <Skeleton className="h-8 w-8 rounded" />
          <Skeleton className="h-4 w-24 mx-2" />
          <Skeleton className="ml-auto h-8 w-8 rounded" />
          <Skeleton className="h-8 w-8 rounded" />
        </div>
        {/* PDF page */}
        <div className="flex-1 bg-muted/30 flex items-center justify-center p-4">
          <Skeleton className="w-full max-w-sm aspect-[3/4] rounded-lg" />
        </div>
      </div>

      {/* Right panel — extracted data */}
      <div className="w-1/2 flex flex-col overflow-y-auto">

        {/* Action bar */}
        <div className="px-5 py-3 border-b flex items-center gap-2 shrink-0">
          <Skeleton className="h-6 w-20 rounded-full" />
          <div className="ml-auto flex gap-2">
            <Skeleton className="h-9 w-24 rounded-lg" />
            <Skeleton className="h-9 w-24 rounded-lg" />
            <Skeleton className="h-9 w-28 rounded-lg" />
          </div>
        </div>

        <div className="p-5 space-y-5">

          {/* Confidence meter */}
          <div className="rounded-xl border bg-card p-4 space-y-2">
            <div className="flex justify-between">
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-4 w-12" />
            </div>
            <Skeleton className="h-2 w-full rounded-full" />
          </div>

          {/* Fields grid */}
          <div className="rounded-xl border bg-card p-5 space-y-4">
            <Skeleton className="h-5 w-32" />
            <div className="grid grid-cols-2 gap-4">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="space-y-1.5">
                  <Skeleton className="h-3 w-24" />
                  <Skeleton className="h-9 w-full rounded-lg" />
                </div>
              ))}
            </div>
          </div>

          {/* Line items table */}
          <div className="rounded-xl border bg-card overflow-hidden">
            <div className="px-5 py-3 border-b">
              <Skeleton className="h-5 w-28" />
            </div>
            {/* Header */}
            <div className="px-4 py-2 bg-muted/40 grid grid-cols-4 gap-3">
              {["Description", "Qty", "Unit Price", "Amount"].map((_, i) => (
                <Skeleton key={i} className="h-3 w-16" />
              ))}
            </div>
            {/* Rows */}
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="px-4 py-3 grid grid-cols-4 gap-3 border-t">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-8" />
                <Skeleton className="h-4 w-16" />
                <Skeleton className="h-4 w-20" />
              </div>
            ))}
            {/* Totals */}
            <div className="px-4 py-3 border-t space-y-2">
              {["Subtotal", "VAT", "Total"].map((_, i) => (
                <div key={i} className="flex justify-between">
                  <Skeleton className="h-4 w-16" />
                  <Skeleton className="h-4 w-24" />
                </div>
              ))}
            </div>
          </div>

          {/* Audit log */}
          <div className="rounded-xl border bg-card">
            <div className="px-5 py-4 border-b">
              <Skeleton className="h-5 w-24" />
            </div>
            <div className="divide-y">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="px-5 py-3 flex items-center gap-3">
                  <Skeleton className="w-7 h-7 rounded-full shrink-0" />
                  <div className="flex-1 space-y-1">
                    <Skeleton className="h-3.5 w-48" />
                    <Skeleton className="h-3 w-24" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
