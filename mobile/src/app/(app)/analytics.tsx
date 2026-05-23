import React, { useEffect, useState } from 'react'
import { View, Text, ScrollView, StyleSheet, ActivityIndicator } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useAuthStore } from '@/store/auth.store'
import { supabase } from '@/lib/supabase'
import { fmtTHB } from '@/lib/utils'
import { Brand, Light } from '@/constants/colors'

interface MonthItem { m: string; spend: number }

const MONTHS_TH = ['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.']

const CAT_COLORS = ['#6366f1','#8b5cf6','#06b6d4','#10b981','#f97316','#f59e0b']

function MiniBar({ data }: { data: MonthItem[] }) {
  const max = Math.max(...data.map(d => d.spend), 1)
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 4, height: 80 }}>
      {data.map((d, i) => (
        <View key={i} style={{ flex: 1, alignItems: 'center', gap: 4 }}>
          <View style={{
            width: '80%', borderRadius: 4,
            height: Math.max(4, (d.spend / max) * 64),
            backgroundColor: i === data.length - 1 ? Brand[500] : Brand[500] + '40',
          }} />
          <Text style={{ fontSize: 8, color: Light.mutedFg }}>{d.m}</Text>
        </View>
      ))}
    </View>
  )
}

export default function AnalyticsScreen() {
  const { org }     = useAuthStore()
  const [monthly,   setMonthly]  = useState<MonthItem[]>([])
  const [cats,      setCats]     = useState<{ name: string; value: number }[]>([])
  const [yearTotal, setYearTotal]= useState(0)
  const [loading,   setLoading]  = useState(true)

  useEffect(() => {
    if (!org) return
    ;(async () => {
      const { data } = await supabase
        .from('monthly_expense_summary')
        .select('*')
        .eq('organization_id', org.id)
        .order('month', { ascending: true })
        .limit(12)

      if (data && data.length > 0) {
        const series = data.map((row: any) => {
          const d = new Date(row.month + '-01')
          return { m: MONTHS_TH[d.getMonth()], spend: row.grand_total ?? 0 }
        })
        setMonthly(series)
        setYearTotal(series.reduce((a, x) => a + x.spend, 0))
      } else {
        // Static fallback
        const fallback: MonthItem[] = [
          { m:'ต.ค.', spend:118400 }, { m:'พ.ย.', spend:99300 }, { m:'ธ.ค.', spend:132800 },
          { m:'ม.ค.', spend:121500 }, { m:'ก.พ.', spend:109700 }, { m:'มี.ค.', spend:127200 },
          { m:'เม.ย.', spend:131979 }, { m:'พ.ค.', spend:142380 },
        ]
        setMonthly(fallback)
        setYearTotal(fallback.reduce((a, x) => a + x.spend, 0))
      }
      // Category static (would normally come from another query)
      setCats([
        { name:'ค่า Software / Cloud', value:38200 },
        { name:'ค่าเช่าสำนักงาน',      value:35000 },
        { name:'ค่าเดินทาง',           value:18700 },
        { name:'ของใช้สำนักงาน',       value:14250 },
        { name:'อาหารและเครื่องดื่ม',  value:13420 },
      ])
      setLoading(false)
    })()
  }, [org])

  if (loading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: Light.background, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator size="large" color={Brand[500]} />
      </SafeAreaView>
    )
  }

  const catTotal = cats.reduce((a, x) => a + x.value, 1)

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: Light.background }}>
      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 40 }}>
        <Text style={an.pageTitle}>รายงานค่าใช้จ่าย</Text>

        {/* Year total */}
        <View style={an.totalCard}>
          <Text style={an.totalLabel}>รวมทั้งปี</Text>
          <Text style={an.totalValue}>{fmtTHB(yearTotal)}</Text>
          <Text style={an.totalSub}>จาก {monthly.length} เดือน</Text>
        </View>

        {/* Bar chart */}
        <View style={an.card}>
          <Text style={an.cardTitle}>ค่าใช้จ่ายรายเดือน</Text>
          <MiniBar data={monthly} />
          {/* Latest month highlight */}
          {monthly.length > 0 && (
            <View style={an.latestRow}>
              <Text style={an.latestLabel}>เดือนล่าสุด ({monthly[monthly.length-1].m})</Text>
              <Text style={[an.latestValue, { color: Brand[500] }]}>{fmtTHB(monthly[monthly.length-1].spend)}</Text>
            </View>
          )}
        </View>

        {/* Category breakdown */}
        <View style={an.card}>
          <Text style={an.cardTitle}>แยกตามหมวดหมู่</Text>
          <View style={{ gap: 10, marginTop: 8 }}>
            {cats.map((c, i) => (
              <View key={i}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: CAT_COLORS[i % CAT_COLORS.length] }} />
                    <Text style={{ fontSize: 12, color: Light.foreground, fontWeight: '500' }}>{c.name}</Text>
                  </View>
                  <Text style={{ fontSize: 12, fontWeight: '700', color: Light.foreground }}>{fmtTHB(c.value)}</Text>
                </View>
                <View style={{ height: 4, backgroundColor: Light.muted, borderRadius: 2, overflow: 'hidden' }}>
                  <View style={{ height: '100%', borderRadius: 2, backgroundColor: CAT_COLORS[i % CAT_COLORS.length], width: `${(c.value / catTotal) * 100}%` as any }} />
                </View>
              </View>
            ))}
          </View>
        </View>

        {/* Monthly detail list */}
        <View style={an.card}>
          <Text style={an.cardTitle}>สรุปรายเดือน</Text>
          {[...monthly].reverse().map((m, i) => (
            <View key={i} style={an.monthRow}>
              <Text style={an.monthLabel}>{m.m}</Text>
              <Text style={an.monthValue}>{fmtTHB(m.spend)}</Text>
            </View>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}

const an = StyleSheet.create({
  pageTitle:  { fontSize: 22, fontWeight: '800', color: Light.foreground, marginBottom: 16 },
  totalCard:  { backgroundColor: Brand[500], borderRadius: 20, padding: 24, alignItems: 'center', marginBottom: 16, shadowColor: Brand[500], shadowOpacity: 0.3, shadowRadius: 12, shadowOffset: { width: 0, height: 6 } },
  totalLabel: { fontSize: 13, color: 'rgba(255,255,255,0.75)', fontWeight: '500' },
  totalValue: { fontSize: 34, fontWeight: '800', color: '#fff', marginTop: 4 },
  totalSub:   { fontSize: 12, color: 'rgba(255,255,255,0.65)', marginTop: 4 },
  card:       { backgroundColor: Light.card, borderRadius: 16, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: Light.border },
  cardTitle:  { fontSize: 14, fontWeight: '700', color: Light.foreground, marginBottom: 12 },
  latestRow:  { flexDirection: 'row', justifyContent: 'space-between', marginTop: 12, paddingTop: 10, borderTopWidth: 1, borderTopColor: Light.border },
  latestLabel:{ fontSize: 12, color: Light.mutedFg },
  latestValue:{ fontSize: 14, fontWeight: '700' },
  monthRow:   { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: Light.border },
  monthLabel: { fontSize: 13, color: Light.foreground },
  monthValue: { fontSize: 13, fontWeight: '700', color: Light.foreground },
})
