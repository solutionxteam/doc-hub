/**
 * Copyright © 2026 SolutionX Co., Ltd. (บริษัท โซลูชั่น เอ็กซ์ จำกัด)
 * All rights reserved.
 *
 * This software is proprietary and confidential.
 * Unauthorized copying, modification, distribution, or use of this software,
 * in whole or in part, is strictly prohibited without prior written permission.
 */

"use client"

import { useState, useMemo, useCallback } from "react"
import { toast }                          from "sonner"
import { cn }                             from "@/lib/utils"
import { Icons }                          from "@/components/ui/icons"
import type { Product, AffiliateLink }    from "@/app/(app)/shop/page"

/* ─── Types ──────────────────────────────────────────────────── */
type Props = {
  products:       Product[]
  affiliateLinks: AffiliateLink[]
}

type ModalState =
  | { open: false }
  | { open: true; product: Product; link: AffiliateLink | null; loading: boolean }

/* ─── Constants ──────────────────────────────────────────────── */
const CATEGORIES = [
  { value: "all",        label: "ทั้งหมด"    },
  { value: "health",     label: "สุขภาพ"     },
  { value: "finance",    label: "การเงิน"    },
  { value: "food",       label: "อาหาร"      },
  { value: "supplement", label: "ซัพพลีเมนต์" },
  { value: "fitness",    label: "ฟิตเนส"     },
]

const TAG_COLORS: Record<string, string> = {
  organic:     "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300",
  vegan:       "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300",
  "sugar-free": "bg-sky-100 dark:bg-sky-900/30 text-sky-700 dark:text-sky-300",
  protein:     "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300",
  probiotic:   "bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300",
  collagen:    "bg-pink-100 dark:bg-pink-900/30 text-pink-700 dark:text-pink-300",
}
function tagColor(tag: string) {
  return TAG_COLORS[tag.toLowerCase()] ?? "bg-muted text-muted-foreground"
}

/* ─── ProductCard ────────────────────────────────────────────── */
function ProductCard({
  product,
  hasLink,
  onGetLink,
}: {
  product:  Product
  hasLink:  boolean
  onGetLink: (product: Product) => void
}) {
  return (
    <div className="bg-card border border-border rounded-[14px] overflow-hidden hover:shadow-md transition-shadow duration-200 flex flex-col">
      {/* Image placeholder */}
      <div className="aspect-square bg-gradient-to-br from-violet-50 to-indigo-100 dark:from-violet-950/30 dark:to-indigo-950/30 flex items-center justify-center relative overflow-hidden">
        {product.image_url ? (
          <img
            src={product.image_url}
            alt={product.name}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="flex flex-col items-center gap-2 text-violet-400 dark:text-violet-600">
            <Icons.ShoppingBag size={36} />
            <span className="text-xs font-medium">{product.category ?? "สินค้า"}</span>
          </div>
        )}
        {/* Commission badge */}
        <div className="absolute top-2 right-2 bg-gradient-to-r from-violet-600 to-indigo-600 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
          {product.commission_rate}% คอมฯ
        </div>
      </div>

      {/* Content */}
      <div className="p-3 flex flex-col gap-2 flex-1">
        <div>
          <h3 className="text-sm font-semibold text-foreground line-clamp-2 leading-snug">{product.name}</h3>
          {product.description && (
            <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5 leading-relaxed">{product.description}</p>
          )}
        </div>

        {/* Health tags */}
        {product.health_tags.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {product.health_tags.slice(0, 3).map(tag => (
              <span key={tag} className={cn("text-[10px] font-medium px-1.5 py-0.5 rounded-full", tagColor(tag))}>
                {tag}
              </span>
            ))}
          </div>
        )}

        {/* Price + button */}
        <div className="mt-auto pt-2 border-t border-border flex items-center justify-between gap-2">
          <span className="text-sm font-bold text-foreground">
            ฿{product.price.toLocaleString("th-TH")}
          </span>
          <button
            onClick={() => onGetLink(product)}
            className={cn(
              "text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors shrink-0",
              hasLink
                ? "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-200 dark:hover:bg-emerald-900/50"
                : "bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white"
            )}
          >
            {hasLink ? "🔗 ดูลิงก์" : "รับ affiliate link"}
          </button>
        </div>
      </div>
    </div>
  )
}

/* ─── AffiliateModal ─────────────────────────────────────────── */
function AffiliateModal({ modal, onClose }: {
  modal:   ModalState
  onClose: () => void
}) {
  if (!modal.open) return null
  const { product, link, loading } = modal

  const affiliateUrl = link
    ? `${typeof window !== "undefined" ? window.location.origin : ""}/go/${link.code}`
    : null

  const copyLink = () => {
    if (!affiliateUrl) return
    navigator.clipboard.writeText(affiliateUrl).then(() => {
      toast.success("คัดลอกลิงก์แล้ว!")
    })
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm p-4"
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="bg-card border border-border rounded-[14px] w-full max-w-md p-5 space-y-4 shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-base font-bold text-foreground">Affiliate Link</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <Icons.X size={18} />
          </button>
        </div>

        {/* Product info */}
        <div className="flex items-center gap-3 p-3 bg-muted rounded-xl">
          <div className="w-10 h-10 bg-gradient-to-br from-violet-100 to-indigo-100 dark:from-violet-900/30 dark:to-indigo-900/30 rounded-lg flex items-center justify-center shrink-0">
            <Icons.ShoppingBag size={20} className="text-violet-500" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-foreground truncate">{product.name}</p>
            <p className="text-xs text-muted-foreground">฿{product.price.toLocaleString("th-TH")}</p>
          </div>
          <span className="shrink-0 text-xs font-bold text-violet-600 dark:text-violet-400 bg-violet-100 dark:bg-violet-900/30 px-2 py-1 rounded-lg">
            {product.commission_rate}% คอมฯ
          </span>
        </div>

        {loading ? (
          <div className="py-6 text-center">
            <Icons.Loader size={24} className="text-violet-500 mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">กำลังสร้างลิงก์...</p>
          </div>
        ) : link && affiliateUrl ? (
          <>
            {/* Link box */}
            <div className="space-y-2">
              <p className="text-xs font-medium text-foreground">ลิงก์ affiliate ของคุณ</p>
              <div className="flex gap-2">
                <input
                  readOnly
                  value={affiliateUrl}
                  className="flex-1 bg-muted border border-border rounded-xl px-3 py-2 text-xs text-foreground font-mono focus:outline-none"
                />
                <button
                  onClick={copyLink}
                  className="shrink-0 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white text-xs font-semibold px-3 py-2 rounded-xl transition-all flex items-center gap-1.5"
                >
                  <Icons.Copy size={13} />
                  คัดลอก
                </button>
              </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-2 pt-1">
              {[
                { label: "คลิก",    value: link.clicks.toLocaleString("th-TH")      },
                { label: "Conversion", value: link.conversions.toLocaleString("th-TH") },
                { label: "รายได้",  value: `฿${link.earnings.toLocaleString("th-TH")}` },
              ].map(stat => (
                <div key={stat.label} className="bg-muted rounded-xl p-2.5 text-center">
                  <p className="text-sm font-bold text-foreground">{stat.value}</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">{stat.label}</p>
                </div>
              ))}
            </div>

            <p className="text-xs text-muted-foreground text-center">
              แชร์ลิงก์นี้ รับ {product.commission_rate}% จากทุกการซื้อ
            </p>
          </>
        ) : (
          <div className="py-4 text-center">
            <p className="text-sm text-muted-foreground">ไม่สามารถสร้างลิงก์ได้ กรุณาลองใหม่</p>
          </div>
        )}

        <button
          onClick={onClose}
          className="w-full py-2.5 rounded-xl text-sm font-semibold bg-muted hover:bg-muted/80 text-foreground transition-colors"
        >
          ปิด
        </button>
      </div>
    </div>
  )
}

/* ─── ShopClient ─────────────────────────────────────────────── */
export function ShopClient({ products, affiliateLinks }: Props) {
  const [search,   setSearch]   = useState("")
  const [category, setCategory] = useState("all")
  const [modal,    setModal]    = useState<ModalState>({ open: false })

  const linksByProductId = useMemo(
    () => Object.fromEntries(affiliateLinks.map(l => [l.product_id, l])),
    [affiliateLinks]
  )

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    return products.filter(p => {
      const matchCat = category === "all" || (p.category ?? "").toLowerCase() === category
      const matchQ   = !q || p.name.toLowerCase().includes(q) || (p.description ?? "").toLowerCase().includes(q)
      return matchCat && matchQ
    })
  }, [products, search, category])

  const handleGetLink = useCallback(async (product: Product) => {
    const existing = linksByProductId[product.id]
    if (existing) {
      setModal({ open: true, product, link: existing, loading: false })
      return
    }
    setModal({ open: true, product, link: null, loading: true })
    try {
      const res = await fetch("/api/affiliate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId: product.id }),
      })
      if (!res.ok) throw new Error("failed")
      const data: AffiliateLink = await res.json()
      linksByProductId[product.id] = data
      setModal({ open: true, product, link: data, loading: false })
      toast.success("สร้าง affiliate link สำเร็จ!")
    } catch {
      setModal({ open: true, product, link: null, loading: false })
      toast.error("เกิดข้อผิดพลาด กรุณาลองใหม่")
    }
  }, [linksByProductId])

  return (
    <>
      <div className="max-w-5xl mx-auto px-4 py-6 space-y-6 animate-fade-in">
        {/* Header — Financial Marketplace (BUSINESS_MODEL.md: 20-30% revenue) */}
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <h1 className="text-xl font-bold bg-gradient-to-r from-violet-600 to-indigo-600 bg-clip-text text-transparent">
                Financial Marketplace
              </h1>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-violet-100 dark:bg-violet-500/10 text-violet-600 dark:text-violet-400 font-semibold">BETA</span>
            </div>
            <p className="text-sm text-muted-foreground">
              ผลิตภัณฑ์ทางการเงินที่เลือกสรรมาเพื่อคุณ · Insurance · Credit · Investments · รับ Affiliate
            </p>
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full border border-border bg-card">
              💰 Commission 5–30%
            </span>
          </div>
        </div>
        {/* Marketplace categories from BUSINESS_MODEL.md */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          {[
            { icon: "🛡️", label: "Insurance",   sub: "ประกันภัย" },
            { icon: "💳", label: "Credit",      sub: "บัตรเครดิต" },
            { icon: "🏦", label: "Loans",       sub: "สินเชื่อ" },
            { icon: "📈", label: "Investments", sub: "การลงทุน" },
            { icon: "✈️", label: "Travel",      sub: "ท่องเที่ยว" },
          ].map(c => (
            <button key={c.label}
              className="flex flex-col items-center gap-1.5 p-3 rounded-xl border border-border bg-card hover:bg-muted/50 transition-colors">
              <span className="text-2xl">{c.icon}</span>
              <span className="text-[11px] font-semibold">{c.label}</span>
              <span className="text-[10px] text-muted-foreground">{c.sub}</span>
            </button>
          ))}
        </div>

        {/* Search + filter */}
        <div className="space-y-3">
          <div className="relative">
            <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none">
              <Icons.Search size={16} />
            </span>
            <input
              type="text"
              placeholder="ค้นหาสินค้า..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full bg-card border border-border rounded-xl pl-10 pr-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-violet-400"
            />
          </div>

          {/* Category pills */}
          <div className="flex gap-2 flex-wrap">
            {CATEGORIES.map(cat => (
              <button
                key={cat.value}
                onClick={() => setCategory(cat.value)}
                className={cn(
                  "text-xs font-medium px-3.5 py-1.5 rounded-full border transition-colors",
                  category === cat.value
                    ? "bg-gradient-to-r from-violet-600 to-indigo-600 text-white border-transparent"
                    : "bg-card border-border text-muted-foreground hover:text-foreground hover:border-violet-400"
                )}
              >
                {cat.label}
              </button>
            ))}
          </div>
        </div>

        {/* Product grid / empty state */}
        {products.length === 0 ? (
          <div className="text-center py-16 space-y-4 border-2 border-dashed border-border rounded-[14px]">
            <Icons.ShoppingBag size={40} className="text-violet-400 mx-auto" />
            <div>
              <p className="text-base font-semibold text-foreground">กำลังเพิ่มสินค้าเร็วๆ นี้</p>
              <p className="text-sm text-muted-foreground mt-1">คุณสามารถเป็น merchant คนแรกได้!</p>
            </div>
            <a
              href="/shop/merchant-signup"
              className="inline-flex items-center gap-1.5 mt-2 text-sm font-semibold bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white px-5 py-2.5 rounded-xl transition-all"
            >
              สมัครเป็น Merchant →
            </a>
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12 space-y-2">
            <Icons.Search size={32} className="text-muted-foreground mx-auto" />
            <p className="text-sm font-semibold text-foreground">ไม่พบสินค้าที่ตรงกัน</p>
            <button
              onClick={() => { setSearch(""); setCategory("all") }}
              className="text-xs text-violet-600 dark:text-violet-400 hover:underline font-medium"
            >
              ล้างตัวกรอง
            </button>
          </div>
        ) : (
          <>
            <p className="text-xs text-muted-foreground -mt-2">
              พบ {filtered.length} สินค้า
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
              {filtered.map(product => (
                <ProductCard
                  key={product.id}
                  product={product}
                  hasLink={!!linksByProductId[product.id]}
                  onGetLink={handleGetLink}
                />
              ))}
            </div>
          </>
        )}
      </div>

      {/* Affiliate modal */}
      <AffiliateModal
        modal={modal}
        onClose={() => setModal({ open: false })}
      />
    </>
  )
}
