/**
 * Copyright © 2026 SolutionX Co., Ltd. (บริษัท โซลูชั่น เอ็กซ์ จำกัด)
 * All rights reserved.
 *
 * This software is proprietary and confidential.
 * Unauthorized copying, modification, distribution, or use of this software,
 * in whole or in part, is strictly prohibited without prior written permission.
 */

import { getRequestConfig } from "next-intl/server"
import { cookies } from "next/headers"

export const locales = ["en", "th"] as const
export type Locale = (typeof locales)[number]
export const defaultLocale: Locale = "th"

export default getRequestConfig(async () => {
  const cookieStore = await cookies()
  const locale = (cookieStore.get("locale")?.value ?? defaultLocale) as Locale
  const validLocale = locales.includes(locale) ? locale : defaultLocale

  return {
    locale: validLocale,
    messages: (await import(`../messages/${validLocale}.json`)).default,
  }
})
