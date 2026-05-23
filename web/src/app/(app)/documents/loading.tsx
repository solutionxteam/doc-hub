import { Skeleton }      from "@/components/ui/skeleton"
import { TableSkeleton } from "@/components/skeletons/table-skeleton"

export default function DocumentsLoading() {
  return (
    <div className="p-6 space-y-5">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <Skeleton className="h-7 w-32" />
      </div>

      {/* Upload zone placeholder */}
      <div className="rounded-xl border-2 border-dashed border-border bg-muted/30 p-8 flex flex-col items-center gap-3">
        <Skeleton className="w-12 h-12 rounded-xl" />
        <Skeleton className="h-4 w-48" />
        <Skeleton className="h-3 w-36" />
        <Skeleton className="h-9 w-32 rounded-lg mt-1" />
      </div>

      {/* Documents table */}
      <TableSkeleton rows={8} cols={4} hasIcon />
    </div>
  )
}
