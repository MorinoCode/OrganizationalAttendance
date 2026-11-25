import {
  AppInfo,
  AttendanceRecord,
  AttendanceSummary,
  AuditLogEntry,
  AuthSession,
  CompanySettings,
  Employee,
  LeaveRecord,
  MonthCloseReport,
  Payslip,
  PublicEmployee
} from "../types"
import { ApiError } from "./errors"


interface Envelope<T> {
  ok: boolean
  data?: T
  error?: { code: string; message?: string }
}

interface PeriodActionResult {
  fromDate: string
  toDate: string
  updated?: number
  inserted?: number
  deleted?: number
}

interface Bridge {
  app: { info(): Promise<Envelope<AppInfo>> }
  auth: {
    status(): Promise<Envelope<{ hasPassword: boolean; isConfigured: boolean; sessionTtlMs: number }>>
    login(password: string): Promise<Envelope<AuthSession & { settings: CompanySettings }>>
    logout(token: string | null): Promise<Envelope<unknown>>
    changePassword(data: { currentPassword: string; newPassword: string }, token: string | null): Promise<Envelope<AuthSession>>
    emergencyReset(data: { verification: string; newPassword: string }): Promise<Envelope<AuthSession & { settings: CompanySettings }>>
  }
  settings: {
    get(): Promise<Envelope<CompanySettings>>
    update(data: Partial<CompanySettings>, token: string | null): Promise<Envelope<CompanySettings>>
    completeSetup(data: Record<string, unknown>): Promise<Envelope<{ settings: CompanySettings } & AuthSession>>
  }
  employees: {
    list(data: { includeInactive?: boolean }, token: string | null): Promise<Envelope<Employee[]>>
    publicList(): Promise<Envelope<PublicEmployee[]>>
    save(data: Record<string, unknown>, token: string | null): Promise<Envelope<Employee>>
    setActive(data: { id: string; isActive: boolean }, token: string | null): Promise<Envelope<Employee>>
    remove(data: { id: string }, token: string | null): Promise<Envelope<{ id: string }>>
  }
  attendance: {
    today(data?: { employeeId?: string }): Promise<Envelope<AttendanceRecord[]>>
    list(data: Record<string, unknown>, token: string | null): Promise<Envelope<AttendanceRecord[]>>
    punchIn(data: { employeeId: string }): Promise<Envelope<AttendanceRecord>>
    startBreak(data: { employeeId: string }): Promise<Envelope<AttendanceRecord>>
    endBreak(data: { employeeId: string }): Promise<Envelope<AttendanceRecord>>
    punchOut(data: { employeeId: string }): Promise<Envelope<AttendanceRecord>>
    aggregate(data: Record<string, unknown>, token: string | null): Promise<Envelope<AttendanceSummary>>
    recalculate(data: { fromDate?: string; toDate?: string }, token: string | null): Promise<Envelope<PeriodActionResult>>
    markAbsences(data: { fromDate?: string; toDate?: string }, token: string | null): Promise<Envelope<PeriodActionResult>>
    clearAbsences(data: { fromDate?: string; toDate?: string }, token: string | null): Promise<Envelope<PeriodActionResult>>
    correct(data: { id: string; patch: Record<string, unknown> }, token: string | null): Promise<Envelope<AttendanceRecord>>
    remove(data: { id: string }, token: string | null): Promise<Envelope<{ id: string }>>
  }
  leaves: {
    list(data: Record<string, unknown>, token: string | null): Promise<Envelope<LeaveRecord[]>>
    save(data: Record<string, unknown>, token: string | null): Promise<Envelope<LeaveRecord>>
    remove(data: { id: string }, token: string | null): Promise<Envelope<{ id: string }>>
    unpaidDays(data: Record<string, unknown>, token: string | null): Promise<Envelope<number>>
  }
  payslips: {
    list(data: Record<string, unknown>, token: string | null): Promise<Envelope<Payslip[]>>
    save(data: Record<string, unknown>, token: string | null): Promise<Envelope<Payslip>>
    setSigned(data: { id: string; isSigned: boolean }, token: string | null): Promise<Envelope<Payslip>>
    remove(data: { id: string }, token: string | null): Promise<Envelope<{ id: string }>>
  }
  reports: {
    monthClose(data: { fromDate?: string; toDate?: string }, token: string | null): Promise<Envelope<MonthCloseReport>>
  }
  audit: { list(data: { limit?: number }, token: string | null): Promise<Envelope<AuditLogEntry[]>> }
  backup: {
    export(token: string | null): Promise<Envelope<{ canceled: boolean; filePath?: string }>>
    restore(token: string | null): Promise<Envelope<{ canceled: boolean; restored?: boolean }>>
  }
  print: {
    payslip(token: string | null): Promise<Envelope<{ success: boolean; reason: string | null }>>
    payslipPdf(token: string | null): Promise<Envelope<{ canceled: boolean; filePath?: string }>>
  }
  updater: {
    check(): Promise<Envelope<{ status: string; version: string | null; currentVersion?: string; percent?: number; error?: string | null }>>
    download(): Promise<Envelope<{ ok: boolean; error?: string }>>
    install(): Promise<Envelope<{ ok: boolean }>>
    status(): Promise<Envelope<{ status: string; version: string | null; currentVersion?: string; percent?: number; error?: string | null; isPackaged?: boolean }>>
  }
}

declare global {
  interface Window {
    api?: Bridge
  }
}

let sessionToken: string | null = null

export function setSessionToken(token: string | null): void {
  sessionToken = token
}

export function getSessionToken(): string | null {
  return sessionToken
}

export function isDesktopRuntime(): boolean {
  return typeof window !== "undefined" && Boolean(window.api)
}

function bridge(): Bridge {
  if (!window.api) {
    throw new ApiError("electron_required", "This application must run inside Electron.")
  }
  return window.api
}

async function unwrap<T>(promise: Promise<Envelope<T>>): Promise<T> {
  let response: Envelope<T>
  try {
    response = await promise
  } catch (error) {
    throw new ApiError("internal_error", error instanceof Error ? error.message : String(error))
  }
  if (!response || typeof response.ok !== "boolean") {
    throw new ApiError("internal_error", "The main process returned an invalid response.")
  }
  if (!response.ok) {
    throw new ApiError(response.error?.code ?? "internal_error", response.error?.message ?? "")
  }
  return response.data as T
}

export const api = {
  app: {
    info: () => unwrap(bridge().app.info())
  },
  auth: {
    status: () => unwrap(bridge().auth.status()),
    login: (password: string) => unwrap(bridge().auth.login(password)),
    logout: () => unwrap(bridge().auth.logout(sessionToken)),
    changePassword: (currentPassword: string, newPassword: string) =>
      unwrap(bridge().auth.changePassword({ currentPassword, newPassword }, sessionToken)),
    emergencyReset: (verification: string, newPassword: string) =>
      unwrap(bridge().auth.emergencyReset({ verification, newPassword }))
  },
  settings: {
    get: () => unwrap(bridge().settings.get()),
    update: (data: Partial<CompanySettings>) => unwrap(bridge().settings.update(data, sessionToken)),
    completeSetup: (data: Record<string, unknown>) => unwrap(bridge().settings.completeSetup(data))
  },
  employees: {
    list: (includeInactive = false) => unwrap(bridge().employees.list({ includeInactive }, sessionToken)),
    publicList: () => unwrap(bridge().employees.publicList()),
    save: (data: Record<string, unknown>) => unwrap(bridge().employees.save(data, sessionToken)),
    setActive: (id: string, isActive: boolean) => unwrap(bridge().employees.setActive({ id, isActive }, sessionToken)),
    remove: (id: string) => unwrap(bridge().employees.remove({ id }, sessionToken))
  },
  attendance: {
    today: (employeeId?: string) => unwrap(bridge().attendance.today({ employeeId })),
    list: (filter: Record<string, unknown> = {}) => unwrap(bridge().attendance.list(filter, sessionToken)),
    punchIn: (employeeId: string) => unwrap(bridge().attendance.punchIn({ employeeId })),
    startBreak: (employeeId: string) => unwrap(bridge().attendance.startBreak({ employeeId })),
    endBreak: (employeeId: string) => unwrap(bridge().attendance.endBreak({ employeeId })),
    punchOut: (employeeId: string) => unwrap(bridge().attendance.punchOut({ employeeId })),
    aggregate: (filter: Record<string, unknown>) => unwrap(bridge().attendance.aggregate(filter, sessionToken)),
    recalculate: (fromDate: string, toDate: string) =>
      unwrap(bridge().attendance.recalculate({ fromDate, toDate }, sessionToken)),
    markAbsences: (fromDate: string, toDate: string) =>
      unwrap(bridge().attendance.markAbsences({ fromDate, toDate }, sessionToken)),
    clearAbsences: (fromDate: string, toDate: string) =>
      unwrap(bridge().attendance.clearAbsences({ fromDate, toDate }, sessionToken)),
    correct: (id: string, patch: Record<string, unknown>) => unwrap(bridge().attendance.correct({ id, patch }, sessionToken)),
    remove: (id: string) => unwrap(bridge().attendance.remove({ id }, sessionToken))
  },
  leaves: {
    list: (filter: Record<string, unknown> = {}) => unwrap(bridge().leaves.list(filter, sessionToken)),
    save: (data: Record<string, unknown>) => unwrap(bridge().leaves.save(data, sessionToken)),
    remove: (id: string) => unwrap(bridge().leaves.remove({ id }, sessionToken)),
    unpaidDays: (employeeId: string, fromDate: string, toDate: string) =>
      unwrap(bridge().leaves.unpaidDays({ employeeId, fromDate, toDate }, sessionToken))
  },
  payslips: {
    list: (filter: Record<string, unknown> = {}) => unwrap(bridge().payslips.list(filter, sessionToken)),
    save: (data: Record<string, unknown>) => unwrap(bridge().payslips.save(data, sessionToken)),
    setSigned: (id: string, isSigned: boolean) => unwrap(bridge().payslips.setSigned({ id, isSigned }, sessionToken)),
    remove: (id: string) => unwrap(bridge().payslips.remove({ id }, sessionToken))
  },
  reports: {
    monthClose: (fromDate: string, toDate: string) =>
      unwrap(bridge().reports.monthClose({ fromDate, toDate }, sessionToken))
  },
  audit: {
    list: (limit = 50) => unwrap(bridge().audit.list({ limit }, sessionToken))
  },
  backup: {
    export: () => unwrap(bridge().backup.export(sessionToken)),
    restore: () => unwrap(bridge().backup.restore(sessionToken))
  },
  print: {
    payslip: () => unwrap(bridge().print.payslip(sessionToken)),
    payslipPdf: () => unwrap(bridge().print.payslipPdf(sessionToken))
  },
  updater: {
    check: () => unwrap(bridge().updater.check()),
    download: () => unwrap(bridge().updater.download()),
    install: () => unwrap(bridge().updater.install()),
    status: () => unwrap(bridge().updater.status())
  }
}
