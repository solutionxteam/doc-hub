import React from 'react'
import { render, waitFor, act } from '@testing-library/react-native'
import DashboardScreen from '../../src/app/(app)/index'
import { useAuthStore } from '../../src/store/auth.store'
import { supabase } from '../../src/lib/supabase'

jest.mock('../../src/store/auth.store')
jest.mock('../../src/lib/supabase')

const mockUseAuthStore = useAuthStore as jest.MockedFunction<typeof useAuthStore>
const mockSupabase     = supabase  as jest.Mocked<typeof supabase>

const MOCK_ORG = {
  id: 'org-1', name: 'บริษัท เอบีซี จำกัด',
  plan: 'pro', doc_quota: 1000, doc_used: 47, role: 'owner',
}
const MOCK_PROFILE = { full_name: 'นภัทร เจริญพร', avatar_url: null }
const MOCK_DOCS = [
  { id: 'd1', vendor_name: 'Amazon Web Services', total_amount: 8750, status: 'pushed',    created_at: new Date().toISOString(), category: 'ค่า Software / Cloud' },
  { id: 'd2', vendor_name: 'Grab (Thailand)',     total_amount: 450,  status: 'reviewing', created_at: new Date().toISOString(), category: 'ค่าเดินทาง' },
]
const MOCK_MONTH_DOCS = [
  { total_amount: 8750, vat_amount: 571.96, status: 'pushed' },
  { total_amount: 450,  vat_amount: 29.44,  status: 'reviewing' },
  { total_amount: 285,  vat_amount: 18.64,  status: 'approved' },
]

beforeEach(() => {
  jest.clearAllMocks()
  ;(mockUseAuthStore as any).mockReturnValue({ org: MOCK_ORG, profile: MOCK_PROFILE })

  // Supabase chain mock
  const chainMock = {
    select: jest.fn().mockReturnThis(),
    eq:     jest.fn().mockReturnThis(),
    order:  jest.fn().mockReturnThis(),
    limit:  jest.fn().mockReturnThis(),
    like:   jest.fn().mockReturnThis(),
  }
  ;(mockSupabase.from as jest.Mock).mockReturnValue(chainMock)
  chainMock.limit
    .mockResolvedValueOnce({ data: MOCK_DOCS })
    .mockResolvedValueOnce({ data: MOCK_MONTH_DOCS })
})

describe('DashboardScreen', () => {
  it('renders greeting with user name', async () => {
    const { findByText } = render(<DashboardScreen />)
    const greeting = await findByText(/สวัสดี.*นภัทร/)
    expect(greeting).toBeTruthy()
  })

  it('renders organization name', async () => {
    const { findByText } = render(<DashboardScreen />)
    const orgName = await findByText('บริษัท เอบีซี จำกัด')
    expect(orgName).toBeTruthy()
  })

  it('shows stats cards after loading', async () => {
    const { getByTestId } = render(<DashboardScreen />)
    await waitFor(() => {
      expect(getByTestId('stat-docs')).toBeTruthy()
      expect(getByTestId('stat-total')).toBeTruthy()
      expect(getByTestId('stat-vat')).toBeTruthy()
      expect(getByTestId('stat-review')).toBeTruthy()
    })
  })

  it('renders document rows', async () => {
    const { findByTestId } = render(<DashboardScreen />)
    const row1 = await findByTestId('doc-row-d1')
    expect(row1).toBeTruthy()
  })

  it('shows quick upload button', async () => {
    const { findByTestId } = render(<DashboardScreen />)
    const btn = await findByTestId('quick-upload-btn')
    expect(btn).toBeTruthy()
  })

  it('shows loading indicator initially', () => {
    const { queryByTestId } = render(<DashboardScreen />)
    // stats-row not yet visible during loading
    expect(queryByTestId('stats-row')).toBeNull()
  })

  it('handles empty org gracefully', () => {
    ;(mockUseAuthStore as any).mockReturnValue({ org: null, profile: null })
    const { queryByTestId } = render(<DashboardScreen />)
    // Should not crash
    expect(queryByTestId('dashboard-scroll')).toBeTruthy()
  })
})
