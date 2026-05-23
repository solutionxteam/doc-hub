import { createClient }         from "../../lib/supabase"
import { FlowAccountClient }    from "./client"
import type { FlowAccountContact } from "./client"

/**
 * Resolve or create a FlowAccount supplier contact for a vendor.
 *
 * Strategy:
 *  1. Check local cache (integration_contacts table) by tax_id or name
 *  2. Search FlowAccount API by tax_id → name
 *  3. Create new contact if not found
 *  4. Cache the result
 */
export async function resolveContact(
  client:         FlowAccountClient,
  integrationId:  string,
  vendorName:     string,
  vendorTaxId?:   string | null,
): Promise<string /* FlowAccount contact ID */> {
  const supabase = createClient()

  // ── 1. Check local cache ───────────────────────────────────────────────────
  if (vendorTaxId) {
    const { data: cached } = await supabase
      .from("integration_contacts")
      .select("external_id")
      .eq("integration_id", integrationId)
      .eq("tax_id",         vendorTaxId)
      .maybeSingle()

    if (cached?.external_id) {
      return cached.external_id
    }
  }

  // Also try name-based cache
  const { data: cachedByName } = await supabase
    .from("integration_contacts")
    .select("external_id")
    .eq("integration_id", integrationId)
    .ilike("name",        vendorName.trim())
    .maybeSingle()

  if (cachedByName?.external_id) {
    return cachedByName.external_id
  }

  // ── 2. Search FlowAccount API ──────────────────────────────────────────────
  let contact: FlowAccountContact | null = null

  // Try by tax ID first (most reliable)
  if (vendorTaxId) {
    const results = await client.getContacts({ taxId: vendorTaxId })
    contact = results[0] ?? null
  }

  // Fallback to name search
  if (!contact) {
    const results = await client.getContacts({ name: vendorName.trim() })
    contact = results[0] ?? null
  }

  // ── 3. Create if not found ─────────────────────────────────────────────────
  if (!contact) {
    contact = await client.createContact({
      name:        vendorName.trim(),
      taxId:       vendorTaxId ?? null,
      email:       null,
      phone:       null,
      address:     null,
      contactType: "SUPPLIER",
    })
  }

  // ── 4. Cache for future calls ──────────────────────────────────────────────
  await supabase.from("integration_contacts").upsert(
    {
      integration_id: integrationId,
      external_id:    contact.id,
      name:           contact.name,
      tax_id:         contact.taxId ?? null,
      raw_data:       contact,
      updated_at:     new Date().toISOString(),
    },
    { onConflict: "integration_id,external_id" }
  )

  return contact.id
}
