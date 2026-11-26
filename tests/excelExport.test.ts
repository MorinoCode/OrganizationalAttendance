import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { createRequire } from "node:module"
import { afterAll, beforeEach, describe, expect, it } from "vitest"

const require = createRequire(import.meta.url)
const database = require("../src/main/db/index.cjs") as {
  initDatabaseFromFile: (filePath: string) => unknown
  closeDatabase: () => void
  getDb: () => unknown
}
const repositories = require("../src/main/db/repositories.cjs")
const excelExport = require("../src/main/excelExport.cjs")
const ExcelJS = require("exceljs") as typeof import("exceljs")

const HOUR = 60 * 60 * 1000

function resetDatabase(): void {
  const db = database.getDb() as { exec: (sql: string) => void }
  db.exec("DELETE FROM break_logs")
  db.exec("DELETE FROM attendance_records")
  db.exec("DELETE FROM leaves")
  db.exec("DELETE FROM payslips")
  db.exec("DELETE FROM employees")
  db.exec("DELETE FROM audit_logs")
}

function seedEmployee(overrides: Record<string, unknown> = {}) {
  return repositories.saveEmployee(
    {
      fullName: "Ali Hassan",
      employeeCode: "KW-100",
      department: "Operations",
      salaryType: "hourly",
      baseRateMinor: 5000,
      ...overrides
    },
    "test"
  )
}

function minutesToHours(minutes: number): number {
  return Math.round(((Number(minutes) || 0) / 60) * 100) / 100
}

function formatDuration(minutes: number, hourUnit = "h", minuteUnit = "m"): string {
  const total = Math.max(0, Math.round(Number(minutes) || 0))
  const hours = Math.floor(total / 60)
  const rest = total % 60
  if (hours === 0 && rest === 0) return `0 ${minuteUnit}`
  if (hours === 0) return `${rest} ${minuteUnit}`
  if (rest === 0) return `${hours} ${hourUnit}`
  return `${hours} ${hourUnit} ${rest} ${minuteUnit}`
}

function decimalsOf(decimals: number): number {
  return Math.min(4, Math.max(0, Math.round(Number(decimals))))
}

const attendanceSpec = {
  creator: "test",
  sheetName: "Attendance",
  rtl: true,
  title: "Attendance",
  subtitle: "2026-06-01 → 2026-06-28",
  headers: ["Date", "Day", "Employee", "In", "Out", "Break", "Net", "Status", "Notes"],
  headerRowIndex: 4,
  widths: [14, 14, 26, 14, 14, 14, 14, 14, 14],
  locale: "en-GB",
  fileName: "attendance.xlsx",
  totalLabel: "Total",
  showEmployee: true,
  statusLabels: { completed: "Completed", present: "Working", on_break: "On break", absent: "Absent" }
}

const payslipSpec = {
  creator: "test",
  sheetName: "Payroll",
  rtl: true,
  title: "Payroll",
  headers: [
    "Number",
    "Employee",
    "Code",
    "Department",
    "Period",
    "Days",
    "Hours",
    "Overtime",
    "Base",
    "Overtime amount",
    "Bonuses",
    "Deductions",
    "Net",
    "Payment date",
    "Method",
    "State"
  ],
  headerRowIndex: 3,
  widths: [15, 26, 15, 15, 24, 15, 15, 15, 15, 15, 15, 15, 15, 15, 15, 15],
  locale: "en-GB",
  fileName: "payroll.xlsx",
  totalLabel: "Total",
  paymentMethodLabels: { bank_transfer: "Bank transfer", cash: "Cash" },
  signedLabel: "Signed",
  unsignedLabel: "Pending",
  summaryLabel: "Net total",
  currency: "KWD",
  decimals: 3
}

let workDir = ""

beforeEach(() => {
  database.initDatabaseFromFile(":memory:")
  resetDatabase()
  workDir = fs.mkdtempSync(path.join(os.tmpdir(), "hozor-export-"))
})

afterAll(() => {
  database.closeDatabase()
})

describe("streaming Excel export", () => {
  it("exports every page of a multi-page attendance range with matching totals", async () => {
    const employees = Array.from({ length: 40 }, (_, index) =>
      seedEmployee({ fullName: `Employee ${index + 1}`, employeeCode: `KW-${200 + index}` })
    )
    for (const [index, employee] of employees.entries()) {
      for (let day = 1; day <= 28; day += 1) {
        const start = new Date(2026, 5, day, 8, 0, 0).getTime()
        repositories.punchIn(employee.id, { now: start })
        repositories.punchOut(employee.id, { now: start + (7 + (index % 3)) * HOUR })
      }
    }

    const filter = { fromDate: "2026-06-01", toDate: "2026-06-28" }
    const expectedRows = repositories.countAttendance(filter)
    expect(expectedRows).toBe(40 * 28)
    expect(expectedRows).toBeGreaterThan(500) // more than one database page

    const summary = repositories.aggregateAttendance({ ...filter, dailyHours: 8 })
    const target = path.join(workDir, "attendance.xlsx")

    const result = await excelExport.exportAttendance({ filter, spec: attendanceSpec, targetPath: target })
    expect(result.rows).toBe(expectedRows)
    expect(result.total).toBe(expectedRows)
    expect(fs.existsSync(`${target}.part`)).toBe(false)

    const workbook = new ExcelJS.Workbook()
    await workbook.xlsx.readFile(target)
    const sheet = workbook.worksheets[0]

    const headerRow = sheet.getRow(attendanceSpec.headerRowIndex)
    expect(headerRow.getCell(1).value).toBe("Date")
    expect(headerRow.getCell(9).value).toBe("Notes")

    const firstDataRow = sheet.getRow(attendanceSpec.headerRowIndex + 1)
    expect(String(firstDataRow.getCell(1).value)).toMatch(/^2026-06-\d{2}$/)
    expect(firstDataRow.getCell(3).value).toBeTruthy()

    const totalRow = sheet.getRow(attendanceSpec.headerRowIndex + 1 + expectedRows)
    expect(totalRow.getCell(1).value).toBe("Total")
    expect(String(totalRow.getCell(7).value)).toBe(formatDuration(summary.workedMinutes, "h", "m"))
    expect(Number(totalRow.getCell(6).value)).toBe(summary.breakMinutes)
    expect(sheet.rowCount).toBe(attendanceSpec.headerRowIndex + 1 + expectedRows)
  }, 120000)

  it("exports a multi-page payslip ledger and keeps the trailing total line", async () => {
    const employees = Array.from({ length: 40 }, (_, index) =>
      seedEmployee({ fullName: `Employee ${index + 1}`, employeeCode: `KW-${300 + index}` })
    )
    for (const employee of employees) {
      for (let offset = 0; offset < 15; offset += 1) {
        const year = 2025 + Math.floor(offset / 12)
        const monthNumber = (offset % 12) + 1
        const suffix = String(monthNumber).padStart(2, "0")
        const month = offset + 1
        repositories.savePayslip(
          {
            employeeId: employee.id,
            periodStart: `${year}-${suffix}-01`,
            periodEnd: `${year}-${suffix}-28`,
            workedDays: 26,
            workedMinutes: 12_480,
            baseSalaryMinor: 250_000,
            paymentMethod: month % 2 ? "bank_transfer" : "cash"
          },
          "test"
        )
      }
    }

    const expectedRows = repositories.countPayslips()
    expect(expectedRows).toBe(40 * 15)
    expect(expectedRows).toBeGreaterThan(500)

    const target = path.join(workDir, "payroll.xlsx")
    const result = await excelExport.exportPayslips({ filter: {}, spec: payslipSpec, targetPath: target })
    expect(result.rows).toBe(expectedRows)

    const workbook = new ExcelJS.Workbook()
    await workbook.xlsx.readFile(target)
    const sheet = workbook.worksheets[0]

    const totalRow = sheet.getRow(payslipSpec.headerRowIndex + 1 + expectedRows)
    expect(totalRow.getCell(1).value).toBe("Total")

    const all = repositories.listPayslips()
    const expectedNet = all.reduce((sum: number, slip: { netAmountMinor: number }) => sum + slip.netAmountMinor, 0)
    const expectedNetValue = Number((expectedNet / 10 ** decimalsOf(payslipSpec.decimals)).toFixed(decimalsOf(payslipSpec.decimals)))
    expect(Number(totalRow.getCell(13).value)).toBeCloseTo(expectedNetValue, 6)

    const summaryLine = String(sheet.getRow(sheet.rowCount).getCell(1).value ?? "")
    expect(summaryLine).toContain("Net total")
    expect(sheet.rowCount).toBe(payslipSpec.headerRowIndex + 1 + expectedRows + 2)
    expect(String(sheet.getRow(payslipSpec.headerRowIndex + 1).getCell(1).value)).toMatch(/^PS-/)
  }, 120000)

  it("stops mid-export, removes the partial file and reports cancellation", async () => {
    const employees = Array.from({ length: 20 }, (_, index) =>
      seedEmployee({ fullName: `Employee ${index + 1}`, employeeCode: `KW-${400 + index}` })
    )
    for (const employee of employees) {
      for (let day = 1; day <= 28; day += 1) {
        const start = new Date(2026, 5, day, 8, 0, 0).getTime()
        repositories.punchIn(employee.id, { now: start })
        repositories.punchOut(employee.id, { now: start + 8 * HOUR })
      }
    }

    const target = path.join(workDir, "cancelled.xlsx")
    let stop = false

    await expect(
      excelExport.exportAttendance({
        filter: { fromDate: "2026-06-01", toDate: "2026-06-28" },
        spec: attendanceSpec,
        targetPath: target,
        shouldCancel: () => stop,
        onProgress: () => {
          stop = true
        }
      })
    ).rejects.toMatchObject({ code: "export_cancelled" })

    expect(fs.existsSync(target)).toBe(false)
    expect(fs.existsSync(`${target}.part`)).toBe(false)
  }, 120000)

  it("filters the payslip ledger by search term before exporting", async () => {
    const employee = seedEmployee()
    repositories.savePayslip(
      { employeeId: employee.id, periodStart: "2026-01-01", periodEnd: "2026-01-28", baseSalaryMinor: 1_000 },
      "test"
    )
    repositories.savePayslip(
      { employeeId: employee.id, periodStart: "2026-02-01", periodEnd: "2026-02-28", baseSalaryMinor: 1_000 },
      "test"
    )

    const page = repositories.payslipsPage({ search: "2026-02" })
    expect(page.total).toBe(1)
    expect(page.rows[0].periodStart).toBe("2026-02-01")

    const target = path.join(workDir, "filtered.xlsx")
    const result = await excelExport.exportPayslips({
      filter: { search: "2026-02" },
      spec: payslipSpec,
      targetPath: target
    })
    expect(result.rows).toBe(1)
  })
})
