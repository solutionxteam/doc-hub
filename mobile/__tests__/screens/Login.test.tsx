import React from 'react'
import { render, fireEvent, waitFor, act } from '@testing-library/react-native'
import LoginScreen from '../../src/app/(auth)/login'
import { useAuthStore } from '../../src/store/auth.store'

// Mock the store
jest.mock('../../src/store/auth.store')

const mockSignIn = jest.fn()
const mockUseAuthStore = useAuthStore as jest.MockedFunction<typeof useAuthStore>

beforeEach(() => {
  jest.clearAllMocks()
  ;(mockUseAuthStore as any).mockReturnValue({ signIn: mockSignIn })
})

describe('LoginScreen', () => {
  it('renders all form elements', () => {
    const { getByTestId, getByText } = render(<LoginScreen />)
    expect(getByTestId('logo-wrap')).toBeTruthy()
    expect(getByTestId('email-input')).toBeTruthy()
    expect(getByTestId('password-input')).toBeTruthy()
    expect(getByTestId('login-btn')).toBeTruthy()
    expect(getByText('เข้าสู่ระบบ')).toBeTruthy()
  })

  it('shows error when fields are empty', () => {
    const { getByTestId, getByText } = render(<LoginScreen />)
    fireEvent.press(getByTestId('login-btn'))
    expect(getByText('กรุณากรอกอีเมลและรหัสผ่าน')).toBeTruthy()
  })

  it('calls signIn with correct credentials', async () => {
    mockSignIn.mockResolvedValue({ error: null })
    const { getByTestId } = render(<LoginScreen />)

    fireEvent.changeText(getByTestId('email-input'),    'demo@slippy.app')
    fireEvent.changeText(getByTestId('password-input'), 'Slipify@2025')
    await act(async () => { fireEvent.press(getByTestId('login-btn')) })

    await waitFor(() => {
      expect(mockSignIn).toHaveBeenCalledWith('demo@slippy.app', 'Slipify@2025')
    })
  })

  it('shows API error message on login failure', async () => {
    mockSignIn.mockResolvedValue({ error: 'Invalid credentials' })
    const { getByTestId, findByText } = render(<LoginScreen />)

    fireEvent.changeText(getByTestId('email-input'),    'wrong@email.com')
    fireEvent.changeText(getByTestId('password-input'), 'wrongpass')
    await act(async () => { fireEvent.press(getByTestId('login-btn')) })

    const errMsg = await findByText('Invalid credentials')
    expect(errMsg).toBeTruthy()
  })

  it('trims whitespace from email', async () => {
    mockSignIn.mockResolvedValue({ error: null })
    const { getByTestId } = render(<LoginScreen />)

    fireEvent.changeText(getByTestId('email-input'),    '  demo@slippy.app  ')
    fireEvent.changeText(getByTestId('password-input'), 'Slipify@2025')
    await act(async () => { fireEvent.press(getByTestId('login-btn')) })

    await waitFor(() => {
      expect(mockSignIn).toHaveBeenCalledWith('demo@slippy.app', 'Slipify@2025')
    })
  })
})
