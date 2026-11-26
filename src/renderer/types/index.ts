export type Language = "ar" | "en" | "fa"

export type SalaryType = "fixed_monthly" | "hourly" | "daily" | "custom"

export type AttendanceStatus = "present" | "on_break" | "completed" | "absent"

export type PaymentMethod = "cash" | "bank_transfer" | "cheque" | "knet"

export interface CompanySettings {
  companyName: string
  ownerName: string
  ownerRole: string
  currency: string
  currencyDecimals: number
  defaultDailyHours: number
  standardWorkDays: number
  overtimeMultiplier: number
  shiftStartMinutes: number
  shiftEndMinutes: number
  graceMinutes: number
  workDays: number[]
  isConfigured: boolean
  hasPassword: boolean
  logoPath: string | null
  updatedAt?: string | null
}

export interface Employee {
  id: string
  fullName: string
  employeeCode: string
  phone: string
  department: string
  salaryType: SalaryType
  baseRateMinor: number
  isActive: boolean
  createdAt: string
  updatedAt?: string
}

export interface PublicEmployee {
  id: string
  fullName: string
  employeeCode: string
  department: string
}

export interface BreakLog {
  id: string
  breakStartAt: number
  breakEndAt: number | null
  durationMinutes: number
}

export interface AttendanceRecord {
  id: string
  employeeId: string
  employeeName: string
  recordDate: string
  punchInAt: number | null
  punchOutAt: number | null
  breakMinutes: number
  netMinutes: number
  lateMinutes: number
  earlyLeaveMinutes: number
  status: AttendanceStatus
  notes: string
  breaks: BreakLog[]
}

export interface Payslip {
  id: string
  number: string
  employeeId: string
  employeeName: string
  employeeCode: string
  department: string
  salaryType: SalaryType
  baseRateMinor: number
  periodStart: string
  periodEnd: string
  workedDays: number
  workedMinutes: number
  breakMinutes: number
  overtimeMinutes: number
  unpaidLeaveDays: number
  baseSalaryMinor: number
  overtimeAmountMinor: number
  bonusesMinor: number
  deductionsMinor: number
  netAmountMinor: number
  paymentDate: string
  paymentMethod: PaymentMethod
  notes: string
  isSigned: boolean
  signedAt: string | null
  createdAt: string
}

export interface AttendanceSummary {
  workedDays: number
  workedMinutes: number
  breakMinutes: number
  overtimeMinutes: number
  openRecords: number
  totalRecords?: number
  firstDate: string | null
  lastDate: string | null
}

export interface ExportProgress {
  id: string
  written: number
  total: number
}

export interface ExportResult {
  canceled: boolean
  filePath?: string
  rows?: number
  total?: number
  durationMs?: number
}

export interface ExcelExportSpec {
  creator: string
  sheetName: string
  rtl: boolean
  title: string
  subtitle?: string
  headers: string[]
  headerRowIndex: number
  widths: number[]
  locale: string
  fileName: string
  totalLabel: string
  showEmployee?: boolean
  statusLabels?: Record<string, string>
  paymentMethodLabels?: Record<string, string>
  signedLabel?: string
  unsignedLabel?: string
  summaryLabel?: string
  currency?: string
  decimals?: number
}

export interface PagedResult<T> {
  rows: T[]
  total: number
  page: number
  pageSize: number
}

export interface AuthSession {
  token: string
  expiresAt: number
}

export interface BackupCounts {
  employees: number
  attendance: number
  leaves: number
  payslips: number
}

export type BackupReason = "quit" | "interval" | "change" | "manual" | "pre-restore"

export interface BackupEntry {
  fileName: string
  path?: string
  createdAt: string
  reason: BackupReason
  sizeBytes: number
  verified: boolean | null
  schemaVersion: number | null
  counts: BackupCounts | null
}

export interface BackupPreview {
  fileName: string
  exportedAt: string | null
  schemaVersion: number
  formatVersion: number
  counts: BackupCounts
  attendanceFrom: string | null
  attendanceTo: string | null
}

export interface BackupStatus {
  directory: string | null
  keep: number
  intervalMinutes: number
  changeThreshold: number
  changesSinceLastBackup: number
  last: BackupEntry | null
  backups: BackupEntry[]
}

export interface RestoreSnapshotResult {
  canceled?: boolean
  restored?: boolean
  source?: "file" | "auto-backup"
  fileName?: string
  snapshot?: BackupEntry | null
}

export interface AppInfo {
  version: string
  isPackaged: boolean
  electron: string
  node: string
  platform: string
  databasePath: string | null
}

export interface DepartmentCost {
  department: string
  employees: number
  slips: number
  netAmountMinor: number
  overtimeAmountMinor: number
  overtimeMinutes: number
  workedMinutes: number
}

export interface DepartmentCostTotal {
  employees: number
  slips: number
  netAmountMinor: number
  overtimeAmountMinor: number
  overtimeMinutes: number
  workedMinutes: number
}

export interface OvertimeTrendPoint {
  monthKey: string
  overtimeMinutes: number
  overtimeAmountMinor: number
}

export interface AbsenceSummary {
  expectedDays: number
  presentDays: number
  leaveDays: number
  absentDays: number
  rate: number
  activeEmployees: number
  workingDays: number
  workDaysPerWeek: number
  hasData: boolean
}

export interface DashboardInsights {
  generatedAt: string
  range: { fromDate: string; toDate: string; monthStart: string; months: number }
  departmentCosts: DepartmentCost[]
  departmentCostsTotal: DepartmentCostTotal
  overtimeTrend: OvertimeTrendPoint[]
  payrollTrend: { monthKey: string; netAmountMinor: number }[]
  hoursByEmployee: { id: string; name: string; code: string; department: string; minutes: number }[]
  absence: AbsenceSummary
}

export type UpdaterStatusValue =
  | "idle"
  | "checking"
  | "available"
  | "downloading"
  | "downloaded"
  | "not-available"
  | "not-configured"
  | "development"
  | "error"

export interface UpdaterStatus {
  status: UpdaterStatusValue | string
  version: string | null
  percent?: number
  error?: string | null
  currentVersion?: string
  isPackaged?: boolean
  feedConfigured?: boolean
  lastCheckedAt?: string | null
}
