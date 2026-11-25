import { describe, expect, it } from "vitest"
import {
  computeNetMinor,
  dailyRateMinor,
  hourlyRateMinor,
  suggestBaseSalaryMinor,
  suggestOvertimeAmountMinor,
  suggestUnpaidLeaveDeductionMinor
} from "../src/renderer/services/payroll"
import { AttendanceSummary, CompanySettings, Employee } from "../src/renderer/types"

const settings: CompanySettings = {
  companyName: "Test Co",
  ownerName: "Owner",
  ownerRole: "GM",
  currency: "KWD",
  currencyDecimals: 3,
  defaultDailyHours: 8,
  standardWorkDays: 26,
  overtimeMultiplier: 1.25,
  isConfigured: true,
  hasPassword: true,
  logoPath: null
}

const employee = (overrides: Partial<Employee>): Employee => ({
  id: "emp-1",
  fullName: "Ali",
  employeeCode: "KW-1",
  phone: "",
  department: "Ops",
  salaryType: "fixed_monthly",
  baseRateMinor: 300_000,
  isActive: true,
  createdAt: "2026-01-01T00:00:00.000Z",
  ...overrides
})

const summary = (overrides: Partial<AttendanceSummary> = {}): AttendanceSummary => ({
  workedDays: 0,
  workedMinutes: 0,
  breakMinutes: 0,
  overtimeMinutes: 0,
  openRecords: 0,
  firstDate: null,
  lastDate: null,
  ...overrides
})

describe("rates", () => {
  it("derives daily and hourly rates for a monthly salary", () => {
    const monthly = employee({ salaryType: "fixed_monthly", baseRateMinor: 300_000 })
    expect(dailyRateMinor(monthly, settings)).toBe(11538) // 300 / 26
    expect(hourlyRateMinor(monthly, settings)).toBe(1442) // 300 / 208
  })

  it("uses the stored rate directly for hourly and daily staff", () => {
    expect(hourlyRateMinor(employee({ salaryType: "hourly", baseRateMinor: 2500 }), settings)).toBe(2500)
    expect(dailyRateMinor(employee({ salaryType: "daily", baseRateMinor: 12_000 }), settings)).toBe(12_000)
    expect(hourlyRateMinor(employee({ salaryType: "daily", baseRateMinor: 12_000 }), settings)).toBe(1500)
  })
})

describe("base salary suggestions", () => {
  it("pays a fixed salary regardless of hours", () => {
    expect(suggestBaseSalaryMinor(employee({}), settings, summary({ workedDays: 20 }))).toBe(300_000)
  })

  it("pays hourly staff for real minutes only", () => {
    const hourly = employee({ salaryType: "hourly", baseRateMinor: 5000 })
    expect(suggestBaseSalaryMinor(hourly, settings, summary({ workedMinutes: 600 }))).toBe(50_000)
  })

  it("pays daily staff for real days only", () => {
    const daily = employee({ salaryType: "daily", baseRateMinor: 12_000 })
    expect(suggestBaseSalaryMinor(daily, settings, summary({ workedDays: 21 }))).toBe(252_000)
  })

  it("never invents a full month when there is no attendance", () => {
    const hourly = employee({ salaryType: "hourly", baseRateMinor: 5000 })
    const empty = summary()
    expect(empty.workedDays).toBe(0)
    expect(suggestBaseSalaryMinor(hourly, settings, empty)).toBe(0)
    expect(suggestOvertimeAmountMinor(hourly, settings, empty)).toBe(0)
  })
})

describe("overtime", () => {
  it("applies the configured multiplier", () => {
    const monthly = employee({ salaryType: "fixed_monthly", baseRateMinor: 300_000 })
    expect(suggestOvertimeAmountMinor(monthly, settings, summary({ overtimeMinutes: 120 }))).toBe(3605)
  })

  it("returns zero without overtime", () => {
    expect(suggestOvertimeAmountMinor(employee({}), settings, summary())).toBe(0)
  })
})

describe("unpaid leave deduction", () => {
  it("deducts daily rate for monthly staff", () => {
    expect(suggestUnpaidLeaveDeductionMinor(employee({}), settings, 2)).toBe(23_076)
  })

  it("does not double-penalise hourly or daily staff", () => {
    expect(suggestUnpaidLeaveDeductionMinor(employee({ salaryType: "hourly" }), settings, 2)).toBe(0)
    expect(suggestUnpaidLeaveDeductionMinor(employee({ salaryType: "daily" }), settings, 2)).toBe(0)
  })
})

describe("net amount", () => {
  it("adds earnings and subtracts deductions", () => {
    expect(
      computeNetMinor({
        baseSalaryMinor: 300_000,
        overtimeAmountMinor: 10_000,
        bonusesMinor: 5_000,
        deductionsMinor: 15_000
      })
    ).toBe(300_000)
  })

  it("clamps at zero instead of producing a negative payslip", () => {
    expect(
      computeNetMinor({
        baseSalaryMinor: 10_000,
        overtimeAmountMinor: 0,
        bonusesMinor: 0,
        deductionsMinor: 50_000
      })
    ).toBe(0)
  })
})
