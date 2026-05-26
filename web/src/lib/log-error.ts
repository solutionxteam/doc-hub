/**
 * Copyright © 2026 SolutionX Co., Ltd. (บริษัท โซลูชั่น เอ็กซ์ จำกัด)
 * All rights reserved.
 *
 * This software is proprietary and confidential.
 * Unauthorized copying, modification, distribution, or use of this software,
 * in whole or in part, is strictly prohibited without prior written permission.
 */

/**
 * logClientError — ส่ง error จาก browser ไปเก็บใน client_error_logs
 *
 * ใช้งาน:
 *   await logClientError("heic_conversion", err, {
 *     file_name: file.name,
 *     file_size: file.size,
 *     strategy:  "createImageBitmap",
 *   })
 */
export async function logClientError(
  errorType: "heic_conversion" | "upload" | "camera" | "ocr" | "stripe" | "unknown",
  err: unknown,
  context?: Record<string, unknown>
): Promise<string | null> {
  // Normalise to an Error — handles plain objects like heic2any's
  // { code: 2, message: "ERR_LIBHEIF format not supported" }
  const e: Error = err instanceof Error
    ? err
    : (() => {
        const msg =
          typeof err === "string"
            ? err
            : (err != null && typeof err === "object" && "message" in err)
              ? String((err as Record<string, unknown>).message)
              : JSON.stringify(err) ?? "Unknown error"
        const built = new Error(msg)
        // Preserve extra fields (e.g. heic2any's `code`)
        if (err != null && typeof err === "object") {
          Object.assign(built, err)
        }
        return built
      })()

  // Use console.warn so the Next.js dev overlay doesn't treat
  // recoverable fallback errors as fatal red-screen events.
  console.warn(`[client-error][${errorType}]`, {
    name:    e.name,
    message: e.message,
    context,
  })

  // Collect browser context
  const browserContext: Record<string, unknown> = {
    browser_ua: typeof navigator !== "undefined" ? navigator.userAgent : "ssr",
    platform:   typeof navigator !== "undefined" ? navigator.platform   : "ssr",
    language:   typeof navigator !== "undefined" ? navigator.language   : "ssr",
    online:     typeof navigator !== "undefined" ? navigator.onLine     : null,
    ...context,
  }

  try {
    const res = await fetch("/api/errors", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        error_type:    errorType,
        error_name:    e.name,
        error_message: e.message,
        error_stack:   e.stack?.slice(0, 2000), // cap at 2KB
        context:       browserContext,
      }),
    })
    const json = await res.json()
    return json?.id ?? null
  } catch (fetchErr) {
    // Logging failed — don't throw, just warn
    console.warn("[logClientError] could not send to server:", fetchErr)
    return null
  }
}
