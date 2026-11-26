import { createRequire } from "node:module"
import { afterAll, beforeEach, describe, expect, it } from "vitest"

const require = createRequire(import.meta.url)
const database = require("../src/main/db/index.cjs") as {
  initDatabaseFromFile: (filePath: string) => unknown
  getDb: () => {
    exec: (sql: string) => void
    prepare: (sql: string) => { get: (...params: unknown[]) => any; all: () => any[]; run: (...params: unknown[]) => unknown }
  }
  closeDatabase: () => void
}
const repositories = require("../src/main/db/repositories.cjs")

const HOUR = 60 * 60 * 1000

function resetDatabase(): void {
  const db = database.getDb()
  db.exec("DELETE FROM break_logs")
  db.exec("DELETE FROM attendance_records")
  db.exec("DELETE FROM leaves")
  db.exec("DELETE FROM payslips")
  db.exec("DELETE FROM employees")
  db.exec("DELETE FROM audit_logs")
  db.exec("UPDATE company_settings SET admin_password_hash = '', is_configured = 0")
}

function seedEmployee(overrides: Record<string, unknown> = {}) {
  return repositories.saveEmployee(
    {
      fullName: "Ali Hassan",
      employeeCode: "KW-100",
      phone: "+965 000",
      department: "Operations",
      salaryType: "hourly",
      baseRateMinor: 5000,
      ...overrides
    },
    "test"
  )
}

function expectCode(fn: () => unknown, code: string): void {
  try {
    fn()
  } catch (error) {
    expect((error as { code?: string }).code).toBe(code)
    return
  }
  throw new Error(`Expected "${code}" but nothing was thrown`)
}

beforeEach(() => {
  database.initDatabaseFromFile(":memory:")
  resetDatabase()
})

afterAll(() => {
  database.closeDatabase()
})

describe("employee activation", () => {
  it("hides a deactivated employee from lists and the kiosk", () => {
    const employee = seedEmployee()

    repositories.setEmployeeActive(employee.id, false, "admin")

    expect(repositories.listEmployees()).toHaveLength(0)
    expect(repositories.listPublicEmployees()).toHaveLength(0)
    expect(repositories.listEmployees({ includeInactive: true })).toHaveLength(1)
    expect(repositories.listEmployees({ includeInactive: true })[0].isActive).toBe(false)

    expectCode(
      () => repositories.punchIn(employee.id, { now: new Date(2026, 10, 25, 8, 0, 0).getTime() }),
      "employee_inactive"
    )
  })

  it("reactivates the same record and keeps the audit trail", () => {
    const employee = seedEmployee()
    repositories.setEmployeeActive(employee.id, false, "admin")
    repositories.setEmployeeActive(employee.id, true, "admin")

    expect(repositories.listEmployees()).toHaveLength(1)
    const actions = repositories.listAuditLogs(10).map((entry: { action: string }) => entry.action)
    expect(actions).toContain("deactivated")
    expect(actions).toContain("activated")
    expectCode(() => repositories.setEmployeeActive("missing", false, "admin"), "employee_not_found")
  })
})

describe("attendance correction", () => {
  it("refuses a punch-out without a punch-in and clamps a manual break", () => {
    repositories.updateSettings({ workDays: [0, 1, 2, 3, 4] }, "admin")
    const employee = seedEmployee()
    database.getDb().prepare("UPDATE employees SET created_at = ? WHERE id = ?").run("2026-01-01T00:00:00.000Z", employee.id)

    const marked = repositories.markAbsences({ fromDate: "2026-10-04", toDate: "2026-10-04" }, "admin")
    expect(marked.inserted).toBe(1)

    const [absent] = repositories.listAttendance({ employeeId: employee.id })
    expect(absent.status).toBe("absent")
    expect(absent.punchInAt).toBeNull()

    const start = new Date(2026, 9, 4, 8, 0, 0).getTime()
    expectCode(() => repositories.correctAttendance(absent.id, { punchOutAt: start }, "admin"), "invalid_time_range")
    expectCode(
      () => repositories.correctAttendance(absent.id, { punchInAt: start + HOUR, punchOutAt: start }, "admin"),
      "invalid_time_range"
    )
    expectCode(() => repositories.correctAttendance("missing", {}, "admin"), "attendance_not_found")

    const corrected = repositories.correctAttendance(
      absent.id,
      { punchInAt: start, punchOutAt: start + 8 * HOUR, breakMinutes: 5000, notes: "x".repeat(600) },
      "admin"
    )

    expect(corrected.status).toBe("completed")
    expect(corrected.breakMinutes).toBe(24 * 60)
    expect(corrected.netMinutes).toBe(0) // 8h shift minus a full-day break never goes negative
    expect(corrected.notes).toHaveLength(500)
    expect(corrected.lateMinutes).toBe(0)
  })

  it("deletes the record, its breaks and its share of the totals", () => {
    const employee = seedEmployee()
    const start = new Date(2026, 10, 25, 8, 0, 0).getTime()
    repositories.punchIn(employee.id, { now: start })
    repositories.startBreak(employee.id, { now: start + HOUR })
    const record = repositories.punchOut(employee.id, { now: start + 2 * HOUR })
    expect(record.breakMinutes).toBe(60) // the break ran from 09:00 until the punch-out
    expect(record.netMinutes).toBe(60)

    const db = database.getDb()
    expect(db.prepare("SELECT COUNT(*) AS n FROM break_logs").get().n).toBe(1)

    expect(repositories.deleteAttendance(record.id, "admin")).toEqual({ id: record.id })

    expect(repositories.listAttendance({ employeeId: employee.id })).toHaveLength(0)
    expect(db.prepare("SELECT COUNT(*) AS n FROM break_logs").get().n).toBe(0)
    expect(
      repositories.aggregateAttendance({ fromDate: "2026-11-01", toDate: "2026-11-30", dailyHours: 8 }).workedMinutes
    ).toBe(0)
    expectCode(() => repositories.deleteAttendance(record.id, "admin"), "attendance_not_found")
  })

  it("returns only today's rows from the kiosk view", () => {
    const employee = seedEmployee()
    const yesterday = new Date()
    yesterday.setDate(yesterday.getDate() - 1)
    const yesterdayStart = new Date(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate(), 8, 0, 0).getTime()

    repositories.punchIn(employee.id, { now: yesterdayStart })
    repositories.punchOut(employee.id, { now: yesterdayStart + 8 * HOUR })
    repositories.punchIn(employee.id, { now: Date.now() })

    const today = repositories.todayRecords(employee.id)
    expect(today).toHaveLength(1)
    expect(today[0].punchOutAt).toBeNull()
    expect(repositories.listAttendance({ employeeId: employee.id })).toHaveLength(2)
  })
})

describe("leave records", () => {
  it("defaults the paid flag from the leave type and falls back to unpaid", () => {
    const employee = seedEmployee()

    const sick = repositories.saveLeave(
      { employeeId: employee.id, leaveType: "sick", startDate: "2026-11-02", endDate: "2026-11-03" },
      "admin"
    )
    expect(sick.leaveType).toBe("sick")
    expect(sick.isPaid).toBe(true)

    const unknown = repositories.saveLeave(
      { employeeId: employee.id, leaveType: "vacation", startDate: "2026-11-10", endDate: "2026-11-10" },
      "admin"
    )
    expect(unknown.leaveType).toBe("unpaid")
    expect(unknown.isPaid).toBe(false)
  })

  it("filters by employee and by overlapping range", () => {
    const ali = seedEmployee({ employeeCode: "KW-1", fullName: "Ali" })
    const sara = seedEmployee({ employeeCode: "KW-2", fullName: "Sara" })
    repositories.saveLeave(
      { employeeId: ali.id, leaveType: "paid", startDate: "2026-11-02", endDate: "2026-11-03" },
      "admin"
    )
    repositories.saveLeave(
      { employeeId: sara.id, leaveType: "unpaid", startDate: "2026-11-10", endDate: "2026-11-12" },
      "admin"
    )

    expect(repositories.listLeaves()).toHaveLength(2)
    expect(repositories.listLeaves({ employeeId: ali.id })).toHaveLength(1)
    expect(repositories.listLeaves({ fromDate: "2026-11-03", toDate: "2026-11-03" })).toHaveLength(1)
    expect(repositories.listLeaves({ fromDate: "2026-11-04", toDate: "2026-11-09" })).toHaveLength(0)
    expectCode(() => repositories.listLeaves({ fromDate: "03/11/2026" }), "invalid_date")
  })

  it("deletes a leave and reports unknown ids", () => {
    const employee = seedEmployee()
    const leave = repositories.saveLeave(
      { employeeId: employee.id, leaveType: "unpaid", startDate: "2026-11-02", endDate: "2026-11-02" },
      "admin"
    )

    expect(repositories.deleteLeave(leave.id, "admin")).toEqual({ id: leave.id })
    expect(repositories.listLeaves()).toHaveLength(0)
    expectCode(() => repositories.deleteLeave(leave.id, "admin"), "leave_not_found")
  })
})

describe("payslip deletion", () => {
  it("removes a payslip and reports unknown ids", () => {
    const employee = seedEmployee()
    const slip = repositories.savePayslip(
      {
        employeeId: employee.id,
        periodStart: "2026-11-01",
        periodEnd: "2026-11-30",
        baseSalaryMinor: 100_000,
        paymentDate: "2026-11-30",
        paymentMethod: "cash"
      },
      "admin"
    )

    expect(repositories.deletePayslip(slip.id, "admin")).toEqual({ id: slip.id })
    expect(repositories.listPayslips()).toHaveLength(0)
    expectCode(() => repositories.deletePayslip(slip.id, "admin"), "payslip_not_found")
  })
})
