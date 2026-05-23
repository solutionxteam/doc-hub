import type { FastifyInstance } from "fastify"
import { supabase } from "../lib/supabase"
import ExcelJS from "exceljs"

export async function taxRoutes(app: FastifyInstance) {

  // GET /tax/vat?orgId=&year=&month=
  app.get<{
    Querystring: { orgId: string; year: string; month: string }
  }>("/vat", async (req, reply) => {
    const { orgId, year, month } = req.query

    const { data } = await supabase.rpc("get_vat_report", {
      p_org_id: orgId,
      p_year:   parseInt(year),
      p_month:  parseInt(month),
    })

    const input  = data?.find((r: any) => r.vat_type === "input")  ?? {}
    const output = data?.find((r: any) => r.vat_type === "output") ?? {}

    const inputVat  = Number(input.vat_amount  ?? 0)
    const outputVat = Number(output.vat_amount ?? 0)
    const netVat    = outputVat - inputVat

    return {
      input:      { base: Number(input.base_amount ?? 0),  vat: inputVat,  count: Number(input.doc_count  ?? 0) },
      output:     { base: Number(output.base_amount ?? 0), vat: outputVat, count: Number(output.doc_count ?? 0) },
      net_vat:    netVat,
      vat_payable: netVat > 0 ? netVat : 0,
      vat_refund:  netVat < 0 ? Math.abs(netVat) : 0,
      due_date:   getDueDate(parseInt(year), parseInt(month)),
    }
  })

  // GET /tax/wht?orgId=&year=&month=
  app.get<{
    Querystring: { orgId: string; year: string; month: string }
  }>("/wht", async (req, reply) => {
    const { orgId, year, month } = req.query

    const { data } = await supabase.rpc("get_wht_report", {
      p_org_id: orgId,
      p_year:   parseInt(year),
      p_month:  parseInt(month),
    })

    const items = data ?? []
    return {
      items,
      total_base: items.reduce((s: number, r: any) => s + Number(r.base_amount), 0),
      total_wht:  items.reduce((s: number, r: any) => s + Number(r.wht_amount), 0),
      due_date:   getDueDate(parseInt(year), parseInt(month)),
    }
  })

  // GET /tax/wht/export?orgId=&year=&month=&form=3|53
  app.get<{
    Querystring: { orgId: string; year: string; month: string; form: string }
  }>("/wht/export", async (req, reply) => {
    const { orgId, year, month, form } = req.query

    const { data: org } = await supabase
      .from("organizations")
      .select("name, tax_id")
      .eq("id", orgId)
      .single()

    const { data: items } = await supabase.rpc("get_wht_report", {
      p_org_id: orgId,
      p_year:   parseInt(year),
      p_month:  parseInt(month),
    })

    const wb = new ExcelJS.Workbook()
    const ws = wb.addWorksheet(`ภ.ง.ด.${form}`)

    ws.mergeCells("A1:H1")
    ws.getCell("A1").value = `แบบ ภ.ง.ด.${form} — ${org?.name} (${org?.tax_id})`
    ws.getCell("A1").font = { bold: true, size: 14 }
    ws.getCell("A1").alignment = { horizontal: "center" }

    ws.getRow(2).values = [
      "ลำดับ","ชื่อผู้ถูกหัก","เลขประจำตัวผู้เสียภาษี",
      "อัตรา WHT (%)","ยอดเงินได้","ภาษีที่หัก",
    ]
    ws.getRow(2).font = { bold: true }
    ws.getRow(2).fill = { type:"pattern", pattern:"solid", fgColor:{ argb:"FFE8E8FF" } };

    (items ?? []).forEach((item: any, i: number) => {
      ws.addRow([
        i + 1, item.vendor_name, item.vendor_tax_id,
        `${item.wht_rate}%`, Number(item.base_amount), Number(item.wht_amount),
      ])
    })

    const totalRow = ws.addRow([
      "","รวมทั้งสิ้น","","",
      (items ?? []).reduce((s: number, r: any) => s + Number(r.base_amount), 0),
      (items ?? []).reduce((s: number, r: any) => s + Number(r.wht_amount), 0),
    ])
    totalRow.font = { bold: true }

    ws.columns = [{ width:6 },{ width:30 },{ width:16 },{ width:12 },{ width:14 },{ width:12 }]
    for (let r = 3; r <= (items?.length ?? 0) + 3; r++) {
      ws.getRow(r).getCell(5).numFmt = "#,##0.00"
      ws.getRow(r).getCell(6).numFmt = "#,##0.00"
    }

    const buffer = await wb.xlsx.writeBuffer()
    reply.header("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
    reply.header("Content-Disposition", `attachment; filename="wht-${form}-${year}-${month}.xlsx"`)
    return reply.send(Buffer.from(buffer))
  })
}

function getDueDate(year: number, month: number): string {
  const due = new Date(year, month, 15)
  return due.toISOString().split("T")[0]
}
