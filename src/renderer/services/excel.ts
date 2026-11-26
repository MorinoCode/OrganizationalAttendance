import i18n from "../i18n/config"
import { api } from "./api"
import { LOCALES } from "./date"
import { CompanySettings, Employee, ExcelExportSpec, ExportResult, Language } from "../types"

function currentLanguage(): Language {
  const lang = (i18n.language || "ar") as Language
  return lang === "en" || lang === "fa" ? lang : "ar"
}

function t(key: string, options?: Record<string, unknown>): string {
  return (options ? i18n.t(key, options as never) : i18n.t(key)) as string
}

export interface AttendanceExportFilter {
  employeeId?: string
  fromDate?: string
  toDate?: string
}

export interface PayslipExportFilter {
  employeeId?: string
  search?: string
}


export async function exportAttendanceExcel(
  filter: AttendanceExportFilter,
  settings: CompanySettings,
  options: { id: string; title?: string; fromDate?: string; toDate?: string; employee?: Employee }
): Promise<ExportResult> {
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
  const spec: ExcelExportSpec = {
    creator: t("appTitle"),
    sheetName: t("attendance.sheetName"),
    rtl: lang !== "en",
    title: options.title ?? `${settings.companyName} — ${t("attendance.sheetName")}`,
    subtitle: [options.employee ? `${options.employee.fullName} (${options.employee.employeeCode})` : "", range]
      .filter(Boolean)
      .join(" · "),
    headers,
    headerRowIndex: 4,
    widths: headers.map((_, index) => (index === 0 ? 14 : index === 1 ? 14 : index === 2 && showEmployee ? 26 : 14)),
    locale: LOCALES[lang],
    fileName: `${t("attendance.fileName")}_${options.fromDate ?? ""}_${options.toDate ?? ""}.xlsx`,
    totalLabel: t("common.total"),
    showEmployee,
    hourUnit: t("common.hours"),
    minuteUnit: t("common.minutes"),
    statusLabels: {
      present: t("kiosk.status.working"),
      on_break: t("kiosk.status.onBreak"),
      completed: t("kiosk.status.completed"),
      absent: t("kiosk.status.absent")
    }
  }

  return api.exporter.attendance(options.id, filter as Record<string, unknown>, spec)
}

export async function exportPayslipsExcel(
  filter: PayslipExportFilter,
  settings: CompanySettings,
  options: { id: string }
): Promise<ExportResult> {
  const lang = currentLanguage()
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

  const spec: ExcelExportSpec = {
    creator: t("appTitle"),
    sheetName: t("payroll.sheetName"),
    rtl: lang !== "en",
    title: `${settings.companyName} — ${t("payroll.sheetName")}`,
    headers,
    headerRowIndex: 3,
    widths: headers.map((_, index) => (index === 1 ? 26 : index === 4 ? 24 : 15)),
    locale: LOCALES[lang],
    fileName: `${t("payroll.fileName")}.xlsx`,
    totalLabel: t("common.total"),
    paymentMethodLabels: Object.fromEntries(
      ["bank_transfer", "cash", "knet", "cheque"].map(method => [method, t(`payroll.paymentMethods.${method}`)])
    ),
    signedLabel: t("payroll.signed"),
    unsignedLabel: t("payroll.unsigned"),
    summaryLabel: t("payroll.netAmount"),
    currency: settings.currency,
    decimals: settings.currencyDecimals,
    hourUnit: t("common.hours"),
    minuteUnit: t("common.minutes")
  }

  return api.exporter.payslips(options.id, filter as Record<string, unknown>, spec)
}
