import React from 'react'
import { render, fireEvent, waitFor, act } from '@testing-library/react-native'
import { Alert } from 'react-native'
import ProfileScreen from '../../src/app/(app)/profile'
import { useAuthStore } from '../../src/store/auth.store'
import * as LocalAuthentication from 'expo-local-authentication'

jest.mock('../../src/store/auth.store')
jest.mock('expo-local-authentication')
jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn(),
  ImpactFeedbackStyle: { Light: 'light', Medium: 'medium', Heavy: 'heavy' },
}))
jest.mock('expo-router', () => ({
  useRouter: () => ({ replace: jest.fn() }),
}))

const mockUseAuthStore = useAuthStore as jest.MockedFunction<typeof useAuthStore>
const mockSignOut      = jest.fn()

const MOCK_STATE = {
  profile: { full_name: 'นภัทร เจริญพร', avatar_url: null },
  user:    { id: 'user-1', email: 'demo@slippy.app' },
  org:     { id: 'org-1', name: 'บริษัท เอบีซี จำกัด', plan: 'pro', doc_quota: 1000, doc_used: 47, role: 'owner' },
  signOut: mockSignOut,
}

beforeEach(() => {
  jest.clearAllMocks()
  ;(mockUseAuthStore as any).mockReturnValue(MOCK_STATE)
})

describe('ProfileScreen', () => {
  it('renders user name', () => {
    const { getByText } = render(<ProfileScreen />)
    expect(getByText('นภัทร เจริญพร')).toBeTruthy()
  })

  it('renders user email', () => {
    const { getByText } = render(<ProfileScreen />)
    expect(getByText('demo@slippy.app')).toBeTruthy()
  })

  it('renders org name', () => {
    const { getByText } = render(<ProfileScreen />)
    expect(getByText(/บริษัท เอบีซี จำกัด/)).toBeTruthy()
  })

  it('renders role badge', () => {
    const { getAllByText } = render(<ProfileScreen />)
    // Owner appears in role badge and in info row
    const ownerTexts = getAllByText('Owner')
    expect(ownerTexts.length).toBeGreaterThan(0)
  })

  it('renders logout button', () => {
    const { getByTestId } = render(<ProfileScreen />)
    expect(getByTestId('logout-btn')).toBeTruthy()
  })

  it('renders toggle switches', () => {
    const { getByTestId } = render(<ProfileScreen />)
    expect(getByTestId('toggle-Biometric Login')).toBeTruthy()
    expect(getByTestId('toggle-แจ้งเตือนผ่าน LINE')).toBeTruthy()
    expect(getByTestId('toggle-รายงานรายสัปดาห์')).toBeTruthy()
  })

  it('renders quick action rows', () => {
    const { getByTestId } = render(<ProfileScreen />)
    expect(getByTestId('action-🔑 เปลี่ยนรหัสผ่าน')).toBeTruthy()
    expect(getByTestId('action-📱 อุปกรณ์ที่เข้าสู่ระบบ')).toBeTruthy()
  })

  it('shows Alert on logout button press', () => {
    const alertSpy = jest.spyOn(Alert, 'alert')
    const { getByTestId } = render(<ProfileScreen />)
    fireEvent.press(getByTestId('logout-btn'))
    expect(alertSpy).toHaveBeenCalledWith(
      'ออกจากระบบ',
      'คุณต้องการออกจากระบบหรือไม่?',
      expect.any(Array),
    )
  })

  it('toggles LINE notification switch', () => {
    const { getByTestId } = render(<ProfileScreen />)
    const toggle = getByTestId('toggle-แจ้งเตือนผ่าน LINE')
    // Initial state is true (lineNotif = true), press to toggle off
    fireEvent.press(toggle)
    // No crash expected; toggle is interactive
    expect(toggle).toBeTruthy()
  })

  it('shows biometric unavailable alert when not enrolled', async () => {
    ;(LocalAuthentication.isEnrolledAsync as jest.Mock).mockResolvedValueOnce(false)
    const alertSpy = jest.spyOn(Alert, 'alert')
    const { getByTestId } = render(<ProfileScreen />)
    await act(async () => {
      fireEvent.press(getByTestId('toggle-Biometric Login'))
    })
    await waitFor(() => {
      expect(alertSpy).toHaveBeenCalledWith('ไม่รองรับ', 'ไม่พบ Face ID หรือ Touch ID ในอุปกรณ์นี้')
    })
  })

  it('enables biometric when enrolled and auth succeeds', async () => {
    ;(LocalAuthentication.isEnrolledAsync as jest.Mock).mockResolvedValueOnce(true)
    ;(LocalAuthentication.authenticateAsync as jest.Mock).mockResolvedValueOnce({ success: true })
    const { getByTestId } = render(<ProfileScreen />)
    await act(async () => {
      fireEvent.press(getByTestId('toggle-Biometric Login'))
    })
    // No alert shown; biometric enabled successfully
    expect(LocalAuthentication.authenticateAsync).toHaveBeenCalled()
  })

  it('renders fallback name from email when no profile', () => {
    ;(mockUseAuthStore as any).mockReturnValue({
      ...MOCK_STATE,
      profile: null,
    })
    const { getByText } = render(<ProfileScreen />)
    expect(getByText('demo')).toBeTruthy()
  })

  it('renders app version info', () => {
    const { getByText } = render(<ProfileScreen />)
    expect(getByText('Slippy Mobile v1.0.0')).toBeTruthy()
  })
})
