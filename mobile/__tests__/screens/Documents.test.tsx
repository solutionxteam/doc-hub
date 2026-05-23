import React from 'react'
import { render, fireEvent, waitFor } from '@testing-library/react-native'
import DocumentsScreen from '../../src/app/(app)/documents/index'
import { useAuthStore } from '../../src/store/auth.store'
import { supabase } from '../../src/lib/supabase'

jest.mock('../../src/store/auth.store')
jest.mock('../../src/lib/supabase')

const mockUseAuthStore = useAuthStore as jest.MockedFunction<typeof useAuthStore>
const mockSupabase     = supabase  as jest.Mocked<typeof supabase>

const MOCK_DOCS = [
  { id: 'd1', vendor_name: 'Amazon Web Services', invoice_number: 'AWS-123', total_amount: 8750, vat_amount: 571.96, status: 'pushed',    doc_date: '2026-05-16', created_at: new Date().toISOString(), category: 'ค่า Software / Cloud', overall_confidence: 0.99 },
  { id: 'd2', vendor_name: 'Grab (Thailand)',     invoice_number: 'GR-456',  total_amount: 450,  vat_amount: 29.44,  status: 'reviewing', doc_date: '2026-05-17', created_at: new Date().toISOString(), category: 'ค่าเดินทาง',            overall_confidence: 0.78 },
  { id: 'd3', vendor_name: '7-Eleven',            invoice_number: 'INV-789', total_amount: 285,  vat_amount: 18.64,  status: 'approved',  doc_date: '2026-05-17', created_at: new Date().toISOString(), category: 'ของใช้สำนักงาน',        overall_confidence: 0.97 },
]

function makeChainMock(result: any) {
  const chain: any = {
    select: jest.fn().mockReturnThis(),
    eq:     jest.fn().mockReturnThis(),
    order:  jest.fn().mockReturnThis(),
    limit:  jest.fn().mockReturnThis(),
    ilike:  jest.fn().mockReturnThis(),
  }
  // Final resolution
  chain.limit.mockResolvedValue(result)
  chain.ilike.mockResolvedValue(result)
  return chain
}

beforeEach(() => {
  jest.clearAllMocks()
  ;(mockUseAuthStore as any).mockReturnValue({
    org: { id: 'org-1', name: 'Test Org', plan: 'pro', doc_quota: 1000, doc_used: 47, role: 'owner' },
  })
  ;(mockSupabase.from as jest.Mock).mockReturnValue(makeChainMock({ data: MOCK_DOCS }))
})

describe('DocumentsScreen', () => {
  it('renders header and add button', () => {
    const { getByTestId, getByText } = render(<DocumentsScreen />)
    expect(getByText('เอกสาร')).toBeTruthy()
    expect(getByTestId('add-doc-btn')).toBeTruthy()
  })

  it('renders document cards after loading', async () => {
    const { findByTestId } = render(<DocumentsScreen />)
    const card = await findByTestId('doc-card-d1')
    expect(card).toBeTruthy()
  })

  it('renders all documents in list', async () => {
    const { findByTestId } = render(<DocumentsScreen />)
    await findByTestId('doc-card-d1')
    await findByTestId('doc-card-d2')
    await findByTestId('doc-card-d3')
  })

  it('renders search input', () => {
    const { getByTestId } = render(<DocumentsScreen />)
    expect(getByTestId('search-input')).toBeTruthy()
  })

  it('renders filter chips', () => {
    const { getByTestId } = render(<DocumentsScreen />)
    expect(getByTestId('filter-ทั้งหมด')).toBeTruthy()
    expect(getByTestId('filter-reviewing')).toBeTruthy()
    expect(getByTestId('filter-approved')).toBeTruthy()
  })

  it('filters when chip pressed', async () => {
    ;(mockSupabase.from as jest.Mock)
      .mockReturnValueOnce(makeChainMock({ data: MOCK_DOCS }))     // initial load
      .mockReturnValueOnce(makeChainMock({ data: [MOCK_DOCS[1]] })) // filtered load

    const { getByTestId, findByTestId } = render(<DocumentsScreen />)
    await findByTestId('doc-card-d1')
    fireEvent.press(getByTestId('filter-reviewing'))
    await waitFor(() => {
      expect(mockSupabase.from).toHaveBeenCalledTimes(2)
    })
  })

  it('shows empty state when no documents', async () => {
    ;(mockSupabase.from as jest.Mock).mockReturnValue(makeChainMock({ data: [] }))
    const { findByText } = render(<DocumentsScreen />)
    const empty = await findByText('ไม่พบเอกสาร')
    expect(empty).toBeTruthy()
  })
})
