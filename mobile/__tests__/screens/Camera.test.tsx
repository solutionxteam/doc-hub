import React from 'react'
import { render, fireEvent, waitFor, act } from '@testing-library/react-native'
import CameraScreen from '../../src/app/(app)/documents/camera'
import { useAuthStore } from '../../src/store/auth.store'
import * as ImagePicker from 'expo-image-picker'

jest.mock('../../src/store/auth.store')
jest.mock('expo-image-picker')
jest.mock('expo-document-picker', () => ({
  getDocumentAsync: jest.fn(),
}))

const mockUseAuthStore = useAuthStore as jest.MockedFunction<typeof useAuthStore>

beforeEach(() => {
  jest.clearAllMocks()
  ;(mockUseAuthStore as any).mockReturnValue({
    org: { id: 'org-1', name: 'Test Org', plan: 'pro', doc_quota: 1000, doc_used: 10, role: 'owner' },
    user: { id: 'user-1', email: 'test@example.com' },
  })
})

describe('CameraScreen — select mode', () => {
  it('renders all three upload options', () => {
    const { getByTestId } = render(<CameraScreen />)
    expect(getByTestId('btn-camera')).toBeTruthy()
    expect(getByTestId('btn-library')).toBeTruthy()
    expect(getByTestId('btn-pdf')).toBeTruthy()
  })

  it('opens library picker when gallery button pressed', async () => {
    ;(ImagePicker.launchImageLibraryAsync as jest.Mock).mockResolvedValueOnce({ canceled: true })
    const { getByTestId } = render(<CameraScreen />)
    await act(async () => { fireEvent.press(getByTestId('btn-library')) })
    expect(ImagePicker.launchImageLibraryAsync).toHaveBeenCalled()
  })

  it('transitions to preview when image selected', async () => {
    ;(ImagePicker.launchImageLibraryAsync as jest.Mock).mockResolvedValueOnce({
      canceled: false,
      assets: [{ uri: 'file:///test.jpg', width: 800, height: 600 }],
    })
    const { getByTestId, findByTestId } = render(<CameraScreen />)
    await act(async () => { fireEvent.press(getByTestId('btn-library')) })
    const previewImg = await findByTestId('preview-image')
    expect(previewImg).toBeTruthy()
  })

  it('shows confirm upload button in preview mode', async () => {
    ;(ImagePicker.launchImageLibraryAsync as jest.Mock).mockResolvedValueOnce({
      canceled: false,
      assets: [{ uri: 'file:///receipt.jpg' }],
    })
    const { getByTestId, findByTestId } = render(<CameraScreen />)
    await act(async () => { fireEvent.press(getByTestId('btn-library')) })
    const btn = await findByTestId('confirm-upload-btn')
    expect(btn).toBeTruthy()
  })
})
