import Link from "next/link"
import { LogoMark } from "@/components/ui/logo"
import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "นโยบาย Cookie | Slippy",
  description: "นโยบายการใช้คุกกี้ของ Slippy — ประเภท วัตถุประสงค์ และวิธีจัดการคุกกี้",
}

export default function CookiePolicyPage() {
  return (
    <div className="min-h-screen bg-white">
      {/* Nav */}
      <nav className="border-b border-gray-100 px-6 h-16 flex items-center justify-between max-w-4xl mx-auto">
        <Link href="/" className="flex items-center gap-2">
          <LogoMark size={28} />
          <span className="font-black text-lg text-gray-900">Slippy</span>
        </Link>
        <Link href="/" className="text-sm text-gray-500 hover:text-indigo-600 transition-colors">← กลับหน้าหลัก</Link>
      </nav>

      <main className="max-w-3xl mx-auto px-6 py-12 prose prose-sm prose-gray max-w-none">
        <h1 className="text-3xl font-black text-gray-900 mb-2">นโยบายการใช้คุกกี้</h1>
        <p className="text-gray-400 text-sm mb-8">อัพเดตล่าสุด: 23 พฤษภาคม 2569 | เวอร์ชัน 1.0</p>

        <Section title="คุกกี้คืออะไร?">
          <p>
            คุกกี้ (Cookie) คือไฟล์ข้อความขนาดเล็กที่ถูกจัดเก็บบนอุปกรณ์ของคุณเมื่อคุณเข้าชมเว็บไซต์
            คุกกี้ช่วยให้เว็บไซต์จดจำการตั้งค่า ข้อมูลการล็อกอิน และพฤติกรรมการใช้งานของคุณ
            เพื่อมอบประสบการณ์ที่ดีกว่าในครั้งถัดไป
          </p>
        </Section>

        <Section title="เราใช้คุกกี้ประเภทใดบ้าง?">
          <CookieTable rows={[
            {
              name: "คุกกี้จำเป็น (Strictly Necessary)",
              purpose: "จำเป็นสำหรับการทำงานพื้นฐานของเว็บไซต์ เช่น session การล็อกอิน และการรักษาความปลอดภัย",
              examples: "sb-access-token, sb-refresh-token, CSRF token",
              duration: "Session — 7 วัน",
              canDisable: false,
            },
            {
              name: "คุกกี้วิเคราะห์ (Analytics)",
              purpose: "ช่วยเราเข้าใจว่าผู้ใช้โต้ตอบกับเว็บไซต์อย่างไร เพื่อปรับปรุงประสบการณ์ใช้งาน ข้อมูลไม่ระบุตัวตน",
              examples: "_ga, _gid (Google Analytics), _plausible",
              duration: "2 ปี",
              canDisable: true,
            },
            {
              name: "คุกกี้การตลาด (Marketing)",
              purpose: "ใช้เพื่อแสดงโฆษณาและเนื้อหาที่เกี่ยวข้องกับคุณ บน Slippy และเว็บไซต์พาร์ทเนอร์",
              examples: "_fbp (Meta Pixel), Google Ads",
              duration: "90 วัน",
              canDisable: true,
            },
            {
              name: "คุกกี้ความชอบ (Preferences)",
              purpose: "จดจำการตั้งค่าของคุณ เช่น ภาษา โหมดมืด และ layout ที่เลือก",
              examples: "slippy_theme, slippy_locale",
              duration: "1 ปี",
              canDisable: true,
            },
          ]} />
        </Section>

        <Section title="บุคคลที่สามที่ตั้งคุกกี้บนเว็บไซต์ของเรา">
          <ThirdPartyTable rows={[
            { party: "Google Analytics", purpose: "วิเคราะห์การเข้าชม", policy: "https://policies.google.com/privacy" },
            { party: "Google Fonts",     purpose: "โหลดฟอนต์", policy: "https://policies.google.com/privacy" },
            { party: "Supabase",         purpose: "Auth และ session", policy: "https://supabase.com/privacy" },
            { party: "Stripe",           purpose: "การชำระเงิน", policy: "https://stripe.com/privacy" },
            { party: "Meta Pixel",       purpose: "โฆษณา (ต้องได้รับความยินยอม)", policy: "https://www.facebook.com/privacy" },
          ]} />
        </Section>

        <Section title="วิธีจัดการหรือปิดคุกกี้">
          <ul className="space-y-3 text-sm text-gray-600">
            <li>
              <strong className="text-gray-900">ผ่าน Banner ของเรา:</strong>{" "}
              คลิกที่ปุ่ม 🍪 ที่มุมล่างซ้ายของหน้าเว็บ เพื่อเปิดการตั้งค่า Cookie และเปลี่ยนความยินยอมได้ทุกเมื่อ
            </li>
            <li>
              <strong className="text-gray-900">ผ่านเบราว์เซอร์:</strong>{" "}
              คุณสามารถตั้งค่าเบราว์เซอร์ให้บล็อก หรือแจ้งเตือนก่อนตั้งคุกกี้ได้
              แต่อาจส่งผลให้บางฟีเจอร์ของเว็บไซต์ทำงานไม่ถูกต้อง
              <ul className="mt-2 space-y-1 text-xs text-gray-500 ml-4">
                <li>Chrome: การตั้งค่า → ความเป็นส่วนตัว → คุกกี้</li>
                <li>Firefox: Preferences → Privacy & Security</li>
                <li>Safari: Settings → Privacy → Cookies</li>
              </ul>
            </li>
            <li>
              <strong className="text-gray-900">Opt-out Google Analytics:</strong>{" "}
              ติดตั้ง{" "}
              <a href="https://tools.google.com/dlpage/gaoptout" target="_blank" rel="noopener noreferrer" className="text-indigo-600 hover:underline">
                Google Analytics Opt-out Browser Add-on
              </a>
            </li>
          </ul>
        </Section>

        <Section title="PDPA และสิทธิ์ของคุณ">
          <p>
            ภายใต้ พ.ร.บ. คุ้มครองข้อมูลส่วนบุคคล พ.ศ. 2562 (PDPA) คุณมีสิทธิ์:
          </p>
          <ul className="space-y-2 text-sm text-gray-600 mt-2">
            <li>✅ เพิกถอนความยินยอมได้ทุกเมื่อ โดยไม่กระทบสิทธิ์ที่เคยให้ไว้</li>
            <li>✅ ขอเข้าถึงข้อมูลส่วนบุคคลที่เราเก็บไว้</li>
            <li>✅ ขอลบ แก้ไข หรือโอนย้ายข้อมูลของคุณ</li>
            <li>✅ คัดค้านหรือจำกัดการประมวลผลข้อมูล</li>
          </ul>
          <p className="mt-4 text-sm">
            ติดต่อเจ้าหน้าที่คุ้มครองข้อมูล (DPO):{" "}
            <a href="mailto:dpo@slippy.app" className="text-indigo-600 hover:underline">dpo@slippy.app</a>
          </p>
        </Section>

        <Section title="การอัพเดตนโยบายนี้">
          <p>
            เราอาจอัพเดตนโยบาย Cookie นี้เป็นครั้งคราว เมื่อมีการเปลี่ยนแปลงสำคัญ
            เราจะแสดง Banner ใหม่เพื่อขอความยินยอมอีกครั้ง
            คุณสามารถดูเวอร์ชันปัจจุบันได้ที่หน้านี้เสมอ
          </p>
        </Section>

        <div className="mt-12 p-6 bg-indigo-50 rounded-2xl border border-indigo-100">
          <p className="text-sm text-indigo-900 font-semibold mb-2">มีคำถามเกี่ยวกับ Cookie?</p>
          <p className="text-sm text-indigo-700">
            ติดต่อเราที่{" "}
            <a href="mailto:privacy@slippy.app" className="font-bold hover:underline">privacy@slippy.app</a>
            {" "}หรือ{" "}
            <Link href="/privacy-policy" className="font-bold hover:underline">อ่านนโยบายความเป็นส่วนตัวฉบับเต็ม</Link>
          </p>
        </div>
      </main>
    </div>
  )
}

// ── Sub-components ──────────────────────────────────────────
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-10">
      <h2 className="text-xl font-black text-gray-900 mb-4 pb-2 border-b border-gray-100">{title}</h2>
      <div className="text-sm text-gray-600 leading-relaxed space-y-3">{children}</div>
    </div>
  )
}

function CookieTable({ rows }: {
  rows: { name: string; purpose: string; examples: string; duration: string; canDisable: boolean }[]
}) {
  return (
    <div className="overflow-x-auto rounded-xl border border-gray-100 shadow-sm mt-4">
      <table className="w-full text-xs">
        <thead className="bg-gray-50">
          <tr>
            {["ประเภท", "วัตถุประสงค์", "ตัวอย่าง", "อายุ", "ปิดได้"].map(h => (
              <th key={h} className="text-left px-4 py-3 font-bold text-gray-700">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className="border-t border-gray-50 hover:bg-gray-50/50">
              <td className="px-4 py-3 font-semibold text-gray-900 whitespace-nowrap">{row.name}</td>
              <td className="px-4 py-3 text-gray-500 max-w-[200px]">{row.purpose}</td>
              <td className="px-4 py-3 text-gray-400 font-mono text-[10px]">{row.examples}</td>
              <td className="px-4 py-3 text-gray-500 whitespace-nowrap">{row.duration}</td>
              <td className="px-4 py-3 text-center">
                {row.canDisable
                  ? <span className="text-green-500 font-bold">✓</span>
                  : <span className="text-gray-400 text-xs">จำเป็น</span>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function ThirdPartyTable({ rows }: {
  rows: { party: string; purpose: string; policy: string }[]
}) {
  return (
    <div className="overflow-x-auto rounded-xl border border-gray-100 shadow-sm mt-4">
      <table className="w-full text-xs">
        <thead className="bg-gray-50">
          <tr>
            {["บุคคลที่สาม", "วัตถุประสงค์", "นโยบายความเป็นส่วนตัว"].map(h => (
              <th key={h} className="text-left px-4 py-3 font-bold text-gray-700">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className="border-t border-gray-50 hover:bg-gray-50/50">
              <td className="px-4 py-3 font-semibold text-gray-900">{row.party}</td>
              <td className="px-4 py-3 text-gray-500">{row.purpose}</td>
              <td className="px-4 py-3">
                <a href={row.policy} target="_blank" rel="noopener noreferrer"
                  className="text-indigo-600 hover:underline">
                  อ่านนโยบาย →
                </a>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
