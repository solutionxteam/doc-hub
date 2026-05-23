import { Skeleton }      from "@/components/ui/skeleton"
import { TableSkeleton } from "@/components/skeletons/table-skeleton"

export default function MembersLoading() {
  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <Skeleton className="h-7 w-32" />
        <Skeleton className="h-9 w-32 rounded-lg" />
      </div>

      {/* Members table */}
      <TableSkeleton rows={5} cols={3} hasIcon />

      {/* Pending invitations */}
      <div className="rounded-xl border bg-card">
        <div className="px-5 py-4 border-b">
          <Skeleton className="h-5 w-40" />
        </div>
        <div className="divide-y">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex items-center gap-4 px-5 py-3.5">
              <div className="flex-1 space-y-1.5">
                <Skeleton className="h-4 w-48" />
                <Skeleton className="h-3 w-32" />
              </div>
              <Skeleton className="h-5 w-16 rounded-full" />
              <Skeleton className="h-8 w-20 rounded-lg" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
