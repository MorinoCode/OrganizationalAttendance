import { AttendanceSummary, CompanySettings, Employee } from "../types"
import { roundMinor } from "./money"


export function dailyRateMinor(employee: Employee, settings: CompanySettings): number {
  switch (employee.salaryType) {
    case "fixed_monthly":
      return settings.standardWorkDays > 0
        ? roundMinor(employee.baseRateMinor / settings.standardWorkDays)
        : 0
    case "daily":
      return employee.baseRateMinor
    case "hourly":
      return roundMinor(employee.baseRateMinor * settings.defaultDailyHours)
    default:
      return 0
  }
}

export function hourlyRateMinor(employee: Employee, settings: CompanySettings): number {
  switch (employee.salaryType) {
    case "hourly":
      return employee.baseRateMinor
    case "daily":
      return settings.defaultDailyHours > 0
        ? roundMinor(employee.baseRateMinor / settings.defaultDailyHours)
        : 0
    case "fixed_monthly": {
      const monthlyHours = settings.standardWorkDays * settings.defaultDailyHours
      return monthlyHours > 0 ? roundMinor(employee.baseRateMinor / monthlyHours) : 0
    }
    default:
      return 0
  }
}

export function suggestBaseSalaryMinor(
  employee: Employee,
  settings: CompanySettings,
  summary: AttendanceSummary
): number {
  switch (employee.salaryType) {
    case "fixed_monthly":
      return employee.baseRateMinor
    case "hourly":
      return roundMinor((summary.workedMinutes / 60) * employee.baseRateMinor)
    case "daily":
      return roundMinor(summary.workedDays * employee.baseRateMinor)
    default:
      return employee.baseRateMinor
  }
}

export function suggestOvertimeAmountMinor(
  employee: Employee,
  settings: CompanySettings,
  summary: AttendanceSummary
): number {
  const rate = hourlyRateMinor(employee, settings)
  const multiplier = Number(settings.overtimeMultiplier) || 0
  return roundMinor((summary.overtimeMinutes / 60) * rate * multiplier)
}

export function suggestUnpaidLeaveDeductionMinor(
  employee: Employee,
  settings: CompanySettings,
  unpaidLeaveDays: number
): number {
  if (unpaidLeaveDays <= 0) return 0
  if (employee.salaryType !== "fixed_monthly") return 0
  return roundMinor(dailyRateMinor(employee, settings) * unpaidLeaveDays)
}

export interface NetParts {
  baseSalaryMinor: number
  overtimeAmountMinor: number
  bonusesMinor: number
  deductionsMinor: number
}

export function computeNetMinor(parts: NetParts): number {
  return roundMinor(
    parts.baseSalaryMinor + parts.overtimeAmountMinor + parts.bonusesMinor - parts.deductionsMinor
  )
}
