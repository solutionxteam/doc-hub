"use client"

/**
 * Copyright © 2026 SolutionX Co., Ltd. (บริษัท โซลูชั่น เอ็กซ์ จำกัด)
 * All rights reserved.
 *
 * This software is proprietary and confidential.
 * Unauthorized copying, modification, distribution, or use of this software,
 * in whole or in part, is strictly prohibited without prior written permission.
 */

import { useEffect } from "react"
import { AlertCircle } from "lucide-react"

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    // Log to console so it shows in terminal too
    console.error("[AppError boundary]", error)
  }, [error])

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] p-8 gap-4 text-center">
      <div className="w-14 h-14 rounded-full bg-rose-500/10 flex items-center justify-center">
        <AlertCircle className="w-7 h-7 text-rose-500" />
      </div>
      <div>
        <h2 className="text-lg font-bold text-foreground">เกิดข้อผิดพลาด</h2>
        <p className="text-sm text-muted-foreground mt-1 max-w-md">
          {error.message || "ไม่สามารถโหลดหน้านี้ได้"}
        </p>
        {error.digest && (
          <p className="text-xs text-muted-foreground/60 mt-1 font-mono">
            digest: {error.digest}
          </p>
        )}
        {/* Show stack in dev only */}
        {process.env.NODE_ENV === "development" && error.stack && (
          <pre className="mt-4 text-left text-xs bg-muted rounded-lg p-4 overflow-auto max-h-60 max-w-2xl text-rose-600 dark:text-rose-400">
            {error.stack}
          </pre>
        )}
      </div>
      <button
        onClick={reset}
        className="px-4 py-2 rounded-lg bg-brand-500 text-white text-sm font-medium
          hover:bg-brand-600 transition-colors"
      >
        ลองใหม่
      </button>
    </div>
  )
}
