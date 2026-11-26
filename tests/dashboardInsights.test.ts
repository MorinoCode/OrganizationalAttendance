import { createRequire } from "node:module"
import { afterAll, beforeEach, describe, expect, it } from "vitest"

const require = createRequire(import.meta.url)
const database = require("../src/main/db/index.cjs") as {
  initDatabaseFromFile: (filePath: string) => unknown
  closeDatabase: () => void
  getDb: () => {
    exec: (sql: string) => void
    prepare: (sql: string) => { get: (...params: unknown[]) => any; all: (...params: unknown[]) => any[] }
  }
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
    const overtimeAmount = new Map(
      insights.overtimeTrend.map((point: { monthKey: string; overtimeAmountMinor: number }) => [point.monthKey, point.overtimeAmountMinor])
    )

    expect(payroll.get("2026-01")).toBe(101_000)
    expect(payroll.get("2026-02")).toBe(0)
    expect(payroll.get("2026-03")).toBe(101_000)
    expect(overtimeAmount.get("2026-01")).toBe(1000)
    expect(overtimeAmount.get("2026-02")).toBe(0)
    expect(overtimeAmount.get("2026-03")).toBe(1000)
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
      workingDays: 10,
      hasData: true
    })
    expect(insights.absence.expectedDays).toBe(insights.absence.workingDays * insights.absence.activeEmployees)
    expect(insights.hoursByEmployee).toHaveLength(2)
    expect(insights.hoursByEmployee[0].minutes).toBe(16 * 60)
  })
})

describe("dashboard month window", () => {
  it("lists the months ending at today, oldest first, across a year boundary", () => {
    expect(repositories.monthKeysEndingAt("2026-03-10", 6)).toEqual([
      "2025-10",
      "2025-11",
      "2025-12",
      "2026-01",
      "2026-02",
      "2026-03"
    ])
    expect(repositories.monthKeysEndingAt("2026-01-05", 3)).toEqual(["2025-11", "2025-12", "2026-01"])
    expect(repositories.monthKeysEndingAt("2026-03-10", 100)).toHaveLength(24)
    expect(() => repositories.monthKeysEndingAt("10/03/2026", 6)).toThrow()
  })

  it("limits payroll totals to the requested window and keeps the trend consistent", () => {
    const employee = seedEmployee("Ali", "EMP-1", "Operations")
    seedPayslip(employee.id, 1, 500_000, 60)
    seedPayslip(employee.id, 2, 200_000, 30)

    const insights = repositories.dashboardInsights({ today: TODAY, months: 2 })

    expect(insights.range).toMatchObject({
      fromDate: "2026-02-01",
      toDate: TODAY,
      monthStart: "2026-03-01",
      months: 2
    })
    expect(insights.departmentCosts).toHaveLength(1)
    expect(insights.departmentCosts[0]).toMatchObject({
      department: "Operations",
      slips: 1,
      netAmountMinor: 201_000,
      overtimeMinutes: 30
    })
    expect(insights.overtimeTrend.map((point: { monthKey: string }) => point.monthKey)).toEqual(["2026-02", "2026-03"])
    expect(insights.payrollTrend.reduce((total: number, point: { netAmountMinor: number }) => total + point.netAmountMinor, 0)).toBe(201_000)

    const departmentTotal = insights.departmentCosts.reduce(
      (total: number, row: { netAmountMinor: number }) => total + row.netAmountMinor,
      0
    )
    const trendTotal = insights.payrollTrend.reduce(
      (total: number, point: { netAmountMinor: number }) => total + point.netAmountMinor,
      0
    )
    const departmentOvertime = insights.departmentCosts.reduce(
      (total: number, row: { overtimeMinutes: number }) => total + row.overtimeMinutes,
      0
    )
    const trendOvertime = insights.overtimeTrend.reduce(
      (total: number, point: { overtimeMinutes: number }) => total + point.overtimeMinutes,
      0
    )

    expect(trendTotal).toBe(departmentTotal)
    expect(trendOvertime).toBe(departmentOvertime)
  })
})

describe("absence calculation", () => {
  it("clamps an over-covered month to zero absence instead of a negative rate", () => {
    expect(
      repositories.absenceSummary({
        expectedDays: 10,
        presentDays: 8,
        leaveDays: 5,
        activeEmployees: 2,
        workingDays: 6,
        workDaysPerWeek: 5
      })
    ).toEqual({
      expectedDays: 10,
      presentDays: 8,
      leaveDays: 5,
      absentDays: 0,
      rate: 0,
      activeEmployees: 2,
      workingDays: 6,
      workDaysPerWeek: 5,
      hasData: true
    })
  })

  it("reports an explicit empty month with zeros instead of NaN", () => {
    expect(
      repositories.absenceSummary({ expectedDays: 0, presentDays: 0, leaveDays: 0, activeEmployees: 3, workDaysPerWeek: 5 })
    ).toEqual({
      expectedDays: 0,
      presentDays: 0,
      leaveDays: 0,
      absentDays: 0,
      rate: 0,
      activeEmployees: 3,
      workingDays: 0,
      workDaysPerWeek: 5,
      hasData: false
    })

    const fallback = repositories.absenceSummary({ expectedDays: Number.NaN, presentDays: undefined })
    expect(Number.isFinite(fallback.rate)).toBe(true)
    expect(fallback).toMatchObject({ absentDays: 0, rate: 0, hasData: false })
  })

  it("rounds the rate to three decimals", () => {
    expect(repositories.absenceSummary({ expectedDays: 3, presentDays: 2 }).rate).toBe(0.333)
    expect(repositories.absenceSummary({ expectedDays: 3, presentDays: 1 }).rate).toBe(0.667)
  })

  it("counts only active employees in the month-to-date baseline", () => {
    const active = seedEmployee("Ali", "EMP-1", "Operations")
    const inactive = seedEmployee("Sara", "EMP-2", "Sales")
    repositories.setEmployeeActive(inactive.id, false, "test")
    seedShift(active.id, 10)

    const insights = repositories.dashboardInsights({ today: TODAY, months: 1 })

    expect(insights.absence).toMatchObject({
      activeEmployees: 1,
      expectedDays: 10,
      presentDays: 1,
      leaveDays: 0,
      absentDays: 9,
      rate: 0.9,
      workingDays: 10,
      hasData: true
    })
  })

  it("sums department rows into one auditable total that matches direct SQL", () => {
    const ali = seedEmployee("Ali", "EMP-1", "Operations")
    const sara = seedEmployee("Sara", "EMP-2", "Sales")
    const noor = seedEmployee("Noor", "EMP-3", "Operations")
    seedPayslip(ali.id, 1, 100_000, 60)
    seedPayslip(noor.id, 1, 150_000, 30)
    seedPayslip(sara.id, 2, 90_000, 0)

    const insights = repositories.dashboardInsights({ today: TODAY, months: 6 })
    const rowTotal = insights.departmentCosts.reduce(
      (total: number, row: { netAmountMinor: number }) => total + row.netAmountMinor,
      0
    )
    const sql = database
      .getDb()
      .prepare(
        "SELECT SUM(net_amount_minor) AS net, SUM(overtime_minutes) AS minutes, SUM(overtime_amount_minor) AS amount, COUNT(*) AS slips FROM payslips"
      )
      .get()

    expect(insights.departmentCostsTotal.netAmountMinor).toBe(rowTotal)
    expect(insights.departmentCostsTotal.netAmountMinor).toBe(Number(sql.net))
    expect(insights.departmentCostsTotal.overtimeMinutes).toBe(Number(sql.minutes))
    expect(insights.departmentCostsTotal.overtimeAmountMinor).toBe(Number(sql.amount))
    expect(insights.departmentCostsTotal.slips).toBe(Number(sql.slips))
  })

  it("keeps a department without payslips out of the report instead of inventing zeros", () => {
    const paid = seedEmployee("Ali", "EMP-1", "Operations")
    seedEmployee("Sara", "EMP-2", "Sales") // active, but no payroll in the window
    seedPayslip(paid.id, 1, 100_000, 0)

    const insights = repositories.dashboardInsights({ today: TODAY, months: 6 })

    expect(insights.departmentCosts.map((row: { department: string }) => row.department)).toEqual(["Operations"])
    expect(insights.departmentCostsTotal).toMatchObject({
      employees: 1,
      slips: 1,
      netAmountMinor: 101_000,
      overtimeAmountMinor: 1000,
      overtimeMinutes: 0
    })
  })

  it("sums department rows without mutating them and returns zeros for none", () => {
    const rows = [
      { department: "A", employees: 2, slips: 3, netAmountMinor: 120_000, overtimeAmountMinor: 4_000, overtimeMinutes: 90, workedMinutes: 9_600 },
      { department: "B", employees: 1, slips: 1, netAmountMinor: 80_000, overtimeAmountMinor: 1_000, overtimeMinutes: 30, workedMinutes: 4_800 }
    ]

    expect(repositories.sumDepartmentCosts(rows)).toEqual({
      employees: 3,
      slips: 4,
      netAmountMinor: 200_000,
      overtimeAmountMinor: 5_000,
      overtimeMinutes: 120,
      workedMinutes: 14_400
    })
    expect(rows[0].netAmountMinor).toBe(120_000)
    expect(repositories.sumDepartmentCosts([])).toEqual({
      employees: 0,
      slips: 0,
      netAmountMinor: 0,
      overtimeAmountMinor: 0,
      overtimeMinutes: 0,
      workedMinutes: 0
    })
  })
})

describe("empty range", () => {
  it("keeps every dashboard number finite and empty instead of inventing values", () => {
    const insights = repositories.dashboardInsights({ today: TODAY, months: 3 })

    expect(insights.departmentCosts).toEqual([])
    expect(insights.hoursByEmployee).toEqual([])
    expect(insights.payrollTrend).toHaveLength(3)
    expect(insights.overtimeTrend).toHaveLength(3)
    expect(
      insights.payrollTrend.every((point: { netAmountMinor: number }) => Number.isFinite(point.netAmountMinor) && point.netAmountMinor === 0)
    ).toBe(true)
    expect(
      insights.overtimeTrend.every(
        (point: { overtimeMinutes: number; overtimeAmountMinor: number }) =>
          Number.isFinite(point.overtimeMinutes) && point.overtimeMinutes === 0 && point.overtimeAmountMinor === 0
      )
    ).toBe(true)
    expect(insights.absence).toMatchObject({ rate: 0, absentDays: 0, hasData: false })
    expect(Number.isFinite(insights.absence.rate)).toBe(true)
  })
})
