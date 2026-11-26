import { describe, expect, it } from "vitest"

import { buildPayslipMessage, cleanPhoneNumber, openWhatsAppPayslip } from "../src/renderer/utils/whatsapp"
import { CompanySettings, Payslip } from "../src/renderer/types"

const settings: CompanySettings = {
  companyName: "Al-Sabah Trading",
  ownerName: "Bader",
  ownerRole: "GM",
  currency: "KWD",
  currencyDecimals: 3,
  defaultDailyHours: 8,
  standardWorkDays: 26,
  overtimeMultiplier: 1.25,
  shiftStartMinutes: 480,
  shiftEndMinutes: 1020,
  graceMinutes: 10,
  workDays: [0, 1, 2, 3, 4],
  isConfigured: true,
  hasPassword: true,
  logoPath: null
}

const slip: Payslip = {
  id: "ps-1",
  number: "PS-2026-0001",
  employeeId: "emp-1",
  employeeName: "Ali Hassan",
  employeeCode: "KW-100",
  department: "Operations",
  salaryType: "fixed_monthly",
  baseRateMinor: 300_000,
  periodStart: "2026-11-01",
  periodEnd: "2026-11-30",
  workedDays: 26,
  workedMinutes: 12_480,
  breakMinutes: 0,
  overtimeMinutes: 120,
  unpaidLeaveDays: 0,
  baseSalaryMinor: 300_000,
  overtimeAmountMinor: 3_605,
  bonusesMinor: 0,
  deductionsMinor: 0,
  netAmountMinor: 303_605,
  paymentDate: "2026-11-30",
  paymentMethod: "bank_transfer",
  notes: "",
  isSigned: false,
  signedAt: null,
  createdAt: "2026-11-30T00:00:00.000Z"
}

const formatMoneyFn = (minor: number) => `KWD ${(minor / 1000).toFixed(3)}`
const build = (overrides: Partial<Payslip> = {}, lang = "en") =>
  buildPayslipMessage({ slip: { ...slip, ...overrides }, settings, lang, formatMoneyFn })

describe("phone normalisation", () => {
  it("turns local 8-digit kuwaiti numbers into wa.me numbers", () => {
    expect(cleanPhoneNumber("12345678")).toBe("96512345678")
    expect(cleanPhoneNumber("012345678")).toBe("96512345678")
    expect(cleanPhoneNumber(" 1234 5678 ")).toBe("96512345678")
  })

  it("strips separators from numbers that already include the country code", () => {
    expect(cleanPhoneNumber("+965 9000 1111")).toBe("96590001111")
    expect(cleanPhoneNumber("965-1234-5678")).toBe("96512345678")
  })

  it("rejects unusable input instead of opening a wrong chat", () => {
    expect(cleanPhoneNumber("")).toBe("")
    expect(cleanPhoneNumber(null)).toBe("")
    expect(cleanPhoneNumber(undefined)).toBe("")
    expect(cleanPhoneNumber("abc")).toBe("")
    expect(cleanPhoneNumber("12345")).toBe("")
    expect(cleanPhoneNumber("1234567890123456")).toBe("")
    expect(openWhatsAppPayslip({ phone: "", message: "hello" })).toBe(false)
  })

  it("keeps plausible international numbers untouched", () => {
    expect(cleanPhoneNumber("447700900123")).toBe("447700900123")
  })
})

describe("payslip message", () => {
  it("includes the identity, period and net pay in english", () => {
    const message = build()
    expect(message).toContain("Al-Sabah Trading")
    expect(message).toContain("Ali Hassan")
    expect(message).toContain("KW-100")
    expect(message).toContain("Operations")
    expect(message).toContain("2026-11-01 ~ 2026-11-30")
    expect(message).toContain("26 days (208.0 hrs)")
    expect(message).toContain("Base Salary: KWD 300.000")
    expect(message).toContain("Overtime: +KWD 3.605")
    expect(message).toContain("Net Payable: KWD 303.605")
    expect(message).toContain("2026-11-30")
  })

  it("hides zero overtime, bonuses and deductions instead of printing +0", () => {
    const message = build({ overtimeAmountMinor: 0, bonusesMinor: 0, deductionsMinor: 0 })
    expect(message).not.toContain("Overtime")
    expect(message).not.toContain("Bonuses")
    expect(message).not.toContain("Deductions")
    expect(message).toContain("Net Payable: KWD 303.605")
  })

  it("prints bonuses and deductions when they exist", () => {
    const message = build({ bonusesMinor: 15_000, deductionsMinor: 7_500 })
    expect(message).toContain("Bonuses: +KWD 15.000")
    expect(message).toContain("Deductions: -KWD 7.500")
  })

  it("falls back to a department label and translates the footer", () => {
    const arabic = build({ department: "" }, "ar")
    expect(arabic).toContain("القسم: عام")
    expect(arabic).toContain("صافي الراتب المستحق: KWD 303.605")
    expect(arabic).toContain("مع تحيات الإدارة العامة")

    const farsi = build({ department: "" }, "fa")
    expect(farsi).toContain("بخش: عمومی")
    expect(farsi).toContain("مبلغ خالص پرداختی: KWD 303.605")
    expect(farsi).toContain("با تشکر و احترام، مدیریت مجموعه")
  })

  it("rounds the reported hours to one decimal", () => {
    expect(build({ workedMinutes: 483 })).toContain("(8.1 hrs)")
  })
})
