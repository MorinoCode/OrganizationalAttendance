export type Language = "ar" | "en" | "fa"

export type SalaryType = "fixed_monthly" | "hourly" | "daily" | "custom"

export type AttendanceStatus = "present" | "on_break" | "completed" | "absent"

export type LeaveType = "paid" | "unpaid" | "sick" | "emergency"

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

export interface LeaveRecord {
  id: string
  employeeId: string
  employeeName: string
  leaveType: LeaveType
  startDate: string
  endDate: string
  days: number
  isPaid: boolean
  reason: string
  createdAt: string
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
  firstDate: string | null
  lastDate: string | null
}

export interface MonthCloseEmployee {
  employeeId: string
  employeeCode: string
  employeeName: string
  department: string
  isActive: boolean
  requiredDays: number
  presentDays: number
  absentDays: number
  absentMarkedDays: number
  leaveDays: number
  unpaidLeaveDays: number
  lateMinutes: number
  earlyLeaveMinutes: number
  workedMinutes: number
  overtimeMinutes: number
  openRecords: number
}

export interface MonthCloseTotals {
  requiredDays: number
  presentDays: number
  absentDays: number
  leaveDays: number
  unpaidLeaveDays: number
  lateMinutes: number
  earlyLeaveMinutes: number
  workedMinutes: number
  overtimeMinutes: number
  openRecords: number
}

export interface MonthCloseReport {
  periodStart: string
  periodEnd: string
  asOf: string
  shift: {
    startMinutes: number
    endMinutes: number
    graceMinutes: number
    workDays: number[]
  }
  employees: MonthCloseEmployee[]
  totals: MonthCloseTotals
}

export interface AuditLogEntry {
  id: number
  at: string
  actor: string
  entity: string
  entityId: string | null
  action: string
  details: string
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
