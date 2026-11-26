import { createRequire } from "node:module"
import { afterAll, beforeEach, describe, expect, it } from "vitest"

const require = createRequire(import.meta.url)
const database = require("../src/main/db/index.cjs") as {
  initDatabaseFromFile: (filePath: string) => unknown
  getDb: () => { exec: (sql: string) => void; prepare: (sql: string) => { run: (...params: unknown[]) => unknown } }
  closeDatabase: () => void
}
const repositories = require("../src/main/db/repositories.cjs")
const backup = require("../src/main/backup.cjs")
const auth = require("../src/main/lib/auth.cjs")

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

describe("attendance flow", () => {
  it("deducts a running break when the shift is finished (regression: lost break)", () => {
    const employee = seedEmployee()
    const start = new Date(2026, 10, 25, 8, 0, 0).getTime()

    repositories.punchIn(employee.id, { now: start })
    repositories.startBreak(employee.id, { now: start + 2 * HOUR })
    const finished = repositories.punchOut(employee.id, { now: start + 2.5 * HOUR })

    expect(finished.breakMinutes).toBe(30)
    expect(finished.netMinutes).toBe(120)
    expect(finished.status).toBe("completed")
    expect(finished.breaks).toHaveLength(1)
    expect(finished.breaks[0].breakEndAt).not.toBeNull()
  })

  it("allows a second shift punch-in on the same day and aggregates daily hours", () => {
    const employee = seedEmployee()
    const start = new Date(2026, 10, 25, 8, 0, 0).getTime()
    repositories.punchIn(employee.id, { now: start })
    repositories.punchOut(employee.id, { now: start + 4 * HOUR })

    const second = repositories.punchIn(employee.id, { now: start + 6 * HOUR })
    expect(second.status).toBe("present")
    repositories.punchOut(employee.id, { now: start + 11 * HOUR })

    const list = repositories.listAttendance({ employeeId: employee.id })
    expect(list).toHaveLength(2)

    const summary = repositories.aggregateAttendance({
      employeeId: employee.id,
      fromDate: "2026-11-25",
      toDate: "2026-11-25",
      dailyHours: 8
    })
    expect(summary.workedDays).toBe(1)
    expect(summary.workedMinutes).toBe(9 * 60)
    expect(summary.overtimeMinutes).toBe(60)
  })

  it("is idempotent while a shift is still open", () => {
    const employee = seedEmployee()
    const start = new Date(2026, 10, 25, 8, 0, 0).getTime()
    const first = repositories.punchIn(employee.id, { now: start })
    const again = repositories.punchIn(employee.id, { now: start + HOUR })
    expect(again.id).toBe(first.id)
  })

  it("rejects a second break and a break end without a start", () => {
    const employee = seedEmployee()
    const start = new Date(2026, 10, 25, 8, 0, 0).getTime()
    expectCode(() => repositories.endBreak(employee.id, { now: start }), "no_active_shift")

    repositories.punchIn(employee.id, { now: start })
    expectCode(() => repositories.endBreak(employee.id, { now: start + HOUR }), "no_open_break")

    repositories.startBreak(employee.id, { now: start + HOUR })
    expectCode(() => repositories.startBreak(employee.id, { now: start + 2 * HOUR }), "break_already_open")
  })

  it("rejects a punch-out before the punch-in", () => {
    const employee = seedEmployee()
    const start = new Date(2026, 10, 25, 8, 0, 0).getTime()
    repositories.punchIn(employee.id, { now: start })
    expectCode(() => repositories.punchOut(employee.id, { now: start - HOUR }), "invalid_time_range")
  })

  it("keeps a night shift on its local start day", () => {
    const employee = seedEmployee()
    const start = new Date(2026, 10, 25, 22, 0, 0).getTime()
    const record = repositories.punchIn(employee.id, { now: start })
    expect(record.recordDate).toBe("2026-11-25")
  })

  it("recomputes durations on manual correction", () => {
    const employee = seedEmployee()
    const start = new Date(2026, 10, 25, 8, 0, 0).getTime()
    repositories.punchIn(employee.id, { now: start })
    const record = repositories.punchOut(employee.id, { now: start + 8 * HOUR })

    const corrected = repositories.correctAttendance(
      record.id,
      { punchOutAt: start + 9 * HOUR, breakMinutes: 60, notes: "late clock-out" },
      "admin"
    )

    expect(corrected.breakMinutes).toBe(60)
    expect(corrected.netMinutes).toBe(8 * 60)
    expect(corrected.notes).toBe("late clock-out")
    expect(repositories.listAuditLogs(10).some((entry: { action: string }) => entry.action === "corrected")).toBe(true)
  })

  it("aggregates only closed shifts and derives overtime from settings", () => {
    const employee = seedEmployee({ salaryType: "fixed_monthly", baseRateMinor: 300_000 })
    const day1 = new Date(2026, 10, 24, 8, 0, 0).getTime()
    const day2 = new Date(2026, 10, 25, 8, 0, 0).getTime()

    repositories.punchIn(employee.id, { now: day1 })
    repositories.punchOut(employee.id, { now: day1 + 10 * HOUR }) // 10h -> 2h overtime
    repositories.punchIn(employee.id, { now: day2 }) // still open

    const aggregate = repositories.aggregateAttendance({
      employeeId: employee.id,
      fromDate: "2026-11-01",
      toDate: "2026-11-30",
      dailyHours: 8
    })

    expect(aggregate.workedDays).toBe(1)
    expect(aggregate.openRecords).toBe(1)
    expect(aggregate.workedMinutes).toBe(600)
    expect(aggregate.overtimeMinutes).toBe(120)
  })
})

describe("employee lifecycle", () => {
  it("refuses to delete an employee with attendance or payroll history", () => {
    const employee = seedEmployee()
    const start = new Date(2026, 10, 25, 8, 0, 0).getTime()
    repositories.punchIn(employee.id, { now: start })

    expectCode(() => repositories.deleteEmployee(employee.id, "admin"), "employee_has_history")
    expect(repositories.getEmployee(employee.id)).not.toBeNull()
  })

  it("deletes an employee with no history", () => {
    const employee = seedEmployee()
    repositories.deleteEmployee(employee.id, "admin")
    expect(repositories.getEmployee(employee.id)).toBeNull()
  })

  it("enforces unique employee codes", () => {
    seedEmployee({ employeeCode: "KW-200" })
    expectCode(() => seedEmployee({ employeeCode: "KW-200", fullName: "Other" }), "employee_code_taken")
  })

  it("never exposes salary fields in the kiosk projection", () => {
    seedEmployee()
    const [publicEmployee] = repositories.listPublicEmployees()
    expect(Object.keys(publicEmployee).sort()).toEqual(["department", "employeeCode", "fullName", "id"])
  })
})

describe("payslips", () => {
  it("numbers payslips sequentially per year and computes the net itself", () => {
    const employee = seedEmployee()
    const first = repositories.savePayslip(
      {
        employeeId: employee.id,
        periodStart: "2026-11-01",
        periodEnd: "2026-11-30",
        workedDays: 26,
        workedMinutes: 12_480,
        baseSalaryMinor: 300_000,
        overtimeAmountMinor: 10_000,
        bonusesMinor: 5_000,
        deductionsMinor: 15_000,
        netAmountMinor: 999_999_999, // must be ignored
        paymentDate: "2026-11-30",
        paymentMethod: "bank_transfer"
      },
      "admin"
    )

    expect(first.number).toBe("PS-2026-0001")
    expect(first.netAmountMinor).toBe(300_000)
    expect(first.isSigned).toBe(false)

    const second = repositories.savePayslip(
      {
        employeeId: employee.id,
        periodStart: "2026-12-01",
        periodEnd: "2026-12-31",
        workedDays: 26,
        workedMinutes: 12_480,
        baseSalaryMinor: 300_000,
        paymentDate: "2026-12-31",
        paymentMethod: "cash"
      },
      "admin"
    )
    expect(second.number).toBe("PS-2026-0002")
  })

  it("refuses a second payslip for the same employee and period", () => {
    const employee = seedEmployee()
    const input = {
      employeeId: employee.id,
      periodStart: "2026-11-01",
      periodEnd: "2026-11-30",
      baseSalaryMinor: 100_000,
      paymentDate: "2026-11-30",
      paymentMethod: "cash"
    }
    repositories.savePayslip(input, "admin")
    expectCode(() => repositories.savePayslip(input, "admin"), "payslip_period_exists")
    expect(repositories.listPayslips({ employeeId: employee.id })).toHaveLength(1)
  })

  it("marks delivery explicitly", () => {
    const employee = seedEmployee()
    const payslip = repositories.savePayslip(
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
    const signed = repositories.setPayslipSigned(payslip.id, true, "admin")
    expect(signed.isSigned).toBe(true)
    expect(signed.signedAt).not.toBeNull()
  })
})

describe("leaves", () => {
  it("counts inclusive days and unpaid totals", () => {
    const employee = seedEmployee()
    const leave = repositories.saveLeave(
      { employeeId: employee.id, leaveType: "unpaid", startDate: "2026-11-02", endDate: "2026-11-04", isPaid: false },
      "admin"
    )
    expect(leave.days).toBe(3)
    expect(repositories.unpaidLeaveDaysInRange(employee.id, "2026-11-01", "2026-11-03")).toBe(2)
  })

  it("rejects an inverted range", () => {
    const employee = seedEmployee()
    expectCode(
      () =>
        repositories.saveLeave(
          { employeeId: employee.id, leaveType: "paid", startDate: "2026-11-05", endDate: "2026-11-01" },
          "admin"
        ),
      "invalid_date_range"
    )
  })
})

describe("shift schedule and month close", () => {
  it("stores the shift defaults and rejects inconsistent schedules", () => {
    const defaults = repositories.getSettings()
    expect(defaults.shiftStartMinutes).toBe(480)
    expect(defaults.shiftEndMinutes).toBe(1020)
    expect(defaults.graceMinutes).toBe(10)
    expect(defaults.workDays).toEqual([0, 1, 2, 3, 4])

    repositories.updateSettings(
      { shiftStartMinutes: 540, shiftEndMinutes: 1080, graceMinutes: 15, workDays: [6, 0, 0] },
      "admin"
    )
    const updated = repositories.getSettings()
    expect(updated.shiftStartMinutes).toBe(540)
    expect(updated.shiftEndMinutes).toBe(1080)
    expect(updated.graceMinutes).toBe(15)
    expect(updated.workDays).toEqual([0, 6])

    expectCode(() => repositories.updateSettings({ shiftStartMinutes: 1080 }, "admin"), "invalid_shift_range")
    expectCode(() => repositories.updateSettings({ workDays: [] }, "admin"), "invalid_work_days")
  })

  it("records lateness and early leave against the schedule at punch time", () => {
    repositories.updateSettings(
      { shiftStartMinutes: 480, shiftEndMinutes: 1020, graceMinutes: 10, workDays: [0, 1, 2, 3, 4] },
      "admin"
    )
    const employee = seedEmployee()

    const record = repositories.punchIn(employee.id, { now: new Date(2026, 10, 25, 8, 25, 0).getTime() })
    expect(record.recordDate).toBe("2026-11-25")
    expect(record.lateMinutes).toBe(15)

    const finished = repositories.punchOut(employee.id, { now: new Date(2026, 10, 25, 16, 40, 0).getTime() })
    expect(finished.earlyLeaveMinutes).toBe(10)
    expect(finished.lateMinutes).toBe(15)
  })

  it("does not mark lateness on a non-working day", () => {
    repositories.updateSettings({ workDays: [0, 1, 2, 3, 4] }, "admin")
    const employee = seedEmployee()
    const record = repositories.punchIn(employee.id, { now: new Date(2026, 10, 27, 10, 0, 0).getTime() })
    expect(record.lateMinutes).toBe(0)
  })

  it("recomputes stored lateness for records saved before a schedule change", () => {
    repositories.updateSettings(
      { shiftStartMinutes: 480, shiftEndMinutes: 1020, graceMinutes: 0, workDays: [0, 1, 2, 3, 4] },
      "admin"
    )
    const employee = seedEmployee()
    const db = database.getDb()
    const stamp = new Date().toISOString()
    db.prepare(
      "INSERT INTO attendance_records (id, employee_id, record_date, punch_in_at, punch_out_at, break_minutes, net_minutes, status, notes, created_at, updated_at) VALUES (?, ?, ?, ?, ?, 0, 480, 'completed', '', ?, ?)"
    ).run(
      "att-legacy",
      employee.id,
      "2026-11-24",
      new Date(2026, 10, 24, 8, 30, 0).getTime(),
      new Date(2026, 10, 24, 16, 30, 0).getTime(),
      stamp,
      stamp
    )

    expect(repositories.listAttendance({ employeeId: employee.id })[0].lateMinutes).toBe(0)

    const result = repositories.recalculatePeriod({ fromDate: "2026-11-01", toDate: "2026-11-30" }, "admin")
    expect(result.updated).toBe(1)

    const corrected = repositories.listAttendance({ employeeId: employee.id })[0]
    expect(corrected.lateMinutes).toBe(30)
    expect(corrected.earlyLeaveMinutes).toBe(30)
  })

  it("summarises required, present, leave and absent days for a period", () => {
    repositories.updateSettings(
      { shiftStartMinutes: 480, shiftEndMinutes: 1020, graceMinutes: 10, workDays: [0, 1, 2, 3, 4] },
      "admin"
    )
    const employee = seedEmployee()
    const db = database.getDb()
    db.prepare("UPDATE employees SET created_at = ? WHERE id = ?").run("2026-01-01T00:00:00.000Z", employee.id)

    const HOUR_MS = 60 * 60 * 1000
    const dayA = new Date(2026, 9, 4, 8, 5, 0).getTime()
    const dayB = new Date(2026, 9, 5, 8, 5, 0).getTime()
    repositories.punchIn(employee.id, { now: dayA })
    repositories.punchOut(employee.id, { now: dayA + 9 * HOUR_MS })
    repositories.punchIn(employee.id, { now: dayB })
    repositories.punchOut(employee.id, { now: dayB + 9 * HOUR_MS })
    repositories.saveLeave(
      { employeeId: employee.id, leaveType: "unpaid", startDate: "2026-10-06", endDate: "2026-10-06", isPaid: false },
      "admin"
    )

    const report = repositories.monthCloseReport({ fromDate: "2026-10-04", toDate: "2026-10-08" })
    expect(report.employees).toHaveLength(1)

    const row = report.employees[0]
    expect(row.requiredDays).toBe(5) // Sunday to Thursday, Friday and Saturday excluded
    expect(row.presentDays).toBe(2)
    expect(row.leaveDays).toBe(1)
    expect(row.absentDays).toBe(2)
    expect(row.unpaidLeaveDays).toBe(1)
    expect(row.lateMinutes).toBe(0) // 08:05 is inside the 10 minute grace window
    expect(row.openRecords).toBe(0)

    expect(report.totals.requiredDays).toBe(5)
    expect(report.totals.absentDays).toBe(2)
    expect(report.asOf).toBe("2026-10-08")
    expect(report.shift.workDays).toEqual([0, 1, 2, 3, 4])
  })

  it("records absences once, skipping days with punches or leave", () => {
    repositories.updateSettings({ workDays: [0, 1, 2, 3, 4] }, "admin")
    const employee = seedEmployee()
    const db = database.getDb()
    db.prepare("UPDATE employees SET created_at = ? WHERE id = ?").run("2026-01-01T00:00:00.000Z", employee.id)

    const dayA = new Date(2026, 9, 4, 9, 0, 0).getTime()
    repositories.punchIn(employee.id, { now: dayA })
    repositories.punchOut(employee.id, { now: dayA + 8 * 60 * 60 * 1000 })
    repositories.saveLeave(
      { employeeId: employee.id, leaveType: "paid", startDate: "2026-10-05", endDate: "2026-10-05", isPaid: true },
      "admin"
    )

    const first = repositories.markAbsences({ fromDate: "2026-10-04", toDate: "2026-10-08" }, "admin")
    expect(first.inserted).toBe(3) // 06, 07 and 08 only

    const second = repositories.markAbsences({ fromDate: "2026-10-04", toDate: "2026-10-08" }, "admin")
    expect(second.inserted).toBe(0)

    const absent = repositories
      .listAttendance({ employeeId: employee.id })
      .filter((record: { status: string }) => record.status === "absent")
    expect(absent.map((record: { recordDate: string }) => record.recordDate).sort()).toEqual([
      "2026-10-06",
      "2026-10-07",
      "2026-10-08"
    ])

    const cleared = repositories.clearAbsences({ fromDate: "2026-10-04", toDate: "2026-10-08" }, "admin")
    expect(cleared.deleted).toBe(3)
    expect(
      repositories.listAttendance({ employeeId: employee.id }).filter((record: { status: string }) => record.status === "absent")
    ).toHaveLength(0)
  })
})

describe("schema migrations", () => {
  it("upgrades an existing v2 database with shift defaults", () => {
    const fs = require("node:fs") as typeof import("node:fs")
    const os = require("node:os") as typeof import("node:os")
    const nodePath = require("node:path") as typeof import("node:path")
    const schema = require("../src/main/db/schema.cjs") as {
      SCHEMA_VERSION: number
      MIGRATIONS: Array<{ version: number; sql: string }>
    }
    const { DatabaseSync } = require("node:sqlite") as typeof import("node:sqlite")

    const dir = fs.mkdtempSync(nodePath.join(os.tmpdir(), "hozor-migrate-"))
    const file = nodePath.join(dir, "legacy.db")

    const legacy = new DatabaseSync(file)
    for (const migration of schema.MIGRATIONS) {
      if (migration.version > 2) continue
      legacy.exec(migration.sql)
    }
    legacy
      .prepare(
        "INSERT INTO company_settings (id, company_name, owner_name, owner_role, admin_password_hash, currency, currency_decimals, default_daily_hours, standard_work_days, overtime_multiplier, is_configured, logo_path, updated_at) VALUES (1, 'Legacy Co', 'Owner', 'Boss', '', 'KWD', 3, 8, 26, 1.25, 1, NULL, ?)"
      )
      .run("2026-01-01T00:00:00.000Z")
    legacy.exec("PRAGMA user_version = 2")
    legacy.close()

    database.closeDatabase()
    database.initDatabaseFromFile(file)

    const settings = repositories.getSettings()
    expect(settings.companyName).toBe("Legacy Co")
    expect(settings.shiftStartMinutes).toBe(480)
    expect(settings.shiftEndMinutes).toBe(1020)
    expect(settings.graceMinutes).toBe(10)
    expect(settings.workDays).toEqual([0, 1, 2, 3, 4])

    const columns = database
      .getDb()
      .prepare("PRAGMA table_info(attendance_records)")
      .all()
      .map((column: { name: string }) => column.name)
    expect(columns).toContain("late_minutes")
    expect(columns).toContain("early_leave_minutes")
    expect(schema.SCHEMA_VERSION).toBe(5)

    database.closeDatabase()
    fs.rmSync(dir, { recursive: true, force: true })
  })
})

describe("backup validation", () => {
  it("accepts a backup produced by the application", () => {
    seedEmployee()
    const payload = backup.buildBackup()
    expect(() => backup.validateBackup(payload)).not.toThrow()
  })

  it("rejects a foreign or malformed file before touching the database", () => {
    expectCode(
      () => backup.validateBackup({ app: "something-else", formatVersion: 1, data: {} }),
      "backup_invalid"
    )
    expectCode(() => backup.validateBackup(null), "backup_invalid")
    expectCode(
      () =>
        backup.validateBackup({
          app: "hozor-ghiab",
          formatVersion: 99,
          schemaVersion: 1,
          data: { employees: [], attendance: [], leaves: [], payslips: [] }
        }),
      "backup_newer_version"
    )
  })

  it("rejects attendance rows that point at an unknown employee", () => {
    expectCode(
      () =>
        backup.validateBackup({
          app: "hozor-ghiab",
          formatVersion: 1,
          schemaVersion: 1,
          data: {
            employees: [],
            attendance: [{ id: "a1", employeeId: "ghost", recordDate: "2026-11-01" }],
            leaves: [],
            payslips: []
          }
        }),
      "backup_invalid"
    )
  })
})

describe("scale and uniqueness", () => {
  it("rejects a duplicate payslip even when the friendly pre-check is bypassed", () => {
    const employee = seedEmployee()
    repositories.savePayslip(
      { employeeId: employee.id, periodStart: "2026-11-01", periodEnd: "2026-11-30", baseSalaryMinor: 100_000 },
      "admin"
    )

    const db = database.getDb() as unknown as { prepare: (sql: string) => { run: (...params: unknown[]) => unknown } }
    expect(() =>
      db
        .prepare(
          `INSERT INTO payslips (id, number, employee_id, employee_name, employee_code, salary_type, base_rate_minor, period_start, period_end, created_at, updated_at)
           VALUES ('ps-raw', 'PS-2026-9000', ?, 'Ali Hassan', 'KW-100', 'hourly', 0, '2026-11-01', '2026-11-30', '2026-11-30T00:00:00.000Z', '2026-11-30T00:00:00.000Z')`
        )
        .run(employee.id)
    ).toThrow(/UNIQUE/)
    expect(repositories.listPayslips()).toHaveLength(1)
  })

  it("pages attendance rows but aggregates the whole range", () => {
    const employee = seedEmployee()
    for (let day = 1; day <= 12; day += 1) {
      const start = new Date(2026, 9, day, 8, 0, 0).getTime()
      repositories.punchIn(employee.id, { now: start })
      repositories.punchOut(employee.id, { now: start + 8 * HOUR })
    }

    const first = repositories.attendancePage({
      fromDate: "2026-10-01",
      toDate: "2026-10-31",
      page: 1,
      pageSize: 5
    })
    expect(first.total).toBe(12)
    expect(first.rows).toHaveLength(5)
    expect(first.page).toBe(1)

    const last = repositories.attendancePage({
      fromDate: "2026-10-01",
      toDate: "2026-10-31",
      page: 3,
      pageSize: 5
    })
    expect(last.rows).toHaveLength(2)

    const summary = repositories.aggregateAttendance({
      fromDate: "2026-10-01",
      toDate: "2026-10-31",
      dailyHours: 8
    })
    expect(summary.workedDays).toBe(12)
    expect(summary.workedMinutes).toBe(12 * 8 * 60)
    expect(summary.overtimeMinutes).toBe(0)
    expect(summary.openRecords).toBe(0)
    expect(summary.totalRecords).toBe(12)
    expect(summary.firstDate).toBe("2026-10-01")
    expect(summary.lastDate).toBe("2026-10-12")
  })

  it("counts an open shift apart from worked days in the aggregate", () => {
    const employee = seedEmployee()
    const start = new Date(2026, 9, 5, 8, 0, 0).getTime()
    repositories.punchIn(employee.id, { now: start })
    repositories.punchOut(employee.id, { now: start + 9 * HOUR })
    repositories.punchIn(employee.id, { now: new Date(2026, 9, 6, 8, 0, 0).getTime() })

    const summary = repositories.aggregateAttendance({ fromDate: "2026-10-01", toDate: "2026-10-31", dailyHours: 8 })
    expect(summary.workedDays).toBe(1)
    expect(summary.openRecords).toBe(1)
    expect(summary.overtimeMinutes).toBe(60)
  })

  it("pages payslips with an exact total", () => {
    const employee = seedEmployee()
    for (let month = 1; month <= 6; month += 1) {
      const suffix = String(month).padStart(2, "0")
      repositories.savePayslip(
        {
          employeeId: employee.id,
          periodStart: `2026-${suffix}-01`,
          periodEnd: `2026-${suffix}-28`,
          baseSalaryMinor: 1_000
        },
        "admin"
      )
    }

    const page = repositories.payslipsPage({ page: 2, pageSize: 4 })
    expect(page.total).toBe(6)
    expect(page.rows).toHaveLength(2)
    expect(page.page).toBe(2)
    expect(repositories.countPayslips()).toBe(6)
  })

  it("deduplicates legacy payslips before creating the unique index", () => {
    const fs = require("node:fs") as typeof import("node:fs")
    const os = require("node:os") as typeof import("node:os")
    const nodePath = require("node:path") as typeof import("node:path")
    const schema = require("../src/main/db/schema.cjs") as {
      MIGRATIONS: Array<{ version: number; sql: string }>
    }
    const { DatabaseSync } = require("node:sqlite") as typeof import("node:sqlite")

    const dir = fs.mkdtempSync(nodePath.join(os.tmpdir(), "hozor-unique-"))
    const file = nodePath.join(dir, "legacy4.db")

    const legacy = new DatabaseSync(file)
    for (const migration of schema.MIGRATIONS) {
      if (migration.version > 3) continue
      legacy.exec(migration.sql)
    }
    const insert = legacy.prepare(
      `INSERT INTO payslips (id, number, employee_id, employee_name, employee_code, salary_type, base_rate_minor, period_start, period_end, created_at, updated_at)
       VALUES (?, ?, 'emp-1', 'Ali Hassan', 'KW-100', 'hourly', 0, '2026-11-01', '2026-11-30', ?, ?)`
    )
    insert.run("ps-old", "PS-2026-0001", "2026-11-30T00:00:00.000Z", "2026-11-30T00:00:00.000Z")
    insert.run("ps-new", "PS-2026-0002", "2026-12-02T00:00:00.000Z", "2026-12-05T00:00:00.000Z")
    legacy.exec("PRAGMA user_version = 3")
    legacy.close()

    database.closeDatabase()
    database.initDatabaseFromFile(file)

    const slips = repositories.listPayslips()
    expect(slips).toHaveLength(1)
    expect(slips[0].id).toBe("ps-new")
    const [log] = repositories.listAuditLogs(5)
    expect(log.action).toBe("deleted")
    expect(JSON.parse(log.details).reason).toBe("duplicate_period")

    const db = database.getDb() as unknown as { prepare: (sql: string) => { run: (...params: unknown[]) => unknown } }
    expect(() =>
      db
        .prepare(
          `INSERT INTO payslips (id, number, employee_id, employee_name, employee_code, salary_type, base_rate_minor, period_start, period_end, created_at, updated_at)
           VALUES ('ps-3', 'PS-2026-0003', 'emp-1', 'Ali Hassan', 'KW-100', 'hourly', 0, '2026-11-01', '2026-11-30', '2026-12-09T00:00:00.000Z', '2026-12-09T00:00:00.000Z')`
        )
        .run()
    ).toThrow(/UNIQUE/)

    database.closeDatabase()
    fs.rmSync(dir, { recursive: true, force: true })
  })

  it("restores a legacy backup that holds duplicate periods", () => {
    const employee = seedEmployee()
    const payload = backup.buildBackup()
    const base = {
      employeeId: employee.id,
      employeeName: employee.fullName,
      employeeCode: employee.employeeCode,
      salaryType: "hourly",
      baseRateMinor: 0,
      periodStart: "2026-11-01",
      periodEnd: "2026-11-30"
    }
    payload.data.payslips = [
      { ...base, id: "ps-a", number: "PS-2026-0001", createdAt: "2026-11-01T00:00:00.000Z" },
      { ...base, id: "ps-b", number: "PS-2026-0002", createdAt: "2026-11-05T00:00:00.000Z" }
    ]

    const result = repositories.importAll(backup.validateBackup(payload), "admin")
    expect(result.skippedPayslips).toBe(1)
    const slips = repositories.listPayslips()
    expect(slips).toHaveLength(1)
    expect(slips[0].id).toBe("ps-b")
    const [log] = repositories.listAuditLogs(5)
    expect(log.action).toBe("restored")
    expect(JSON.parse(log.details).skippedPayslips).toBe(1)
  })
})

describe("emergency password reset", () => {
  it("updates admin password hash and records audit log with recovery actor", () => {
    repositories.updateSettings({ ownerName: "Bader", companyName: "Al-Sabah Trading" }, "setup")
    const newHash = auth.hashPassword("new-secret-4321")
    const updated = repositories.setPasswordHash(newHash, "recovery")
    expect(updated.hasPassword).toBe(true)
    expect(auth.verifyPassword("new-secret-4321", repositories.getPasswordHash())).toBe(true)
    const logs = repositories.listAuditLogs(10)
    const resetLog = logs.find((l: { action: string }) => l.action === "password_changed")
    expect(resetLog).toBeDefined()
    expect(resetLog.actor).toBe("recovery")
  })
})
