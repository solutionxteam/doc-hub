import { useEffect } from 'react'
import { Stack }     from 'expo-router'
import { useRouter } from 'expo-router'
import { useAuthStore } from '@/store/auth.store'

export default function AuthLayout() {
  const { session, initialized } = useAuthStore()
  const router = useRouter()

  useEffect(() => {
    if (initialized && session) router.replace('/(app)')
  }, [session, initialized, router])

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="login"    />
      <Stack.Screen name="register" />
    </Stack>
  )
}
