/**
 * FlowAccount REST API v2 HTTP client
 * Docs: https://www.flowaccount.com/api-docs
 */

const BASE_URL = "https://openapi.flowaccount.com/v1"

export interface FlowAccountContact {
  id:             string
  name:           string
  taxId:          string | null
  email:          string | null
  phone:          string | null
  address:        string | null
  contactType:    "SUPPLIER" | "CUSTOMER" | "BOTH"
}

export interface FlowAccountAccount {
  code: string
  name: string
  type: string
}

export interface FlowAccountExpense {
  contactId:   string
  referenceNo: string
  issueDate:   string           // YYYY-MM-DD
  dueDate?:    string
  note?:       string
  items:       FlowAccountExpenseItem[]
  vatType?:    "NO_VAT" | "VAT_INCLUDE" | "VAT_EXCLUDE"
}

export interface FlowAccountExpenseItem {
  description:   string
  quantity:      number
  unitPrice:     number
  taxRate?:      number          // e.g. 7
  accountCode:   string
  whtRate?:      number          // e.g. 3
}

export class FlowAccountClient {
  private token: string

  constructor(apiKey: string) {
    this.token = apiKey
  }

  // ── Contacts ────────────────────────────────────────────────────────────────

  async getContacts(params?: { name?: string; taxId?: string; page?: number }): Promise<FlowAccountContact[]> {
    const qs = new URLSearchParams()
    if (params?.name)  qs.set("name",  params.name)
    if (params?.taxId) qs.set("taxId", params.taxId)
    if (params?.page)  qs.set("page",  String(params.page))

    const data = await this.request<{ data: FlowAccountContact[] }>(
      `GET`, `/contacts/suppliers?${qs}`
    )
    return data.data ?? []
  }

  async createContact(contact: Omit<FlowAccountContact, "id">): Promise<FlowAccountContact> {
    return this.request<FlowAccountContact>("POST", "/contacts", contact)
  }

  // ── Chart of Accounts ────────────────────────────────────────────────────────

  async getAccounts(): Promise<FlowAccountAccount[]> {
    const data = await this.request<{ data: FlowAccountAccount[] }>("GET", "/accounts")
    return data.data ?? []
  }

  // ── Expenses (Purchase Invoices) ─────────────────────────────────────────────

  async createExpense(expense: FlowAccountExpense): Promise<{ id: string; referenceNo: string }> {
    return this.request("POST", "/expenses/purchase-invoices", expense)
  }

  async getExpense(id: string): Promise<unknown> {
    return this.request("GET", `/expenses/purchase-invoices/${id}`)
  }

  // ── Generic ──────────────────────────────────────────────────────────────────

  private async request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const url = `${BASE_URL}${path}`
    const res = await fetch(url, {
      method,
      headers: {
        "Authorization": `Bearer ${this.token}`,
        "Content-Type":  "application/json",
        "Accept":        "application/json",
      },
      body: body ? JSON.stringify(body) : undefined,
    })

    if (!res.ok) {
      const text = await res.text().catch(() => res.statusText)
      throw new Error(`FlowAccount API ${method} ${path} → ${res.status}: ${text}`)
    }

    return res.json() as T
  }
}
