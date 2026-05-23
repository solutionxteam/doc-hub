import '@testing-library/jest-native/extend-expect'

// Mock expo modules
jest.mock('expo-router', () => ({
  useRouter:   () => ({ push: jest.fn(), back: jest.fn(), replace: jest.fn() }),
  useSegments: () => [],
  Link:        ({ children }) => children,
  Redirect:    ({ href }) => null,
  Stack:       { Screen: () => null },
  Tabs:        { Screen: () => null },
}))

jest.mock('expo-secure-store', () => ({
  getItemAsync:    jest.fn(),
  setItemAsync:    jest.fn(),
  deleteItemAsync: jest.fn(),
}))

jest.mock('expo-camera', () => ({
  Camera:           { requestCameraPermissionsAsync: jest.fn().mockResolvedValue({ granted: true }) },
  CameraView:       'CameraView',
  useCameraPermissions: () => [{ granted: true }, jest.fn()],
}))

jest.mock('expo-image-picker', () => ({
  launchCameraAsync:    jest.fn(),
  launchImageLibraryAsync: jest.fn(),
  requestMediaLibraryPermissionsAsync: jest.fn().mockResolvedValue({ granted: true }),
  MediaTypeOptions:     { Images: 'Images' },
}))

jest.mock('expo-local-authentication', () => ({
  hasHardwareAsync:    jest.fn().mockResolvedValue(true),
  isEnrolledAsync:     jest.fn().mockResolvedValue(true),
  authenticateAsync:   jest.fn().mockResolvedValue({ success: true }),
  AuthenticationType:  { FINGERPRINT: 1, FACIAL_RECOGNITION: 2 },
}))

jest.mock('expo-haptics', () => ({
  impactAsync:          jest.fn(),
  notificationAsync:    jest.fn(),
  ImpactFeedbackStyle:  { Light: 'light', Medium: 'medium', Heavy: 'heavy' },
  NotificationFeedbackType: { Success: 'success', Error: 'error' },
}))

jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => ({
    auth: {
      getSession:       jest.fn().mockResolvedValue({ data: { session: null }, error: null }),
      signInWithPassword: jest.fn(),
      signOut:          jest.fn(),
      onAuthStateChange: jest.fn(() => ({ data: { subscription: { unsubscribe: jest.fn() } } })),
    },
    from: jest.fn(() => ({
      select: jest.fn().mockReturnThis(),
      insert: jest.fn().mockReturnThis(),
      update: jest.fn().mockReturnThis(),
      delete: jest.fn().mockReturnThis(),
      eq:     jest.fn().mockReturnThis(),
      order:  jest.fn().mockReturnThis(),
      limit:  jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({ data: null, error: null }),
    })),
  })),
}))

// Silence noisy console warnings in tests
const originalWarn = console.warn
beforeAll(() => {
  console.warn = (...args) => {
    if (args[0]?.includes?.('Warning:') || args[0]?.includes?.('act(')) return
    originalWarn(...args)
  }
})
afterAll(() => { console.warn = originalWarn })
