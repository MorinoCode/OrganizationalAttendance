import {
  AppInfo,
  AttendanceRecord,
  AttendanceSummary,
  AuthSession,
  BackupEntry,
  BackupPreview,
  BackupStatus,
  CompanySettings,
  DashboardInsights,
  Employee,
  ExcelExportSpec,
  ExportProgress,
  ExportResult,
  PagedResult,
  Payslip,
  PublicEmployee,
  RestoreSnapshotResult,
  UpdaterStatus
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
    page(data: Record<string, unknown>, token: string | null): Promise<Envelope<PagedResult<AttendanceRecord>>>
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
    unpaidDays(data: Record<string, unknown>, token: string | null): Promise<Envelope<number>>
  }
  payslips: {
    list(data: Record<string, unknown>, token: string | null): Promise<Envelope<Payslip[]>>
    page(data: Record<string, unknown>, token: string | null): Promise<Envelope<PagedResult<Payslip>>>
    save(data: Record<string, unknown>, token: string | null): Promise<Envelope<Payslip>>
    setSigned(data: { id: string; isSigned: boolean }, token: string | null): Promise<Envelope<Payslip>>
    remove(data: { id: string }, token: string | null): Promise<Envelope<{ id: string }>>
  }
  reports: {
    dashboardInsights(data: { months?: number }, token: string | null): Promise<Envelope<DashboardInsights>>
  }
  backup: {
    export(token: string | null): Promise<Envelope<{ canceled: boolean; filePath?: string }>>
    status(token: string | null): Promise<Envelope<BackupStatus>>
    now(token: string | null): Promise<Envelope<BackupEntry>>
    choose(token: string | null): Promise<Envelope<{ canceled: boolean; selectionId?: string; preview?: BackupPreview }>>
    restore(selectionId: string | undefined, token: string | null): Promise<Envelope<RestoreSnapshotResult>>
    restoreAuto(fileName: string, token: string | null): Promise<Envelope<RestoreSnapshotResult>>
  }
  print: {
    payslip(token: string | null): Promise<Envelope<{ success: boolean; reason: string | null }>>
    payslipPdf(token: string | null): Promise<Envelope<{ canceled: boolean; filePath?: string }>>
  }
  exporter: {
    attendance(
      data: { id: string; filter: Record<string, unknown>; spec: ExcelExportSpec },
      token: string | null
    ): Promise<Envelope<ExportResult>>
    payslips(
      data: { id: string; filter: Record<string, unknown>; spec: ExcelExportSpec },
      token: string | null
    ): Promise<Envelope<ExportResult>>
    cancel(id: string, token: string | null): Promise<Envelope<{ canceled: boolean }>>
    onProgress(callback: (progress: ExportProgress) => void): () => void
  }
  updater: {
    check(token: string | null): Promise<Envelope<UpdaterStatus>>
    download(token: string | null): Promise<Envelope<{ ok: boolean; error?: string; reason?: string }>>
    install(token: string | null): Promise<Envelope<{ ok: boolean; reason?: string }>>
    status(token: string | null): Promise<Envelope<UpdaterStatus>>
    onEvent(callback: (status: UpdaterStatus) => void): () => void
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
    page: (filter: Record<string, unknown> = {}) => unwrap(bridge().attendance.page(filter, sessionToken)),
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
    unpaidDays: (employeeId: string, fromDate: string, toDate: string) =>
      unwrap(bridge().leaves.unpaidDays({ employeeId, fromDate, toDate }, sessionToken))
  },
  payslips: {
    list: (filter: Record<string, unknown> = {}) => unwrap(bridge().payslips.list(filter, sessionToken)),
    page: (filter: Record<string, unknown> = {}) => unwrap(bridge().payslips.page(filter, sessionToken)),
    save: (data: Record<string, unknown>) => unwrap(bridge().payslips.save(data, sessionToken)),
    setSigned: (id: string, isSigned: boolean) => unwrap(bridge().payslips.setSigned({ id, isSigned }, sessionToken)),
    remove: (id: string) => unwrap(bridge().payslips.remove({ id }, sessionToken))
  },
  reports: {
    dashboardInsights: (months = 6) => unwrap(bridge().reports.dashboardInsights({ months }, sessionToken))
  },
  backup: {
    export: () => unwrap(bridge().backup.export(sessionToken)),
    status: () => unwrap(bridge().backup.status(sessionToken)),
    now: () => unwrap(bridge().backup.now(sessionToken)),
    choose: () => unwrap(bridge().backup.choose(sessionToken)),
    restore: (selectionId?: string) => unwrap(bridge().backup.restore(selectionId, sessionToken)),
    restoreAuto: (fileName: string) => unwrap(bridge().backup.restoreAuto(fileName, sessionToken))
  },
  print: {
    payslip: () => unwrap(bridge().print.payslip(sessionToken)),
    payslipPdf: () => unwrap(bridge().print.payslipPdf(sessionToken))
  },
  exporter: {
    attendance: (id: string, filter: Record<string, unknown>, spec: ExcelExportSpec) =>
      unwrap(bridge().exporter.attendance({ id, filter, spec }, sessionToken)),
    payslips: (id: string, filter: Record<string, unknown>, spec: ExcelExportSpec) =>
      unwrap(bridge().exporter.payslips({ id, filter, spec }, sessionToken)),
    cancel: (id: string) => unwrap(bridge().exporter.cancel(id, sessionToken)),
    onProgress: (callback: (progress: ExportProgress) => void) => bridge().exporter.onProgress(callback)
  },
  updater: {
    check: () => unwrap(bridge().updater.check(sessionToken)),
    download: () => unwrap(bridge().updater.download(sessionToken)),
    install: () => unwrap(bridge().updater.install(sessionToken)),
    status: () => unwrap(bridge().updater.status(sessionToken)),
    onEvent: (callback: (status: UpdaterStatus) => void) => bridge().updater.onEvent(callback)
  }
}
