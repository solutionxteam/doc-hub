import React, { useEffect, useState, useCallback } from 'react'
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  TextInput, RefreshControl, ActivityIndicator,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { useAuthStore } from '@/store/auth.store'
import { supabase } from '@/lib/supabase'
import { fmtTHB, relTime } from '@/lib/utils'
import { Brand, Light, Status, StatusBg } from '@/constants/colors'

interface Doc {
  id: string; vendor_name: string | null; invoice_number: string | null
  total_amount: number | null; vat_amount: number | null; status: string
  doc_date: string | null; created_at: string; category: string | null
  overall_confidence: number | null
}

const STATUS_LABEL: Record<string, string> = {
  pending: 'รอดำเนินการ', processing: 'กำลังประมวลผล', reviewing: 'รอตรวจสอบ',
  approved: 'อนุมัติแล้ว', pushed: 'ส่งแล้ว', failed: 'ล้มเหลว', rejected: 'ปฏิเสธ',
}

const STATUS_FILTERS = ['ทั้งหมด', 'reviewing', 'pending', 'approved', 'pushed', 'failed']

function DocCard({ doc, onPress }: { doc: Doc; onPress: () => void }) {
  const color = Status[doc.status as keyof typeof Status] ?? '#94a3b8'
  const bg    = StatusBg[doc.status as keyof typeof StatusBg] ?? '#f8fafc'
  return (
    <TouchableOpacity style={dc.card} onPress={onPress} testID={`doc-card-${doc.id}`} activeOpacity={0.7}>
      <View style={dc.row}>
        <View style={dc.left}>
          <Text style={dc.vendor} numberOfLines={1}>{doc.vendor_name ?? '—'}</Text>
          {doc.invoice_number && doc.invoice_number !== '-' && (
            <Text style={dc.inv}>{doc.invoice_number}</Text>
          )}
          <Text style={dc.time}>{relTime(doc.created_at)}</Text>
        </View>
        <View style={dc.right}>
          <Text style={dc.amount}>{fmtTHB(doc.total_amount ?? 0)}</Text>
          <View style={[dc.badge, { backgroundColor: bg }]}>
            <Text style={[dc.badgeTxt, { color }]}>{STATUS_LABEL[doc.status] ?? doc.status}</Text>
          </View>
          {doc.overall_confidence != null && (
            <Text style={dc.conf}>{Math.round(doc.overall_confidence * 100)}% แม่นยำ</Text>
          )}
        </View>
      </View>
      {doc.category && (
        <View style={dc.catBadge}>
          <Text style={dc.catTxt}>{doc.category}</Text>
        </View>
      )}
    </TouchableOpacity>
  )
}

const dc = StyleSheet.create({
  card:    { backgroundColor: Light.card, marginHorizontal: 16, marginVertical: 5, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: Light.border },
  row:     { flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
  left:    { flex: 1, gap: 2 },
  right:   { alignItems: 'flex-end', gap: 4 },
  vendor:  { fontSize: 14, fontWeight: '700', color: Light.foreground },
  inv:     { fontSize: 11, fontFamily: 'monospace', color: Light.mutedFg },
  time:    { fontSize: 11, color: Light.mutedFg, marginTop: 2 },
  amount:  { fontSize: 15, fontWeight: '800', color: Light.foreground },
  badge:   { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 100 },
  badgeTxt:{ fontSize: 10, fontWeight: '600' },
  conf:    { fontSize: 10, color: Light.mutedFg },
  catBadge:{ marginTop: 8, alignSelf: 'flex-start', backgroundColor: Brand[50], paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  catTxt:  { fontSize: 11, color: Brand[700], fontWeight: '500' },
})

export default function DocumentsScreen() {
  const router     = useRouter()
  const { org }    = useAuthStore()
  const [docs,       setDocs]       = useState<Doc[]>([])
  const [loading,    setLoading]    = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [search,     setSearch]     = useState('')
  const [filter,     setFilter]     = useState('ทั้งหมด')

  const load = useCallback(async () => {
    if (!org) return
    let q = supabase.from('documents')
      .select('id,vendor_name,invoice_number,total_amount,vat_amount,status,doc_date,created_at,category,overall_confidence')
      .eq('organization_id', org.id)
      .order('created_at', { ascending: false })
      .limit(50)
    if (filter !== 'ทั้งหมด') q = q.eq('status', filter)
    if (search.trim()) q = q.ilike('vendor_name', `%${search.trim()}%`)
    const { data } = await q
    setDocs(data ?? [])
  }, [org, filter, search])

  useEffect(() => { setLoading(true); load().finally(() => setLoading(false)) }, [load])

  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false) }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: Light.background }}>
      {/* Header */}
      <View style={dl.header}>
        <Text style={dl.title}>เอกสาร</Text>
        <TouchableOpacity
          style={dl.addBtn}
          onPress={() => router.push('/(app)/documents/camera')}
          testID="add-doc-btn"
        >
          <Text style={dl.addBtnTxt}>+ เพิ่ม</Text>
        </TouchableOpacity>
      </View>

      {/* Search */}
      <View style={dl.searchBox}>
        <Text style={dl.searchIcon}>🔍</Text>
        <TextInput
          style={dl.searchInput}
          value={search}
          onChangeText={setSearch}
          placeholder="ค้นหาผู้ขาย..."
          placeholderTextColor={Light.mutedFg}
          testID="search-input"
        />
        {search.length > 0 && (
          <TouchableOpacity onPress={() => setSearch('')}>
            <Text style={{ color: Light.mutedFg, fontSize: 16 }}>✕</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Status filters */}
      <View style={dl.filterRow}>
        <FlatList
          horizontal
          data={STATUS_FILTERS}
          keyExtractor={i => i}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 16, gap: 8 }}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[dl.chip, filter === item && dl.chipActive]}
              onPress={() => setFilter(item)}
              testID={`filter-${item}`}
            >
              <Text style={[dl.chipTxt, filter === item && dl.chipTxtActive]}>
                {item === 'ทั้งหมด' ? 'ทั้งหมด' : STATUS_LABEL[item] ?? item}
              </Text>
            </TouchableOpacity>
          )}
        />
      </View>

      {/* List */}
      {loading
        ? <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}><ActivityIndicator size="large" color={Brand[500]} /></View>
        : <FlatList
            data={docs}
            keyExtractor={d => d.id}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Brand[500]} />}
            renderItem={({ item }) => <DocCard doc={item} onPress={() => router.push(`/(app)/documents/${item.id}` as any)} />}
            ListEmptyComponent={<Text style={dl.empty}>ไม่พบเอกสาร</Text>}
            contentContainerStyle={{ paddingBottom: 32, paddingTop: 8 }}
            testID="doc-list"
          />
      }
    </SafeAreaView>
  )
}

const dl = StyleSheet.create({
  header:      { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 12 },
  title:       { fontSize: 24, fontWeight: '800', color: Light.foreground },
  addBtn:      { backgroundColor: Brand[500], paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10 },
  addBtnTxt:   { color: '#fff', fontWeight: '700', fontSize: 13 },
  searchBox:   { flexDirection: 'row', alignItems: 'center', marginHorizontal: 16, marginBottom: 10, backgroundColor: Light.muted, borderRadius: 12, paddingHorizontal: 12, gap: 8, height: 42 },
  searchIcon:  { fontSize: 14 },
  searchInput: { flex: 1, fontSize: 14, color: Light.foreground },
  filterRow:   { marginBottom: 8 },
  chip:        { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, backgroundColor: Light.muted, borderWidth: 1, borderColor: Light.border },
  chipActive:  { backgroundColor: Brand[500], borderColor: Brand[500] },
  chipTxt:     { fontSize: 12, fontWeight: '600', color: Light.mutedFg },
  chipTxtActive:{ color: '#fff' },
  empty:       { textAlign: 'center', color: Light.mutedFg, fontSize: 14, marginTop: 40 },
})
