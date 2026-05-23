import { Skeleton } from "@/components/ui/skeleton"

function FieldSkeleton({ wide = false }: { wide?: boolean }) {
  return (
    <div className="space-y-1.5">
      <Skeleton className="h-4 w-24" />
      <Skeleton className={`h-10 rounded-lg ${wide ? "w-full" : "w-3/4"}`} />
    </div>
  )
}

export default function SettingsLoading() {
  return (
    <div className="p-6 space-y-6 max-w-2xl">
      {/* Title */}
      <Skeleton className="h-7 w-32" />

      {/* Form card */}
      <div className="rounded-xl border bg-card p-6 space-y-5">
        <Skeleton className="h-5 w-40 mb-1" />
        <div className="grid grid-cols-2 gap-5">
          <FieldSkeleton wide />
          <FieldSkeleton wide />
          <FieldSkeleton wide />
          <FieldSkeleton wide />
        </div>
        <FieldSkeleton wide />
        <div className="grid grid-cols-2 gap-5">
          <FieldSkeleton wide />
          <FieldSkeleton wide />
        </div>
      </div>

      {/* Danger zone */}
      <div className="rounded-xl border border-destructive/30 bg-card p-6 space-y-3">
        <Skeleton className="h-5 w-28" />
        <Skeleton className="h-4 w-72" />
        <Skeleton className="h-9 w-32 rounded-lg" />
      </div>

      {/* Save button */}
      <Skeleton className="h-10 w-28 rounded-lg" />
    </div>
  )
}
