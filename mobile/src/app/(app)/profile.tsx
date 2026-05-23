import React, { useState } from 'react'
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, Alert, ActivityIndicator,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import * as LocalAuthentication from 'expo-local-authentication'
import * as Haptics from 'expo-haptics'
import { useAuthStore } from '@/store/auth.store'
import { initials } from '@/lib/utils'
import { Brand, Light } from '@/constants/colors'

const ROLE_LABEL: Record<string,string> = {
  owner:'Owner', admin:'Admin', accountant:'Accountant', member:'Member',
}
const ROLE_COLOR: Record<string,string> = {
  owner: Brand[500], admin: '#8b5cf6', accountant: '#6366f1', member: '#94a3b8',
}

function ToggleRow({ label, sub, value, onChange }: {
  label: string; sub?: string; value: boolean; onChange: (v: boolean) => void
}) {
  return (
    <View style={pr.prefRow}>
      <View style={{ flex: 1 }}>
        <Text style={pr.prefLabel}>{label}</Text>
        {sub && <Text style={pr.prefSub}>{sub}</Text>}
      </View>
      <TouchableOpacity
        onPress={() => { onChange(!value); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light) }}
        style={[pr.toggle, { backgroundColor: value ? Brand[500] : '#d1d5db' }]}
        testID={`toggle-${label}`}
      >
        <View style={[pr.thumb, { transform: [{ translateX: value ? 18 : 2 }] }]} />
      </TouchableOpacity>
    </View>
  )
}

export default function ProfileScreen() {
  const router  = useRouter()
  const { profile, org, user, signOut } = useAuthStore()
  const [loggingOut, setLoggingOut] = useState(false)
  const [biometric,  setBiometric]  = useState(false)
  const [lineNotif,  setLineNotif]  = useState(true)
  const [weeklyRpt,  setWeeklyRpt]  = useState(false)

  const name  = profile?.full_name ?? user?.email?.split('@')[0] ?? '—'
  const email = user?.email ?? '—'
  const role  = org?.role ?? 'member'

  const handleBiometricToggle = async (v: boolean) => {
    if (v) {
      const enrolled = await LocalAuthentication.isEnrolledAsync()
      if (!enrolled) { Alert.alert('ไม่รองรับ', 'ไม่พบ Face ID หรือ Touch ID ในอุปกรณ์นี้'); return }
      const result = await LocalAuthentication.authenticateAsync({ promptMessage: 'ยืนยันตัวตนเพื่อเปิด Biometric Login' })
      if (result.success) setBiometric(true)
    } else {
      setBiometric(false)
    }
  }

  const handleLogout = () => {
    Alert.alert('ออกจากระบบ', 'คุณต้องการออกจากระบบหรือไม่?', [
      { text: 'ยกเลิก', style: 'cancel' },
      {
        text: 'ออกจากระบบ', style: 'destructive',
        onPress: async () => {
          setLoggingOut(true)
          await signOut()
          router.replace('/(auth)/login')
        },
      },
    ])
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: Light.background }}>
      <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>

        {/* Hero */}
        <View style={pr.hero}>
          <View style={pr.avatarWrap}>
            <View style={[pr.avatar, { backgroundColor: ROLE_COLOR[role] ?? Brand[500] }]}>
              <Text style={pr.avatarTxt}>{initials(name)}</Text>
            </View>
            <View style={pr.onlineDot} />
          </View>
          <Text style={pr.name}>{name}</Text>
          <Text style={pr.email}>{email}</Text>
          <View style={[pr.roleBadge, { backgroundColor: (ROLE_COLOR[role] ?? Brand[500]) + '18' }]}>
            <Text style={[pr.roleLabel, { color: ROLE_COLOR[role] ?? Brand[500] }]}>{ROLE_LABEL[role] ?? role}</Text>
          </View>
          {org && (
            <Text style={pr.orgName}>{org.name} · {org.plan.toUpperCase()}</Text>
          )}
        </View>

        {/* Account info */}
        <View style={pr.section}>
          <Text style={pr.sectionTitle}>บัญชี</Text>
          {[
            { label: 'ชื่อ-นามสกุล', value: name },
            { label: 'อีเมล',         value: email },
            { label: 'บทบาท',         value: ROLE_LABEL[role] ?? role },
          ].map(row => (
            <View key={row.label} style={pr.infoRow}>
              <Text style={pr.infoLabel}>{row.label}</Text>
              <Text style={pr.infoValue}>{row.value}</Text>
            </View>
          ))}
        </View>

        {/* Preferences */}
        <View style={pr.section}>
          <Text style={pr.sectionTitle}>การตั้งค่า</Text>
          <ToggleRow label="Biometric Login" sub="Face ID / Touch ID" value={biometric} onChange={handleBiometricToggle} />
          <ToggleRow label="แจ้งเตือนผ่าน LINE" sub="Push ผ่าน Slippy Bot" value={lineNotif} onChange={setLineNotif} />
          <ToggleRow label="รายงานรายสัปดาห์" sub="สรุปค่าใช้จ่ายทุกวันจันทร์" value={weeklyRpt} onChange={setWeeklyRpt} />
        </View>

        {/* Quick actions */}
        <View style={pr.section}>
          <Text style={pr.sectionTitle}>การดำเนินการ</Text>
          {[
            { label: '🔑 เปลี่ยนรหัสผ่าน',   action: () => {} },
            { label: '📱 อุปกรณ์ที่เข้าสู่ระบบ', action: () => {} },
            { label: '💬 ติดต่อฝ่ายสนับสนุน', action: () => {} },
            { label: '📋 นโยบายความเป็นส่วนตัว', action: () => {} },
          ].map(row => (
            <TouchableOpacity key={row.label} style={pr.actionRow} onPress={row.action} testID={`action-${row.label}`}>
              <Text style={pr.actionLabel}>{row.label}</Text>
              <Text style={pr.actionChevron}>›</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* App info */}
        <View style={pr.section}>
          <Text style={pr.sectionTitle}>เกี่ยวกับแอป</Text>
          <View style={pr.appInfo}>
            <Text style={pr.appInfoText}>Slippy Mobile v1.0.0</Text>
            <Text style={pr.appInfoText}>© 2026 Slippy Co., Ltd.</Text>
          </View>
        </View>

        {/* Logout */}
        <TouchableOpacity style={pr.logoutBtn} onPress={handleLogout} disabled={loggingOut} testID="logout-btn">
          {loggingOut
            ? <ActivityIndicator color="#ef4444" />
            : <Text style={pr.logoutTxt}>← ออกจากระบบ</Text>}
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  )
}

const pr = StyleSheet.create({
  hero:        { alignItems: 'center', paddingTop: 24, paddingBottom: 20, borderBottomWidth: 1, borderBottomColor: Light.border },
  avatarWrap:  { position: 'relative', marginBottom: 12 },
  avatar:      { width: 88, height: 88, borderRadius: 44, alignItems: 'center', justifyContent: 'center', shadowColor: Brand[500], shadowOpacity: 0.3, shadowRadius: 12, shadowOffset: { width: 0, height: 4 } },
  avatarTxt:   { fontSize: 30, fontWeight: '800', color: '#fff' },
  onlineDot:   { position: 'absolute', bottom: 2, right: 2, width: 18, height: 18, borderRadius: 9, backgroundColor: '#10b981', borderWidth: 2.5, borderColor: Light.background },
  name:        { fontSize: 22, fontWeight: '800', color: Light.foreground, marginBottom: 4 },
  email:       { fontSize: 14, color: Light.mutedFg, marginBottom: 10 },
  roleBadge:   { paddingHorizontal: 14, paddingVertical: 5, borderRadius: 20, marginBottom: 8 },
  roleLabel:   { fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  orgName:     { fontSize: 12, color: Light.mutedFg, fontWeight: '500' },
  section:     { marginTop: 16, paddingHorizontal: 20 },
  sectionTitle:{ fontSize: 11, fontWeight: '700', color: Light.mutedFg, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 },
  infoRow:     { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: Light.border },
  infoLabel:   { fontSize: 14, color: Light.mutedFg },
  infoValue:   { fontSize: 14, fontWeight: '600', color: Light.foreground },
  prefRow:     { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: Light.border },
  prefLabel:   { fontSize: 14, fontWeight: '600', color: Light.foreground },
  prefSub:     { fontSize: 11, color: Light.mutedFg, marginTop: 1 },
  toggle:      { width: 44, height: 26, borderRadius: 13, justifyContent: 'center', position: 'relative' },
  thumb:       { width: 20, height: 20, borderRadius: 10, backgroundColor: '#fff', position: 'absolute', shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 4, shadowOffset: { width: 0, height: 2 } },
  actionRow:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 13, borderBottomWidth: 1, borderBottomColor: Light.border },
  actionLabel: { fontSize: 14, color: Light.foreground },
  actionChevron:{ fontSize: 20, color: Light.mutedFg, fontWeight: '300' },
  appInfo:     { backgroundColor: Light.muted, borderRadius: 12, padding: 14, gap: 4 },
  appInfoText: { fontSize: 12, color: Light.mutedFg },
  logoutBtn:   { marginHorizontal: 20, marginTop: 24, paddingVertical: 14, borderRadius: 14, borderWidth: 1.5, borderColor: '#fecaca', alignItems: 'center', backgroundColor: '#fef2f2' },
  logoutTxt:   { fontSize: 15, fontWeight: '700', color: '#ef4444' },
})
