/** Shows error codes returned from OAuth callbacks as a readable banner */

const ERROR_MESSAGES: Record<string, string> = {
  line_cancelled:      "ยกเลิกการเข้าสู่ระบบด้วย LINE",
  line_state_mismatch: "Session หมดอายุ กรุณาลองใหม่",
  line_no_code:        "ไม่ได้รับ authorization code จาก LINE",
  line_not_configured: "LINE Login ยังไม่ได้ตั้งค่า",
  line_token:          "แลก token จาก LINE ไม่สำเร็จ",
  line_profile:        "ดึงข้อมูลโปรไฟล์ LINE ไม่สำเร็จ",
  line_create:         "สร้างบัญชีไม่สำเร็จ",
  line_session:        "สร้าง session ไม่สำเร็จ",
  line_unexpected:     "เกิดข้อผิดพลาดที่ไม่คาดคิด",
  auth:                "เข้าสู่ระบบไม่สำเร็จ กรุณาลองใหม่",
}

export async function OAuthErrorBanner({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; detail?: string }>
}) {
  const { error, detail } = await searchParams
  if (!error) return null

  const message = ERROR_MESSAGES[error] ?? `เกิดข้อผิดพลาด: ${error}`

  return (
    <div className="mb-5 p-3.5 rounded-[10px] bg-red-50 border border-red-200
      text-red-700 text-sm flex flex-col gap-1">
      <div className="font-semibold flex items-center gap-2">
        <span>⚠️</span> {message}
      </div>
      {detail && (
        <div className="text-xs text-red-500 font-mono break-all">
          {decodeURIComponent(detail)}
        </div>
      )}
    </div>
  )
}
