import i18n from "../i18n/config"
import { AttendanceRecord, CompanySettings, Employee, Payslip } from "../types"
import { Language } from "../types"
import { formatAmount, formatMoney, toExcelNumber } from "./money"
import { minutesToHours, weekdayName } from "./date"


type Workbook = import("exceljs").Workbook
type Worksheet = import("exceljs").Worksheet

const HEADER_FILL = "1E293B"
const TITLE_FILL = "0F172A"
const TOTAL_FILL = "E2E8F0"

function currentLanguage(): Language {
  const lang = (i18n.language || "ar") as Language
  return lang === "en" || lang === "fa" ? lang : "ar"
}

function t(key: string, options?: Record<string, unknown>): string {
  return (options ? i18n.t(key, options as never) : i18n.t(key)) as string
}

async function createWorkbook(): Promise<{ workbook: Workbook; sheet: (name: string) => Worksheet }> {
  const ExcelJS = (await import("exceljs")).default
  const workbook = new ExcelJS.Workbook()
  workbook.creator = t("appTitle")
  workbook.created = new Date()

  const sheet = (name: string) =>
    workbook.addWorksheet(name, {
      views: [{ rightToLeft: currentLanguage() !== "en" }],
      pageSetup: { paperSize: 9, orientation: "landscape", fitToPage: true }
    })

  return { workbook, sheet }
}

function styleHeaderRow(worksheet: Worksheet, rowNumber: number, columns: number): void {
  const row = worksheet.getRow(rowNumber)
  row.font = { bold: true, size: 11, color: { argb: "FFFFFFFF" } }
  row.height = 26
  for (let index = 1; index <= columns; index += 1) {
    const cell = row.getCell(index)
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: `FF${HEADER_FILL}` } }
    cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true }
    cell.border = { bottom: { style: "thin", color: { argb: "FF94A3B8" } } }
  }
}

function styleTitle(worksheet: Worksheet, text: string, columns: number, subtitle?: string): void {
  worksheet.mergeCells(1, 1, 1, columns)
  const titleCell = worksheet.getCell(1, 1)
  titleCell.value = text
  titleCell.font = { bold: true, size: 14, color: { argb: "FFFFFFFF" } }
  titleCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: `FF${TITLE_FILL}` } }
  titleCell.alignment = { horizontal: "center", vertical: "middle" }
  worksheet.getRow(1).height = 34

  if (subtitle) {
    worksheet.mergeCells(2, 1, 2, columns)
    const subtitleCell = worksheet.getCell(2, 1)
    subtitleCell.value = subtitle
    subtitleCell.font = { bold: true, size: 10, color: { argb: "FF334155" } }
    subtitleCell.alignment = { horizontal: "center", vertical: "middle" }
    worksheet.getRow(2).height = 22
  }
}

function styleTotalRow(worksheet: Worksheet, rowNumber: number, columns: number): void {
  const row = worksheet.getRow(rowNumber)
  row.font = { bold: true, size: 11 }
  for (let index = 1; index <= columns; index += 1) {
    row.getCell(index).fill = { type: "pattern", pattern: "solid", fgColor: { argb: `FF${TOTAL_FILL}` } }
  }
}

async function saveWorkbook(workbook: Workbook, fileName: string): Promise<void> {
  const buffer = await workbook.xlsx.writeBuffer()
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  })
  const url = window.URL.createObjectURL(blob)
  const anchor = document.createElement("a")
  anchor.href = url
  anchor.download = fileName
  anchor.click()
  window.setTimeout(() => window.URL.revokeObjectURL(url), 1000)
}

function attendanceStatusLabel(record: AttendanceRecord): string {
  if (record.status === "on_break") return t("kiosk.status.onBreak")
  if (record.status === "completed") return t("kiosk.status.completed")
  if (record.status === "absent") return t("kiosk.status.absent")
  return t("kiosk.status.working")
}

export async function exportAttendanceExcel(
  records: AttendanceRecord[],
  settings: CompanySettings,
  options: { title?: string; fromDate?: string; toDate?: string; employee?: Employee } = {}
): Promise<void> {
  const { workbook, sheet } = await createWorkbook()
  const worksheet = sheet(t("attendance.sheetName"))
  const lang = currentLanguage()

  const showEmployee = !options.employee
  const headers = [
    t("attendance.date"),
    t("attendance.weekday"),
    ...(showEmployee ? [t("attendance.employee")] : []),
    t("attendance.inTime"),
    t("attendance.outTime"),
    t("attendance.breakMinutes"),
    t("attendance.netHours"),
    t("employees.status"),
    t("attendance.notes")
  ]

  const range = options.fromDate && options.toDate ? `${options.fromDate} → ${options.toDate}` : ""
  styleTitle(
    worksheet,
    options.title ?? `${settings.companyName} — ${t("attendance.sheetName")}`,
    headers.length,
    [options.employee ? `${options.employee.fullName} (${options.employee.employeeCode})` : "", range]
      .filter(Boolean)
      .join(" · ")
  )

  const headerRowIndex = 4
  worksheet.getRow(headerRowIndex).values = headers
  styleHeaderRow(worksheet, headerRowIndex, headers.length)

  let totalMinutes = 0
  let totalBreak = 0

  records.forEach((record, index) => {
    totalMinutes += record.netMinutes
    totalBreak += record.breakMinutes
    const row = worksheet.getRow(headerRowIndex + 1 + index)
    row.values = [
      record.recordDate,
      weekdayName(record.recordDate, lang),
      ...(showEmployee ? [record.employeeName] : []),
      record.punchInAt ? new Date(record.punchInAt).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }) : "-",
      record.punchOutAt ? new Date(record.punchOutAt).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }) : "-",
      record.breakMinutes,
      minutesToHours(record.netMinutes),
      attendanceStatusLabel(record),
      record.notes || ""
    ]
    row.alignment = { horizontal: "center", vertical: "middle" }
  })

  const totalRowIndex = headerRowIndex + records.length + 1
  const totalRow = worksheet.getRow(totalRowIndex)
  const blankColumns = showEmployee ? 4 : 3
  totalRow.values = [
    t("common.total"),
    "",
    ...(showEmployee ? [""] : []),
    "",
    "",
    totalBreak,
    minutesToHours(totalMinutes),
    "",
    ""
  ].slice(0, blankColumns + 5)
  styleTotalRow(worksheet, totalRowIndex, headers.length)

  worksheet.columns.forEach((column, index) => {
    column.width = index === 0 ? 14 : index === 1 ? 14 : index === 2 && showEmployee ? 26 : 14
  })

  await saveWorkbook(workbook, `${t("attendance.fileName")}_${options.fromDate ?? ""}_${options.toDate ?? ""}.xlsx`)
}

export async function exportPayslipsExcel(payslips: Payslip[], settings: CompanySettings): Promise<void> {
  const { workbook, sheet } = await createWorkbook()
  const worksheet = sheet(t("payroll.sheetName"))

  const headers = [
    t("payroll.number"),
    t("employees.name"),
    t("employees.code"),
    t("employees.department"),
    t("payroll.period"),
    t("payroll.workedDays"),
    t("payroll.workedHours"),
    t("payroll.overtimeHours"),
    t("payroll.baseAmount"),
    t("payroll.overtime"),
    t("payroll.bonuses"),
    t("payroll.deductions"),
    t("payroll.netAmount"),
    t("payroll.paymentDate"),
    t("payroll.paymentMethod"),
    t("payroll.signState")
  ]

  styleTitle(worksheet, `${settings.companyName} — ${t("payroll.sheetName")}`, headers.length)

  const headerRowIndex = 3
  worksheet.getRow(headerRowIndex).values = headers
  styleHeaderRow(worksheet, headerRowIndex, headers.length)

  let totalNet = 0
  payslips.forEach((payslip, index) => {
    totalNet += payslip.netAmountMinor
    const row = worksheet.getRow(headerRowIndex + 1 + index)
    row.values = [
      payslip.number,
      payslip.employeeName,
      payslip.employeeCode,
      payslip.department,
      `${payslip.periodStart} → ${payslip.periodEnd}`,
      payslip.workedDays,
      minutesToHours(payslip.workedMinutes),
      minutesToHours(payslip.overtimeMinutes),
      toExcelNumber(payslip.baseSalaryMinor, settings.currencyDecimals),
      toExcelNumber(payslip.overtimeAmountMinor, settings.currencyDecimals),
      toExcelNumber(payslip.bonusesMinor, settings.currencyDecimals),
      toExcelNumber(payslip.deductionsMinor, settings.currencyDecimals),
      toExcelNumber(payslip.netAmountMinor, settings.currencyDecimals),
      payslip.paymentDate,
      t(`payroll.paymentMethods.${payslip.paymentMethod}`),
      payslip.isSigned ? t("payroll.signed") : t("payroll.unsigned")
    ]
    for (let column = 5; column <= 9; column += 1) {
      row.getCell(column).numFmt = `#,##0.${"0".repeat(settings.currencyDecimals)}`
    }
    row.getCell(13).numFmt = `#,##0.${"0".repeat(settings.currencyDecimals)}`
  })

  const totalRowIndex = headerRowIndex + payslips.length + 1
  const totalRow = worksheet.getRow(totalRowIndex)
  totalRow.values = [
    t("common.total"),
    "",
    "",
    "",
    "",
    "",
    "",
    "",
    "",
    "",
    "",
    "",
    toExcelNumber(totalNet, settings.currencyDecimals),
    "",
    "",
    ""
  ]
  totalRow.getCell(13).numFmt = `#,##0.${"0".repeat(settings.currencyDecimals)}`
  styleTotalRow(worksheet, totalRowIndex, headers.length)

  worksheet.columns.forEach((column, index) => {
    column.width = index === 1 ? 26 : index === 4 ? 24 : 15
  })

  const currencyLabel = formatAmount(totalNet, settings.currencyDecimals, currentLanguage())
  worksheet.addRow([])
  worksheet.addRow([`${t("payroll.netAmount")}: ${formatMoney(totalNet, settings.currency, settings.currencyDecimals, currentLanguage())} (${currencyLabel})`])

  await saveWorkbook(workbook, `${t("payroll.fileName")}.xlsx`)
}
