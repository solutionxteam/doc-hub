/**
 * Copyright © 2026 SolutionX Co., Ltd. (บริษัท โซลูชั่น เอ็กซ์ จำกัด)
 * All rights reserved.
 *
 * This software is proprietary and confidential.
 * Unauthorized copying, modification, distribution, or use of this software,
 * in whole or in part, is strictly prohibited without prior written permission.
 */

import Link from "next/link"
import { LogoMark } from "@/components/ui/logo"
import { SecurityIcon, SECURITY_BADGES } from "@/components/ui/security-icon"
import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "นโยบายความเป็นส่วนตัว | Slippy",
  description: "นโยบายความเป็นส่วนตัว PDPA ของ Slippy — การเก็บรวบรวม ใช้ และเปิดเผยข้อมูลส่วนบุคคล",
}

export default function PrivacyPolicyPage() {
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

      <main className="max-w-3xl mx-auto px-6 py-12">
        <h1 className="text-3xl font-black text-gray-900 mb-2">นโยบายความเป็นส่วนตัว</h1>
        <p className="text-gray-400 text-sm mb-2">อัพเดตล่าสุด: 23 พฤษภาคม 2569 | เวอร์ชัน 1.0</p>
        <p className="text-gray-500 text-sm mb-10 leading-relaxed">
          บริษัท สลิปปี้ จำกัด (&quot;Slippy&quot;, &quot;เรา&quot;) มีความมุ่งมั่นในการปกป้องความเป็นส่วนตัวของคุณ
          นโยบายนี้อธิบายว่าเราเก็บรวบรวม ใช้ เปิดเผย และปกป้องข้อมูลส่วนบุคคลของคุณอย่างไร
          ตามพระราชบัญญัติคุ้มครองข้อมูลส่วนบุคคล พ.ศ. 2562 (PDPA)
        </p>

        <div className="space-y-10 text-sm text-gray-600 leading-relaxed">

          <PolicySection num="1" title="ข้อมูลที่เราเก็บรวบรวม">
            <SubSection title="1.1 ข้อมูลที่คุณให้โดยตรง">
              <ul className="list-disc list-inside space-y-1.5 mt-2">
                <li>ชื่อ-นามสกุล อีเมล และรหัสผ่าน (เข้ารหัส)</li>
                <li>ข้อมูลบริษัท เลขนิติบุคคล ที่อยู่สำนักงาน</li>
                <li>เอกสารทางบัญชี ใบกำกับภาษี ใบเสร็จรับเงิน</li>
                <li>ข้อมูลการชำระเงิน (ผ่าน Stripe — เราไม่เก็บหมายเลขบัตรโดยตรง)</li>
              </ul>
            </SubSection>
            <SubSection title="1.2 ข้อมูลที่เก็บโดยอัตโนมัติ">
              <ul className="list-disc list-inside space-y-1.5 mt-2">
                <li>IP address, User-Agent, Referrer URL</li>
                <li>บันทึกการใช้งาน (logs) และเหตุการณ์ในระบบ</li>
                <li>ข้อมูล Cookie และ Device ID (ดู <Link href="/cookie-policy" className="text-indigo-600 hover:underline">นโยบาย Cookie</Link>)</li>
              </ul>
            </SubSection>
            <SubSection title="1.3 ข้อมูลจาก Third Party">
              <ul className="list-disc list-inside space-y-1.5 mt-2">
                <li>LINE User ID เมื่อเชื่อมต่อ LINE Bot</li>
                <li>Google Account (หากใช้ Sign in with Google)</li>
              </ul>
            </SubSection>
          </PolicySection>

          <PolicySection num="2" title="วัตถุประสงค์และฐานทางกฎหมาย">
            <div className="overflow-x-auto rounded-xl border border-gray-100 mt-3">
              <table className="w-full text-xs">
                <thead className="bg-gray-50">
                  <tr>
                    {["วัตถุประสงค์", "ฐานทางกฎหมาย (PDPA ม.24)"].map(h => (
                      <th key={h} className="text-left px-4 py-3 font-bold text-gray-700">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {[
                    ["ให้บริการแพลตฟอร์ม Slippy", "การปฏิบัติตามสัญญา (Contractual)"],
                    ["ประมวลผลเอกสาร AI", "การปฏิบัติตามสัญญา + ความยินยอม"],
                    ["ส่งอีเมลแจ้งเตือนระบบ", "ประโยชน์อันชอบธรรม (Legitimate Interest)"],
                    ["วิเคราะห์การใช้งานเพื่อปรับปรุง", "ความยินยอม (Consent)"],
                    ["การตลาดและโฆษณา", "ความยินยอม (Consent)"],
                    ["ป้องกันการฉ้อโกง", "ประโยชน์อันชอบธรรม / กฎหมาย"],
                    ["ปฏิบัติตามข้อกำหนดทางภาษี", "การปฏิบัติตามกฎหมาย (Legal Obligation)"],
                  ].map(([purpose, basis], i) => (
                    <tr key={i} className="border-t border-gray-50 hover:bg-gray-50/50">
                      <td className="px-4 py-3 text-gray-700">{purpose}</td>
                      <td className="px-4 py-3 text-gray-500">{basis}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </PolicySection>

          <PolicySection num="3" title="การเปิดเผยข้อมูลแก่บุคคลที่สาม">
            <p>เราไม่ขายข้อมูลส่วนบุคคลของคุณ เราเปิดเผยข้อมูลเฉพาะในกรณีต่อไปนี้:</p>
            <ul className="list-disc list-inside space-y-2 mt-3">
              <li><strong>ผู้ให้บริการ (Processors):</strong> Supabase, Google Cloud, Stripe, Postmark — เพื่อให้บริการ</li>
              <li><strong>ผู้ร่วมบริการ:</strong> FlowAccount, PEAK (เมื่อคุณเปิดใช้งาน Integration)</li>
              <li><strong>กฎหมาย:</strong> เมื่อถูกบังคับโดยคำสั่งศาลหรือหน่วยงานรัฐ</li>
              <li><strong>การโอนกิจการ:</strong> หากมีการควบรวมหรือขายกิจการ คุณจะได้รับแจ้งล่วงหน้า</li>
            </ul>
          </PolicySection>

          <PolicySection num="4" title="การรักษาความปลอดภัย">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-3">
              {SECURITY_BADGES.map(b => (
                <div key={b.label}
                  className="bg-white border border-gray-100 rounded-2xl p-4 text-center
                    hover:border-indigo-200 hover:shadow-sm transition-all group">
                  <div className="flex justify-center mb-3
                    group-hover:scale-105 transition-transform duration-200">
                    <SecurityIcon id={b.id} size={44} />
                  </div>
                  <div className="font-black text-gray-900 text-xs">{b.label}</div>
                  <div className="text-gray-400 text-[10px] mt-0.5">{b.sub}</div>
                </div>
              ))}
            </div>
          </PolicySection>

          <PolicySection num="5" title="ระยะเวลาการเก็บรักษาข้อมูล">
            <ul className="list-disc list-inside space-y-2 mt-2">
              <li>ข้อมูลบัญชีและเอกสาร: ตลอดระยะที่ใช้งาน + 3 ปี (ตามข้อกำหนดทางบัญชีไทย)</li>
              <li>บันทึกการใช้งาน (Logs): 90 วัน</li>
              <li>ข้อมูล Cookie: ตามที่ระบุใน <Link href="/cookie-policy" className="text-indigo-600 hover:underline">นโยบาย Cookie</Link></li>
              <li>หลังยกเลิกบัญชี: ลบข้อมูลส่วนบุคคลภายใน 30 วัน (ยกเว้นที่กฎหมายกำหนดให้เก็บ)</li>
            </ul>
          </PolicySection>

          <PolicySection num="6" title="สิทธิ์ของเจ้าของข้อมูล (Data Subject Rights)">
            <div className="grid md:grid-cols-2 gap-3 mt-3">
              {[
                { right: "✅ สิทธิ์รับทราบ", desc: "ทราบว่าเราเก็บข้อมูลอะไร" },
                { right: "✅ สิทธิ์เข้าถึง", desc: "ขอสำเนาข้อมูลของคุณ" },
                { right: "✅ สิทธิ์แก้ไข", desc: "ขอแก้ไขข้อมูลที่ไม่ถูกต้อง" },
                { right: "✅ สิทธิ์ลบ", desc: "ขอลบข้อมูล (right to erasure)" },
                { right: "✅ สิทธิ์โอนย้าย", desc: "รับข้อมูลในรูปแบบที่อ่านได้" },
                { right: "✅ สิทธิ์คัดค้าน", desc: "คัดค้านการประมวลผลบางประเภท" },
                { right: "✅ เพิกถอนความยินยอม", desc: "ถอนความยินยอมได้ทุกเมื่อ" },
                { right: "✅ ร้องเรียน", desc: "ร้องเรียนต่อ สคส. (PDPC Thailand)" },
              ].map(r => (
                <div key={r.right} className="flex gap-2 text-xs p-3 bg-gray-50 rounded-xl">
                  <span className="font-semibold text-gray-900 shrink-0">{r.right}</span>
                  <span className="text-gray-500">{r.desc}</span>
                </div>
              ))}
            </div>
            <p className="mt-4">
              ยื่นคำขอใช้สิทธิ์ได้ที่ <a href="mailto:dpo@slippy.app" className="text-indigo-600 hover:underline font-semibold">dpo@slippy.app</a> เราจะตอบกลับภายใน 30 วัน
            </p>
          </PolicySection>

          <PolicySection num="7" title="การถ่ายโอนข้อมูลระหว่างประเทศ">
            <p>
              เราเก็บและประมวลผลข้อมูลหลักบนเซิร์ฟเวอร์ในภูมิภาค Asia Pacific (Singapore)
              บนโครงสร้างพื้นฐาน Google Cloud ซึ่งมีมาตรฐาน SOC 2, ISO 27001
              หากมีการถ่ายโอนข้อมูลข้ามชาติ เราใช้กลไกทางกฎหมายที่เหมาะสม
              เช่น Standard Contractual Clauses (SCCs)
            </p>
          </PolicySection>

          <PolicySection num="8" title="ข้อมูลผู้เยาว์">
            <p>
              บริการ Slippy มีวัตถุประสงค์สำหรับผู้ที่มีอายุ 18 ปีขึ้นไปหรือนิติบุคคล
              เราไม่จงใจเก็บข้อมูลจากผู้เยาว์ หากพบว่ามีการเก็บข้อมูลดังกล่าวโดยไม่ได้ตั้งใจ
              โปรดติดต่อเราเพื่อดำเนินการลบทันที
            </p>
          </PolicySection>

          <PolicySection num="9" title="ติดต่อเรา">
            <div className="bg-indigo-50 border border-indigo-100 rounded-2xl p-5 mt-3 space-y-2">
              <p><strong>บริษัท สลิปปี้ จำกัด (Slippy Co., Ltd.)</strong></p>
              <p>เจ้าหน้าที่คุ้มครองข้อมูล (DPO): <a href="mailto:dpo@slippy.app" className="text-indigo-600 hover:underline">dpo@slippy.app</a></p>
              <p>ทั่วไป: <a href="mailto:privacy@slippy.app" className="text-indigo-600 hover:underline">privacy@slippy.app</a></p>
              <p>LINE: <a href="https://line.me/R/ti/p/@slippy_bot" className="text-indigo-600 hover:underline" target="_blank" rel="noopener noreferrer">@slippy_bot</a></p>
            </div>
          </PolicySection>
        </div>

        <div className="mt-12 flex gap-3">
          <Link href="/cookie-policy"
            className="px-5 py-2.5 text-sm font-semibold text-indigo-700 bg-indigo-50 border border-indigo-100 rounded-xl hover:bg-indigo-100 transition-colors">
            📋 นโยบาย Cookie
          </Link>
          <Link href="/"
            className="px-5 py-2.5 text-sm font-semibold text-gray-600 bg-gray-50 border border-gray-100 rounded-xl hover:bg-gray-100 transition-colors">
            ← กลับหน้าหลัก
          </Link>
        </div>
      </main>
    </div>
  )
}

function PolicySection({ num, title, children }: { num: string; title: string; children: React.ReactNode }) {
  return (
    <div>
      <h2 className="text-lg font-black text-gray-900 mb-3 pb-2 border-b border-gray-100">
        <span className="text-indigo-500 mr-2">{num}.</span>{title}
      </h2>
      <div className="space-y-3">{children}</div>
    </div>
  )
}

function SubSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mt-3">
      <h3 className="font-bold text-gray-800 text-sm mb-1">{title}</h3>
      {children}
    </div>
  )
}
