/**
 * Copyright © 2026 SolutionX Co., Ltd. (บริษัท โซลูชั่น เอ็กซ์ จำกัด)
 * All rights reserved.
 *
 * This software is proprietary and confidential.
 * Unauthorized copying, modification, distribution, or use of this software,
 * in whole or in part, is strictly prohibited without prior written permission.
 */

import { getMembership }  from "@/lib/get-membership"
import { createClient }   from "@/lib/supabase/server"
import { LineStudioClient } from "@/components/line-studio/line-studio-client"

export default async function LineStudioPage() {
  const { organization_id: orgId } = await getMembership()
  const supabase = await createClient()

  const now          = new Date()
  const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1).toISOString()

  const [
    { data: lineConns },
    { data: lineActivity },
    { data: lineMonthlyRaw },
    { count: slipTotal },
    { data: members },
  ] = await Promise.all([
    // LINE connections with user info
    supabase
      .from("line_connections")
      .select("id, line_user_id, display_name, created_at, user_id, users(full_name, email)")
      .eq("organization_id", orgId)
      .order("created_at", { ascending: false }),

    // Recent LINE documents for activity feed
    supabase
      .from("documents")
      .select("id, vendor_name, total_amount, status, created_at, doc_type")
      .eq("organization_id", orgId)
      .eq("source", "line")
      .order("created_at", { ascending: false })
      .limit(10),

    // Monthly LINE docs for bar chart (last 6 months)
    supabase
      .from("documents")
      .select("created_at")
      .eq("organization_id", orgId)
      .eq("source", "line")
      .gte("created_at", sixMonthsAgo),

    // Total LINE documents count
    supabase
      .from("documents")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", orgId)
      .eq("source", "line"),

    // Member roles
    supabase
      .from("organization_members")
      .select("user_id, role")
      .eq("organization_id", orgId),
  ])

  /* ── Build role map ── */
  const roleMap = new Map<string, string>()
  for (const m of members ?? []) roleMap.set(m.user_id, m.role)

  /* ── Connected accounts ── */
  const connectedAccounts = (lineConns ?? []).map((conn: any) => ({
    id:          conn.id,
    displayName: conn.display_name ?? "LINE User",
    lineUserId:  conn.line_user_id,
    linkedEmail: (conn.users as any)?.email ?? "—",
    role:        roleMap.get(conn.user_id) ?? "member",
    connectedAt: conn.created_at,
    lastActive:  conn.created_at,
  }))

  /* ── Activity feed ── */
  const activity = (lineActivity ?? []).map((doc: any) => ({
    id:         doc.id,
    vendorName: doc.vendor_name ?? "เอกสาร LINE",
    amount:     doc.total_amount as number | null,
    status:     doc.status as string,
    createdAt:  doc.created_at as string,
    docType:    doc.doc_type as string,
  }))

  /* ── Monthly series (last 6 months) ── */
  const monthLabels: { key: string; label: string }[] = []
  const monthlyMap  = new Map<string, number>()

  for (let i = 5; i >= 0; i--) {
    const d     = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const key   = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
    const label = d.toLocaleDateString("th-TH", { month: "short" })
    monthLabels.push({ key, label })
    monthlyMap.set(key, 0)
  }
  for (const doc of lineMonthlyRaw ?? []) {
    const d   = new Date(doc.created_at)
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
    if (monthlyMap.has(key)) monthlyMap.set(key, (monthlyMap.get(key) ?? 0) + 1)
  }
  const monthlySeries = monthLabels.map(({ key, label }) => ({
    m: label,
    n: monthlyMap.get(key) ?? 0,
  }))

  return (
    <LineStudioClient
      orgId={orgId}
      connectedAccounts={connectedAccounts}
      activity={activity}
      monthlySeries={monthlySeries}
      slipTotal={slipTotal ?? 0}
    />
  )
}
