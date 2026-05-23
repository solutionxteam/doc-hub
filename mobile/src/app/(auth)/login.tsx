import React, { useState } from 'react'
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator,
} from 'react-native'
import { useRouter } from 'expo-router'
import { useAuthStore } from '@/store/auth.store'
import { Brand, Light } from '@/constants/colors'

export default function LoginScreen() {
  const router  = useRouter()
  const signIn  = useAuthStore(s => s.signIn)

  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [loading,  setLoading]  = useState(false)
  const [error,    setError]    = useState<string | null>(null)

  const handleLogin = async () => {
    if (!email || !password) { setError('กรุณากรอกอีเมลและรหัสผ่าน'); return }
    setLoading(true)
    setError(null)
    const { error: err } = await signIn(email.trim(), password)
    setLoading(false)
    if (err) setError(err)
    else router.replace('/(app)')
  }

  return (
    <KeyboardAvoidingView style={s.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">

        {/* Logo */}
        <View style={s.logoWrap} testID="logo-wrap">
          <View style={s.logoBox}>
            <Text style={s.logoEmoji}>🧾</Text>
          </View>
          <Text style={s.appName}>Slippy</Text>
          <Text style={s.tagline}>ระบบจัดการเอกสารบัญชีอัจฉริยะ</Text>
        </View>

        {/* Card */}
        <View style={s.card}>
          <Text style={s.title}>เข้าสู่ระบบ</Text>

          {error && (
            <View style={s.errorBox} testID="error-box">
              <Text style={s.errorText}>{error}</Text>
            </View>
          )}

          <View style={s.field}>
            <Text style={s.label}>อีเมล</Text>
            <TextInput
              style={s.input}
              value={email}
              onChangeText={setEmail}
              placeholder="your@email.com"
              placeholderTextColor="#94a3b8"
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              testID="email-input"
            />
          </View>

          <View style={s.field}>
            <Text style={s.label}>รหัสผ่าน</Text>
            <TextInput
              style={s.input}
              value={password}
              onChangeText={setPassword}
              placeholder="••••••••"
              placeholderTextColor="#94a3b8"
              secureTextEntry
              testID="password-input"
            />
          </View>

          <TouchableOpacity style={s.btn} onPress={handleLogin} disabled={loading} testID="login-btn">
            {loading
              ? <ActivityIndicator color="white" />
              : <Text style={s.btnText}>เข้าสู่ระบบ</Text>}
          </TouchableOpacity>

          <TouchableOpacity style={s.link}>
            <Text style={s.linkText}>ลืมรหัสผ่าน?</Text>
          </TouchableOpacity>
        </View>

        <View style={s.footer}>
          <Text style={s.footerText}>ยังไม่มีบัญชี? </Text>
          <TouchableOpacity onPress={() => router.push('/(auth)/register')}>
            <Text style={[s.footerText, { color: Brand[500], fontWeight: '600' }]}>สมัครสมาชิก</Text>
          </TouchableOpacity>
        </View>

      </ScrollView>
    </KeyboardAvoidingView>
  )
}

const s = StyleSheet.create({
  root:       { flex: 1, backgroundColor: Light.background },
  scroll:     { flexGrow: 1, justifyContent: 'center', padding: 24 },
  logoWrap:   { alignItems: 'center', marginBottom: 32 },
  logoBox:    { width: 72, height: 72, borderRadius: 18, backgroundColor: Brand[500], alignItems: 'center', justifyContent: 'center', marginBottom: 12, shadowColor: Brand[500], shadowOpacity: 0.35, shadowRadius: 16, shadowOffset: { width: 0, height: 6 } },
  logoEmoji:  { fontSize: 32 },
  appName:    { fontSize: 28, fontWeight: '800', color: Brand[900], letterSpacing: -0.5 },
  tagline:    { fontSize: 13, color: Light.mutedFg, marginTop: 4 },
  card:       { backgroundColor: Light.card, borderRadius: 20, padding: 24, borderWidth: 1, borderColor: Light.border, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 16, shadowOffset: { width: 0, height: 4 } },
  title:      { fontSize: 20, fontWeight: '700', color: Light.foreground, marginBottom: 20 },
  errorBox:   { backgroundColor: '#fef2f2', borderRadius: 10, padding: 12, marginBottom: 16, borderWidth: 1, borderColor: '#fecaca' },
  errorText:  { color: '#dc2626', fontSize: 13 },
  field:      { marginBottom: 14 },
  label:      { fontSize: 13, fontWeight: '600', color: Light.mutedFg, marginBottom: 6 },
  input:      { backgroundColor: Light.muted, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, color: Light.foreground, borderWidth: 1, borderColor: Light.border },
  btn:        { backgroundColor: Brand[500], borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginTop: 6, shadowColor: Brand[500], shadowOpacity: 0.3, shadowRadius: 10, shadowOffset: { width: 0, height: 4 } },
  btnText:    { color: '#fff', fontSize: 15, fontWeight: '700' },
  link:       { alignItems: 'center', marginTop: 14 },
  linkText:   { color: Brand[500], fontSize: 13, fontWeight: '500' },
  footer:     { flexDirection: 'row', justifyContent: 'center', marginTop: 24 },
  footerText: { fontSize: 14, color: Light.mutedFg },
})
