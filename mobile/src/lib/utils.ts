/** Format Thai baht */
export function fmtTHB(amount: number, decimals = 0): string {
  return '฿' + amount.toLocaleString('th-TH', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })
}

/** Relative time in Thai */
export function relTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const m = diff / 60_000
  if (m < 1)  return 'เมื่อกี้'
  if (m < 60) return `${Math.round(m)} นาทีที่แล้ว`
  const h = m / 60
  if (h < 24) return `${Math.round(h)} ชม.ที่แล้ว`
  const d = h / 24
  if (d < 7)  return `${Math.round(d)} วันที่แล้ว`
  return new Date(iso).toLocaleDateString('th-TH', { day: 'numeric', month: 'short' })
}

/** Thai date format */
export function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString('th-TH', {
    day: 'numeric', month: 'short', year: '2-digit',
  })
}

/** Initials from full name */
export function initials(name: string): string {
  return name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
}

/** Clamp a number */
export function clamp(n: number, min: number, max: number): number {
  return Math.min(Math.max(n, min), max)
}

/** VAT calculation (Thai 7%) */
export function calcVAT(total: number) {
  const vat = Math.round(total * 700 / 107) / 100
  const net = Math.round(total * 10000 / 107) / 100
  return { vat, net }
}
