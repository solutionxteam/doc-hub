/**
 * Turns a fetch failure against the internal api into something actionable.
 *
 * `fetch` reports a refused connection as the bare string "fetch failed", which
 * says nothing about the api service being down — and "api service is not
 * running" is by far the most common reason any of these routes fails on a dev
 * machine, ahead of anything to do with the feature itself.
 */
export function internalApiError(err: unknown, what: string, url: string): string {
  if (err instanceof Error && err.name === "TimeoutError") {
    return `${what}นานเกินไป`
  }
  const msg = err instanceof Error ? err.message : String(err)
  if (/fetch failed|ECONNREFUSED|ENOTFOUND|EAI_AGAIN|network/i.test(msg)) {
    return `ติดต่อ API service ไม่ได้ (${url}) — ตรวจว่าเซอร์วิสรันอยู่ และ INTERNAL_API_URL ถูกต้อง`
  }
  return `${what}ไม่สำเร็จ: ${msg}`
}
