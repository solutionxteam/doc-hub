import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatThb(amount: number | null | undefined): string {
  if (amount == null) return "—"
  return new Intl.NumberFormat("th-TH", {
    style: "currency",
    currency: "THB",
    minimumFractionDigits: 2,
  }).format(amount)
}

export function formatNumber(n: number | null | undefined): string {
  if (n == null) return "—"
  return new Intl.NumberFormat("th-TH").format(n)
}

export function formatDate(date: string | Date | null | undefined, locale = "th"): string {
  if (!date) return "—"
  return new Intl.DateTimeFormat(locale === "th" ? "th-TH" : "en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(date))
}

export function formatMonth(date: string | Date, locale = "th"): string {
  return new Intl.DateTimeFormat(locale === "th" ? "th-TH" : "en-GB", {
    month: "short",
    year: "numeric",
  }).format(new Date(date))
}

export function confidenceColor(score: number): string {
  if (score >= 0.9) return "text-emerald-600 dark:text-emerald-400"
  if (score >= 0.7) return "text-amber-600 dark:text-amber-400"
  return "text-red-600 dark:text-red-400"
}

export function confidenceBg(score: number): string {
  if (score >= 0.9) return "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
  if (score >= 0.7) return "bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
  return "bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-400"
}

export function statusColor(status: string): string {
  const map: Record<string, string> = {
    pending:    "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400",
    processing: "bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400",
    reviewing:  "bg-amber-50 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400",
    approved:   "bg-emerald-50 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400",
    pushed:     "bg-indigo-50 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400",
    failed:     "bg-red-50 text-red-600 dark:bg-red-900/30 dark:text-red-400",
    rejected:   "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-500",
    flagged:    "bg-orange-50 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400",
  }
  return map[status] ?? map.pending
}

export function truncate(str: string, length = 40): string {
  return str.length > length ? str.slice(0, length) + "…" : str
}

export function slugify(str: string): string {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .trim()
}
