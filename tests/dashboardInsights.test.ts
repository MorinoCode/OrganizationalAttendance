import { createRequire } from "node:module"
import { afterAll, beforeEach, describe, expect, it } from "vitest"

const require = createRequire(import.meta.url)
const database = require("../src/main/db/index.cjs") as {
  initDatabaseFromFile: (filePath: string) => unknown
  closeDatabase: () => void
  getDb: () => { exec: (sql: string) => void }
}
const repositories = require("../src/main/db/repositories.cjs")

const TODAY = "2026-03-10"

function resetDatabase(): void {
  const db = database.getDb()
  db.exec("DELETE FROM break_logs")
  db.exec("DELETE FROM attendance_records")
  db.exec("DELETE FROM leaves")
  db.exec("DELETE FROM payslips")
  db.exec("DELETE FROM employees")
  db.exec("DELETE FROM audit_logs")
}

function seedEmployee(fullName: string, employeeCode: string, department: string) {
  return repositories.saveEmployee(
    { fullName, employeeCode, department, salaryType: "hourly", baseRateMinor: 5000 },
    "test"
  )
}

function seedShift(employeeId: string, day: number) {
  const start = new Date(2026, 2, day, 8, 0, 0).getTime()
  repositories.punchIn(employeeId, { now: start })
  repositories.punchOut(employeeId, { now: start + 8 * 60 * 60 * 1000 })
}

function seedPayslip(employeeId: string, month: number, baseSalaryMinor: number, overtimeMinutes: number) {
  const suffix = String(month).padStart(2, "0")
  return repositories.savePayslip(
    {
      employeeId,
      periodStart: `2026-${suffix}-01`,
      periodEnd: `2026-${suffix}-28`,
      workedDays: 20,
      workedMinutes: 20 * 8 * 60,
      overtimeMinutes,
      overtimeAmountMinor: 1000,
      baseSalaryMinor,
      paymentMethod: "bank_transfer"
    },
    "test"
  )
}

beforeEach(() => {
  database.initDatabaseFromFile(":memory:")
  resetDatabase()
  repositories.updateSettings(
    { companyName: "Test Co", currency: "KWD", currencyDecimals: 3, workDays: [0, 1, 2, 3, 4, 5, 6], isConfigured: true },
    "test"
  )
})

afterAll(() => {
  database.closeDatabase()
})

describe("dashboard insights", () => {
  it("reports an empty, non-misleading summary when nothing has been recorded", () => {
    const insights = repositories.dashboardInsights({ today: TODAY, months: 6 })

    expect(insights.departmentCosts).toEqual([])
    expect(insights.hoursByEmployee).toEqual([])
    expect(insights.overtimeTrend).toHaveLength(6)
    expect(insights.overtimeTrend.every((point: { overtimeMinutes: number }) => point.overtimeMinutes === 0)).toBe(true)
    expect(insights.payrollTrend).toHaveLength(6)
    expect(insights.absence).toMatchObject({
      expectedDays: 0,
      presentDays: 0,
      absentDays: 0,
      rate: 0,
      hasData: false
    })
  })

  it("groups payroll cost by department and orders by cost", () => {
    const first = seedEmployee("Ali", "EMP-1", "Operations")
    const second = seedEmployee("Sara", "EMP-2", "Operations")
    const third = seedEmployee("Noor", "EMP-3", "Sales")

    const slips = [
      seedPayslip(first.id, 1, 100_000, 60),
      seedPayslip(second.id, 1, 200_000, 120),
      seedPayslip(third.id, 1, 400_000, 30),
      seedPayslip(first.id, 2, 100_000, 90),
      seedPayslip(third.id, 2, 400_000, 0)
    ]

    const insights = repositories.dashboardInsights({ today: TODAY, months: 6 })
    const byDepartment = new Map(
      insights.departmentCosts.map((row: { department: string; netAmountMinor: number; employees: number; overtimeMinutes: number }) => [
        row.department,
        row
      ])
    )

    const expectedOperations = slips
      .filter((slip: { employeeId: string }) => slip.employeeId === first.id || slip.employeeId === second.id)
      .reduce((total: number, slip: { netAmountMinor: number }) => total + slip.netAmountMinor, 0)
    const expectedSales = slips
      .filter((slip: { employeeId: string }) => slip.employeeId === third.id)
      .reduce((total: number, slip: { netAmountMinor: number }) => total + slip.netAmountMinor, 0)

    expect(byDepartment.get("Operations")).toMatchObject({
      employees: 2,
      slips: 3,
      netAmountMinor: expectedOperations,
      overtimeMinutes: 60 + 120 + 90
    })
    expect(byDepartment.get("Sales")).toMatchObject({
      employees: 1,
      slips: 2,
      netAmountMinor: expectedSales,
      overtimeMinutes: 30
    })
    expect(insights.departmentCosts[0].department).toBe("Sales")
    expect(insights.departmentCosts[0].netAmountMinor).toBeGreaterThan(insights.departmentCosts[1].netAmountMinor)
  })

  it("tracks overtime and payroll month by month with zero-filled gaps", () => {
    const employee = seedEmployee("Ali", "EMP-1", "Operations")
    seedPayslip(employee.id, 1, 100_000, 60)
    seedPayslip(employee.id, 3, 100_000, 150)

    const insights = repositories.dashboardInsights({ today: TODAY, months: 6 })
    const overtime = new Map(
      insights.overtimeTrend.map((point: { monthKey: string; overtimeMinutes: number }) => [point.monthKey, point.overtimeMinutes])
    )
    const payroll = new Map(
      insights.payrollTrend.map((point: { monthKey: string; netAmountMinor: number }) => [point.monthKey, point.netAmountMinor])
    )

    expect(insights.overtimeTrend.map((point: { monthKey: string }) => point.monthKey)).toEqual([
      "2025-10",
      "2025-11",
      "2025-12",
      "2026-01",
      "2026-02",
      "2026-03"
    ])
    expect(overtime.get("2026-01")).toBe(60)
    expect(overtime.get("2026-02")).toBe(0)
    expect(overtime.get("2026-03")).toBe(150)
    expect(payroll.get("2026-01")).toBe(101_000)
    expect(payroll.get("2026-02")).toBe(0)
    expect(payroll.get("2026-03")).toBe(101_000)
  })

  it("computes the month-to-date absence rate from expected working days, attendance and leave", () => {
    const first = seedEmployee("Ali", "EMP-1", "Operations")
    const second = seedEmployee("Sara", "EMP-2", "Operations")
    const third = seedEmployee("Noor", "EMP-3", "Sales")

    seedShift(first.id, 9)
    seedShift(first.id, 10)
    seedShift(second.id, 9)
    seedShift(second.id, 10)
    repositories.saveLeave(
      { employeeId: third.id, leaveType: "paid", startDate: "2026-03-09", endDate: "2026-03-10", isPaid: true },
      "test"
    )

    const insights = repositories.dashboardInsights({ today: TODAY, months: 6 })

    expect(insights.absence).toMatchObject({
      expectedDays: 30,
      presentDays: 4,
      leaveDays: 2,
      absentDays: 24,
      rate: 0.8,
      activeEmployees: 3,
      hasData: true
    })
    expect(insights.hoursByEmployee).toHaveLength(2)
    expect(insights.hoursByEmployee[0].minutes).toBe(16 * 60)
  })
})
