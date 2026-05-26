/**
 * Copyright © 2026 SolutionX Co., Ltd. (บริษัท โซลูชั่น เอ็กซ์ จำกัด)
 * All rights reserved.
 *
 * This software is proprietary and confidential.
 * Unauthorized copying, modification, distribution, or use of this software,
 * in whole or in part, is strictly prohibited without prior written permission.
 */

import { getMembership } from "@/lib/get-membership"
import { TaxPageClient } from "@/components/tax/tax-page-client"

export default async function TaxPage() {
  const { organization_id: orgId } = await getMembership()
  return <TaxPageClient orgId={orgId} />
}
