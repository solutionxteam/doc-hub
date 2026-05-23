/**
 * Camera / Upload screen
 * Allows users to:
 *  1. Take a photo with the camera
 *  2. Pick from photo library
 *  3. Pick a PDF from files
 * Then uploads to Supabase storage and creates a document record.
 */
import React, { useState, useRef } from 'react'
import {
  View, Text, TouchableOpacity, StyleSheet, Image,
  ActivityIndicator, Alert, ScrollView, Platform,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { CameraView, useCameraPermissions } from 'expo-camera'
import * as ImagePicker from 'expo-image-picker'
import * as DocumentPicker from 'expo-document-picker'
import * as Haptics from 'expo-haptics'
import { useRouter } from 'expo-router'
import { useAuthStore } from '@/store/auth.store'
import { supabase } from '@/lib/supabase'
import { Brand, Light } from '@/constants/colors'

type Mode = 'select' | 'camera' | 'preview'

interface PreviewItem {
  uri:      string
  type:     'image' | 'pdf'
  name:     string
  mimeType: string
}

export default function CameraScreen() {
  const router = useRouter()
  const { org, user } = useAuthStore()
  const [permission, requestPermission] = useCameraPermissions()
  const [mode,     setMode]     = useState<Mode>('select')
  const [preview,  setPreview]  = useState<PreviewItem | null>(null)
  const [uploading,setUploading]= useState(false)
  const [facing,   setFacing]   = useState<'back'|'front'>('back')
  const cameraRef = useRef<CameraView>(null)

  /* ── Pick from library ── */
  const pickFromLibrary = async () => {
    const { granted } = await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (!granted) { Alert.alert('ต้องการสิทธิ์เข้าถึงรูปภาพ'); return }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.8,
    })
    if (!result.canceled && result.assets[0]) {
      const a = result.assets[0]
      setPreview({ uri: a.uri, type: 'image', name: `slip_${Date.now()}.jpg`, mimeType: 'image/jpeg' })
      setMode('preview')
    }
  }

  /* ── Pick PDF ── */
  const pickPDF = async () => {
    const result = await DocumentPicker.getDocumentAsync({ type: 'application/pdf' })
    if (!result.canceled && result.assets[0]) {
      const a = result.assets[0]
      setPreview({ uri: a.uri, type: 'pdf', name: a.name, mimeType: 'application/pdf' })
      setMode('preview')
    }
  }

  /* ── Take photo ── */
  const takePicture = async () => {
    if (!cameraRef.current) return
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
    const photo = await cameraRef.current.takePictureAsync({ quality: 0.8 })
    if (photo) {
      setPreview({ uri: photo.uri, type: 'image', name: `slip_${Date.now()}.jpg`, mimeType: 'image/jpeg' })
      setMode('preview')
    }
  }

  /* ── Upload ── */
  const upload = async () => {
    if (!preview || !org || !user) return
    setUploading(true)
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)

    try {
      // 1. Upload file to storage
      const path = `${org.id}/${Date.now()}_${preview.name}`
      const response = await fetch(preview.uri)
      const blob = await response.blob()

      const { error: storageError } = await supabase.storage
        .from('documents')
        .upload(path, blob, { contentType: preview.mimeType, upsert: false })

      if (storageError) throw storageError

      // 2. Create document record
      const { error: dbError } = await supabase.from('documents').insert({
        organization_id: org.id,
        uploaded_by:     user.id,
        file_name:       preview.name,
        file_path:       path,
        file_type:       preview.mimeType,
        source:          'web',
        status:          'pending',
      })

      if (dbError) throw dbError

      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
      Alert.alert('อัปโหลดสำเร็จ! 🎉', 'กำลัง OCR เอกสาร...', [
        { text: 'ดูเอกสาร', onPress: () => router.replace('/(app)/documents/index') },
      ])
    } catch (e: any) {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
      Alert.alert('เกิดข้อผิดพลาด', e.message)
    } finally {
      setUploading(false)
    }
  }

  /* ── Render: select mode ── */
  if (mode === 'select') {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: Light.background }}>
        <View style={sel.header}>
          <TouchableOpacity onPress={() => router.back()} style={sel.backBtn}>
            <Text style={sel.backIcon}>←</Text>
          </TouchableOpacity>
          <Text style={sel.title}>อัปโหลดเอกสาร</Text>
          <View style={{ width: 36 }} />
        </View>

        <ScrollView contentContainerStyle={sel.content}>
          <Text style={sel.subtitle}>เลือกวิธีเพิ่มเอกสาร</Text>

          <TouchableOpacity style={sel.optionPrimary} onPress={() => {
            if (!permission?.granted) { requestPermission(); return }
            setMode('camera')
          }} testID="btn-camera">
            <Text style={sel.optionEmoji}>📷</Text>
            <Text style={sel.optionTitle}>ถ่ายรูปสลิป</Text>
            <Text style={sel.optionDesc}>ใช้กล้องถ่ายใบเสร็จหรือสลิปโดยตรง</Text>
          </TouchableOpacity>

          <TouchableOpacity style={sel.option} onPress={pickFromLibrary} testID="btn-library">
            <Text style={sel.optionEmoji}>🖼️</Text>
            <Text style={sel.optionTitleDark}>เลือกจากรูปภาพ</Text>
            <Text style={sel.optionDescDark}>เลือกภาพจาก Photos / Gallery</Text>
          </TouchableOpacity>

          <TouchableOpacity style={sel.option} onPress={pickPDF} testID="btn-pdf">
            <Text style={sel.optionEmoji}>📄</Text>
            <Text style={sel.optionTitleDark}>เลือกไฟล์ PDF</Text>
            <Text style={sel.optionDescDark}>นำเข้าใบแจ้งหนี้ PDF</Text>
          </TouchableOpacity>

          <View style={sel.tipBox}>
            <Text style={sel.tipTitle}>💡 เคล็ดลับ</Text>
            <Text style={sel.tipText}>ถ่ายให้ชัด ครบทั้งใบ แสงพอ และไม่เอียงมากจะช่วยให้ OCR แม่นยำขึ้น</Text>
          </View>
        </ScrollView>
      </SafeAreaView>
    )
  }

  /* ── Render: camera mode ── */
  if (mode === 'camera') {
    return (
      <View style={{ flex: 1, backgroundColor: '#000' }}>
        <CameraView ref={cameraRef} style={StyleSheet.absoluteFill} facing={facing}>
          {/* Overlay guide */}
          <View style={cam.overlay}>
            <TouchableOpacity onPress={() => setMode('select')} style={cam.closeBtn}>
              <Text style={cam.closeTxt}>✕</Text>
            </TouchableOpacity>
            <View style={cam.frame} />
            <Text style={cam.hint}>จัดใบเสร็จให้อยู่ในกรอบ</Text>
          </View>
          {/* Controls */}
          <View style={cam.controls}>
            <TouchableOpacity onPress={() => setFacing(f => f === 'back' ? 'front' : 'back')} style={cam.ctrlBtn}>
              <Text style={{ fontSize: 22 }}>🔄</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={takePicture} style={cam.shutterOuter} testID="shutter-btn">
              <View style={cam.shutter} />
            </TouchableOpacity>
            <TouchableOpacity onPress={pickFromLibrary} style={cam.ctrlBtn}>
              <Text style={{ fontSize: 22 }}>🖼️</Text>
            </TouchableOpacity>
          </View>
        </CameraView>
      </View>
    )
  }

  /* ── Render: preview mode ── */
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: Light.background }}>
      <View style={prev.header}>
        <TouchableOpacity onPress={() => setMode('select')} style={prev.backBtn}>
          <Text style={prev.backIcon}>←</Text>
        </TouchableOpacity>
        <Text style={prev.title}>ตรวจสอบเอกสาร</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 120 }}>
        {preview?.type === 'image' ? (
          <Image source={{ uri: preview.uri }} style={prev.img} resizeMode="contain" testID="preview-image" />
        ) : (
          <View style={prev.pdfBox}>
            <Text style={{ fontSize: 48 }}>📄</Text>
            <Text style={prev.pdfName} numberOfLines={2}>{preview?.name}</Text>
          </View>
        )}
        <Text style={prev.filename}>{preview?.name}</Text>
      </ScrollView>

      <View style={prev.footer}>
        <TouchableOpacity style={prev.retakeBtn} onPress={() => setMode('select')}>
          <Text style={prev.retakeTxt}>ถ่ายใหม่</Text>
        </TouchableOpacity>
        <TouchableOpacity style={prev.uploadBtn} onPress={upload} disabled={uploading} testID="confirm-upload-btn">
          {uploading
            ? <ActivityIndicator color="#fff" />
            : <Text style={prev.uploadTxt}>📤 อัปโหลด</Text>}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  )
}

const sel = StyleSheet.create({
  header:         { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 14 },
  backBtn:        { width: 36, height: 36, borderRadius: 10, backgroundColor: Light.muted, alignItems: 'center', justifyContent: 'center' },
  backIcon:       { fontSize: 18, color: Light.foreground },
  title:          { fontSize: 17, fontWeight: '700', color: Light.foreground },
  content:        { padding: 20, gap: 12 },
  subtitle:       { fontSize: 13, color: Light.mutedFg, marginBottom: 4 },
  optionPrimary:  { backgroundColor: Brand[500], borderRadius: 18, padding: 24, alignItems: 'center', gap: 6, shadowColor: Brand[500], shadowOpacity: 0.35, shadowRadius: 16, shadowOffset: { width: 0, height: 6 } },
  optionEmoji:    { fontSize: 40 },
  optionTitle:    { fontSize: 17, fontWeight: '800', color: '#fff' },
  optionDesc:     { fontSize: 13, color: 'rgba(255,255,255,0.75)' },
  option:         { backgroundColor: Light.card, borderRadius: 18, padding: 20, alignItems: 'center', gap: 4, borderWidth: 1, borderColor: Light.border },
  optionTitleDark:{ fontSize: 16, fontWeight: '700', color: Light.foreground },
  optionDescDark: { fontSize: 13, color: Light.mutedFg },
  tipBox:         { backgroundColor: Brand[50], borderRadius: 14, padding: 16, borderWidth: 1, borderColor: Brand[200], marginTop: 4 },
  tipTitle:       { fontSize: 13, fontWeight: '700', color: Brand[700], marginBottom: 4 },
  tipText:        { fontSize: 12, color: Brand[600], lineHeight: 18 },
})

const cam = StyleSheet.create({
  overlay:   { flex: 1, justifyContent: 'space-between', padding: 20 },
  closeBtn:  { alignSelf: 'flex-start', width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center' },
  closeTxt:  { color: '#fff', fontSize: 18, fontWeight: '600' },
  frame:     { alignSelf: 'center', width: 280, height: 200, borderRadius: 12, borderWidth: 2, borderColor: 'rgba(255,255,255,0.8)', borderStyle: 'dashed' },
  hint:      { color: 'rgba(255,255,255,0.85)', textAlign: 'center', fontSize: 13, fontWeight: '500' },
  controls:  { flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center', paddingHorizontal: 40, paddingBottom: 40, backgroundColor: 'rgba(0,0,0,0.4)' },
  ctrlBtn:   { width: 50, height: 50, borderRadius: 25, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' },
  shutterOuter: { width: 72, height: 72, borderRadius: 36, borderWidth: 4, borderColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  shutter:   { width: 56, height: 56, borderRadius: 28, backgroundColor: '#fff' },
})

const prev = StyleSheet.create({
  header:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 14 },
  backBtn:   { width: 36, height: 36, borderRadius: 10, backgroundColor: Light.muted, alignItems: 'center', justifyContent: 'center' },
  backIcon:  { fontSize: 18, color: Light.foreground },
  title:     { fontSize: 17, fontWeight: '700', color: Light.foreground },
  img:       { width: '100%', height: 400, borderRadius: 16, backgroundColor: Light.muted },
  pdfBox:    { backgroundColor: Light.muted, borderRadius: 16, padding: 48, alignItems: 'center', gap: 12 },
  pdfName:   { fontSize: 14, color: Light.mutedFg, textAlign: 'center' },
  filename:  { marginTop: 12, fontSize: 13, color: Light.mutedFg, textAlign: 'center' },
  footer:    { position: 'absolute', bottom: 0, left: 0, right: 0, flexDirection: 'row', gap: 12, padding: 20, backgroundColor: Light.card, borderTopWidth: 1, borderTopColor: Light.border },
  retakeBtn: { flex: 1, paddingVertical: 14, borderRadius: 14, borderWidth: 1, borderColor: Light.border, alignItems: 'center' },
  retakeTxt: { fontSize: 15, fontWeight: '600', color: Light.foreground },
  uploadBtn: { flex: 2, paddingVertical: 14, borderRadius: 14, backgroundColor: Brand[500], alignItems: 'center', shadowColor: Brand[500], shadowOpacity: 0.35, shadowRadius: 10, shadowOffset: { width: 0, height: 4 } },
  uploadTxt: { fontSize: 15, fontWeight: '700', color: '#fff' },
})
