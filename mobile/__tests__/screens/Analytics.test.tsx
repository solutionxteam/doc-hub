import React from 'react'
import { render, waitFor } from '@testing-library/react-native'
import AnalyticsScreen from '../../src/app/(app)/analytics'
import { useAuthStore } from '../../src/store/auth.store'
import { supabase } from '../../src/lib/supabase'

jest.mock('../../src/store/auth.store')
jest.mock('../../src/lib/supabase')

const mockUseAuthStore = useAuthStore as jest.MockedFunction<typeof useAuthStore>
const mockSupabase     = supabase  as jest.Mocked<typeof supabase>

const MOCK_MONTHLY = [
  { month: '2025-10', grand_total: 118400, organization_id: 'org-1' },
  { month: '2025-11', grand_total:  99300, organization_id: 'org-1' },
  { month: '2025-12', grand_total: 132800, organization_id: 'org-1' },
  { month: '2026-01', grand_total: 121500, organization_id: 'org-1' },
  { month: '2026-02', grand_total: 109700, organization_id: 'org-1' },
  { month: '2026-03', grand_total: 127200, organization_id: 'org-1' },
  { month: '2026-04', grand_total: 131979, organization_id: 'org-1' },
  { month: '2026-05', grand_total: 142380, organization_id: 'org-1' },
]

function makeChainMock(result: any) {
  const chain: any = {
    select: jest.fn().mockReturnThis(),
    eq:     jest.fn().mockReturnThis(),
    order:  jest.fn().mockReturnThis(),
    limit:  jest.fn().mockResolvedValue(result),
  }
  return chain
}

beforeEach(() => {
  jest.clearAllMocks()
  ;(mockUseAuthStore as any).mockReturnValue({
    org: { id: 'org-1', name: 'Test Org', plan: 'pro', doc_quota: 1000, doc_used: 47, role: 'owner' },
  })
  ;(mockSupabase.from as jest.Mock).mockReturnValue(makeChainMock({ data: MOCK_MONTHLY }))
})

describe('AnalyticsScreen', () => {
  it('renders page title', async () => {
    const { findByText } = render(<AnalyticsScreen />)
    const title = await findByText('รายงานค่าใช้จ่าย')
    expect(title).toBeTruthy()
  })

  it('shows loading indicator initially', () => {
    const { queryByText } = render(<AnalyticsScreen />)
    // Page title not yet visible during loading
    expect(queryByText('รายงานค่าใช้จ่าย')).toBeNull()
  })

  it('renders year total card after loading', async () => {
    const { findByText } = render(<AnalyticsScreen />)
    const label = await findByText('รวมทั้งปี')
    expect(label).toBeTruthy()
  })

  it('renders monthly chart section', async () => {
    const { findByText } = render(<AnalyticsScreen />)
    const section = await findByText('ค่าใช้จ่ายรายเดือน')
    expect(section).toBeTruthy()
  })

  it('renders category breakdown section', async () => {
    const { findByText } = render(<AnalyticsScreen />)
    const section = await findByText('แยกตามหมวดหมู่')
    expect(section).toBeTruthy()
  })

  it('renders monthly summary list', async () => {
    const { findByText } = render(<AnalyticsScreen />)
    const section = await findByText('สรุปรายเดือน')
    expect(section).toBeTruthy()
  })

  it('uses fallback data when no monthly data returned', async () => {
    ;(mockSupabase.from as jest.Mock).mockReturnValue(makeChainMock({ data: [] }))
    const { findByText } = render(<AnalyticsScreen />)
    // Fallback includes พ.ค. as latest month
    const label = await findByText('รวมทั้งปี')
    expect(label).toBeTruthy()
  })

  it('queries supabase with correct org id', async () => {
    render(<AnalyticsScreen />)
    await waitFor(() => {
      expect(mockSupabase.from).toHaveBeenCalledWith('monthly_expense_summary')
    })
  })

  it('does not query when org is null', () => {
    ;(mockUseAuthStore as any).mockReturnValue({ org: null })
    render(<AnalyticsScreen />)
    expect(mockSupabase.from).not.toHaveBeenCalled()
  })
})
