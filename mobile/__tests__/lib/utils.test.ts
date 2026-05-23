import { fmtTHB, relTime, fmtDate, initials, clamp, calcVAT } from '../../src/lib/utils'

describe('fmtTHB', () => {
  it('formats zero', () => { expect(fmtTHB(0)).toBe('฿0') })
  it('formats integer with comma', () => { expect(fmtTHB(142380)).toBe('฿142,380') })
  it('formats with decimals', () => { expect(fmtTHB(8750, 2)).toBe('฿8,750.00') })
})

describe('relTime', () => {
  it('returns เมื่อกี้ for < 1 min ago', () => {
    const iso = new Date(Date.now() - 30_000).toISOString()
    expect(relTime(iso)).toBe('เมื่อกี้')
  })
  it('returns นาทีที่แล้ว for < 1 hour', () => {
    const iso = new Date(Date.now() - 5 * 60_000).toISOString()
    expect(relTime(iso)).toMatch(/นาทีที่แล้ว/)
  })
  it('returns ชม.ที่แล้ว for < 1 day', () => {
    const iso = new Date(Date.now() - 2 * 3_600_000).toISOString()
    expect(relTime(iso)).toMatch(/ชม\.ที่แล้ว/)
  })
  it('returns วันที่แล้ว for < 1 week', () => {
    const iso = new Date(Date.now() - 3 * 86_400_000).toISOString()
    expect(relTime(iso)).toMatch(/วันที่แล้ว/)
  })
})

describe('initials', () => {
  it('returns first letter of each word, max 2', () => {
    expect(initials('นภัทร เจริญพร')).toBe('นจ')
    expect(initials('Amazon Web Services')).toBe('AW')
  })
  it('handles single word', () => {
    expect(initials('Slippy')).toBe('S')
  })
})

describe('clamp', () => {
  it('clamps to min', () => { expect(clamp(-5, 0, 100)).toBe(0) })
  it('clamps to max', () => { expect(clamp(150, 0, 100)).toBe(100) })
  it('returns value in range', () => { expect(clamp(50, 0, 100)).toBe(50) })
})

describe('calcVAT', () => {
  it('calculates 7% VAT from total (tax-inclusive)', () => {
    const { vat, net } = calcVAT(8750)
    expect(vat).toBeCloseTo(571.96, 1)
    expect(net).toBeCloseTo(8178.04, 1)
  })
  it('vat + net ≈ total (within 1 baht due to rounding)', () => {
    const total = 1230
    const { vat, net } = calcVAT(total)
    expect(Math.abs(vat + net - total)).toBeLessThan(1)
  })
  it('handles zero', () => {
    const { vat, net } = calcVAT(0)
    expect(vat).toBe(0)
    expect(net).toBe(0)
  })
})
