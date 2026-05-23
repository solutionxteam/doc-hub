export default function PrivacyPage() {
  return (
    <div className="p-6 lg:p-7 max-w-[900px]">
      <div className="mb-6">
        <h2 className="text-xl font-bold">ความเป็นส่วนตัว · PDPA</h2>
        <p className="text-sm text-muted-foreground mt-0.5">จัดการการยินยอม ความปลอดภัย และข้อมูลของคุณ</p>
      </div>
      <div className="grid gap-4">
        {[
          { title: "ความยินยอม PDPA", desc: "จัดการการยินยอมการประมวลผลข้อมูลส่วนบุคคลทั้ง 6 ประเภท", icon: "🛡" },
          { title: "ความปลอดภัยบัญชี", desc: "เปลี่ยนรหัสผ่าน, เปิด 2FA, Face ID, การแจ้งเตือนเข้าสู่ระบบ", icon: "🔐" },
          { title: "อุปกรณ์ที่ล็อกอิน", desc: "ดูและจัดการอุปกรณ์ทั้งหมดที่เข้าสู่ระบบอยู่", icon: "📱" },
          { title: "บันทึกกิจกรรม", desc: "ประวัติการดำเนินการทั้งหมดในบัญชีของคุณ", icon: "📋" },
          { title: "ข้อมูลของฉัน", desc: "ขอส่งออกข้อมูล หรือลบบัญชีและข้อมูลทั้งหมด", icon: "📦" },
        ].map((s) => (
          <div key={s.title} className="bg-card border border-border rounded-xl p-5 flex items-center gap-4 hover:shadow-sm transition cursor-pointer">
            <div className="h-12 w-12 rounded-[10px] bg-muted flex items-center justify-center text-2xl shrink-0">{s.icon}</div>
            <div className="flex-1">
              <div className="font-semibold">{s.title}</div>
              <div className="text-sm text-muted-foreground mt-0.5">{s.desc}</div>
            </div>
            <svg className="text-muted-foreground" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m9 18 6-6-6-6"/></svg>
          </div>
        ))}
      </div>
    </div>
  )
}
