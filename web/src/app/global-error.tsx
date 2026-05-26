"use client"

/**
 * Copyright © 2026 SolutionX Co., Ltd. (บริษัท โซลูชั่น เอ็กซ์ จำกัด)
 * All rights reserved.
 *
 * This software is proprietary and confidential.
 * Unauthorized copying, modification, distribution, or use of this software,
 * in whole or in part, is strictly prohibited without prior written permission.
 */

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <html>
      <body style={{ fontFamily: "sans-serif", textAlign: "center", padding: "4rem 2rem" }}>
        <h1 style={{ color: "#ef4444" }}>เกิดข้อผิดพลาดร้ายแรง</h1>
        <p style={{ color: "#6b7280" }}>{error.message}</p>
        {error.digest && (
          <p style={{ fontFamily: "monospace", fontSize: "0.75rem", color: "#9ca3af" }}>
            digest: {error.digest}
          </p>
        )}
        <pre style={{
          textAlign: "left", background: "#fef2f2", padding: "1rem",
          borderRadius: "0.5rem", overflow: "auto", maxHeight: "300px",
          fontSize: "0.75rem", color: "#dc2626", maxWidth: "700px", margin: "1rem auto"
        }}>
          {error.stack}
        </pre>
        <button
          onClick={reset}
          style={{
            background: "#6366f1", color: "white", border: "none",
            padding: "0.5rem 1.5rem", borderRadius: "0.5rem", cursor: "pointer"
          }}
        >
          ลองใหม่
        </button>
      </body>
    </html>
  )
}
