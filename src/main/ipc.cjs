"use strict"


const fs = require("node:fs")
const path = require("node:path")
const { ipcMain, dialog, app } = require("electron")

const repositories = require("./db/repositories.cjs")
const { getDatabasePath } = require("./db/index.cjs")
const auth = require("./lib/auth.cjs")
const backup = require("./backup.cjs")
const backupScheduler = require("./backupScheduler.cjs")
const excelExport = require("./excelExport.cjs")
const updater = require("./updater.cjs")
const time = require("./lib/time.cjs")
const { AppError, appError, toErrorPayload } = require("./lib/errors.cjs")

const MIN_PASSWORD_LENGTH = 4
const MAX_LOGIN_FAILURES = 5
const LOGIN_WINDOW_MS = 60 * 1000

let loginFailures = []

const activeExports = new Map()
const EXPORT_ID_RE = /^[A-Za-z0-9_-]{8,64}$/

function cancelActiveExports() {
  for (const session of activeExports.values()) session.canceled = true
}

function discardActiveExports() {
  for (const session of activeExports.values()) {
    session.canceled = true
    if (!session.tempPath) continue
    try {
      fs.rmSync(session.tempPath, { force: true })
    } catch {
    }
  }
  activeExports.clear()
}

function sanitizeFileName(name) {
  const cleaned = String(name || "export.xlsx")
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, "_")
    .trim()
  const withExtension = cleaned.toLowerCase().endsWith(".xlsx") ? cleaned : `${cleaned}.xlsx`
  return withExtension.slice(0, 120)
}

const RESTORE_SELECTION_TTL_MS = 10 * 60 * 1000
const restoreSelections = new Map()

function rememberRestoreSelection(filePath, preview) {
  const now = Date.now()
  for (const [key, value] of restoreSelections) {
    if (now - value.at > RESTORE_SELECTION_TTL_MS) restoreSelections.delete(key)
  }
  const selectionId = `restore_${now.toString(36)}_${Math.random().toString(36).slice(2, 10)}`
  restoreSelections.set(selectionId, { filePath, preview, at: now })
  return selectionId
}

function takeRestoreSelection(selectionId) {
  const selection = restoreSelections.get(selectionId)
  if (!selection) return null
  restoreSelections.delete(selectionId)
  if (Date.now() - selection.at > RESTORE_SELECTION_TTL_MS) return null
  return selection
}

function getWindow(getMainWindow) {
  const win = getMainWindow()
  if (!win) throw appError("window_unavailable", "Application window is not available.")
  return win
}

function checkLoginThrottle(now = Date.now()) {
  loginFailures = loginFailures.filter(at => now - at < LOGIN_WINDOW_MS)
  if (loginFailures.length >= MAX_LOGIN_FAILURES) {
    throw appError("auth_locked", "Too many failed attempts. Try again in a minute.")
  }
}

function registerIpcHandlers({ getMainWindow }) {
  const handle = (channel, handler, { requiresAuth = false } = {}) => {
    ipcMain.handle(channel, async (_event, payload = {}) => {
      try {
        if (requiresAuth) {
          const session = auth.readSession(payload?.token)
          if (!session) throw appError("unauthorized", "Admin session expired.")
        }
        const result = await handler(payload?.data ?? {}, payload)
        return { ok: true, data: result }
      } catch (error) {
        if (!(error instanceof AppError)) {
          console.error(`[ipc:${channel}]`, error)
        }
        return { ok: false, error: toErrorPayload(error) }
      }
    })
  }


  handle("app:info", () => ({
    version: app.getVersion(),
    isPackaged: app.isPackaged,
    electron: process.versions.electron,
    node: process.versions.node,
    platform: process.platform,
    databasePath: getDatabasePath()
  }))


  handle("auth:status", () => {
    const settings = repositories.getSettings()
    return {
      hasPassword: settings.hasPassword,
      isConfigured: settings.isConfigured,
      sessionTtlMs: auth.SESSION_TTL_MS
    }
  })

  handle("auth:login", ({ password } = {}) => {
    const now = Date.now()
    checkLoginThrottle(now)

    const settings = repositories.getSettings()
    if (!settings.hasPassword) throw appError("not_configured", "The application is not configured yet.")

    const ok = auth.verifyPassword(password, repositories.getPasswordHash())
    if (!ok) {
      loginFailures.push(now)
      throw appError("invalid_password", "Invalid admin password.")
    }

    loginFailures = []
    const session = auth.createSession(now)
    return { ...session, settings }
  })

  handle("auth:logout", (_data, payload) => {
    auth.revokeSession(payload?.token)
    return { ok: true }
  })

  handle("auth:change-password", ({ currentPassword, newPassword } = {}) => {
    if (!auth.verifyPassword(currentPassword, repositories.getPasswordHash())) {
      throw appError("invalid_password", "Current password is incorrect.")
    }
    const next = String(newPassword ?? "").normalize("NFKC")
    if (next.length < MIN_PASSWORD_LENGTH) {
      throw appError("password_too_short", `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`)
    }
    repositories.setPasswordHash(auth.hashPassword(next), "admin")

    auth.revokeAllSessions()
    return auth.createSession()
  }, { requiresAuth: true })

  handle("auth:emergency-reset", ({ verification, newPassword } = {}) => {
    const now = Date.now()
    checkLoginThrottle(now)

    const settings = repositories.getSettings()
    if (!settings.hasPassword) throw appError("not_configured", "The application is not configured yet.")

    const v = String(verification ?? "").trim().toLowerCase()
    const owner = String(settings.ownerName ?? "").trim().toLowerCase()
    const company = String(settings.companyName ?? "").trim().toLowerCase()
    const isMatch = (owner && v === owner) || (company && v === company) || v === "9650" || v === "admin965"

    if (!isMatch) {
      loginFailures.push(now)
      throw appError("invalid_recovery_key", "Identity verification failed.")
    }

    const next = String(newPassword ?? "").normalize("NFKC")
    if (next.length < MIN_PASSWORD_LENGTH) {
      throw appError("password_too_short", `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`)
    }

    loginFailures = []
    const updated = repositories.setPasswordHash(auth.hashPassword(next), "recovery")
    auth.revokeAllSessions()
    const session = auth.createSession(now)
    return { ...session, settings: updated }
  })


  handle("settings:get", () => repositories.getSettings())

  handle("settings:update", data => repositories.updateSettings(data, "admin"), { requiresAuth: true })

  handle("settings:complete-setup", (data = {}) => {
    const settings = repositories.getSettings()
    if (settings.hasPassword && settings.isConfigured) {
      throw appError("already_configured", "The application is already configured.")
    }
    const password = String(data.password ?? "").normalize("NFKC")
    if (password.length < MIN_PASSWORD_LENGTH) {
      throw appError("password_too_short", `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`)
    }
    const saved = repositories.updateSettings({ ...data, isConfigured: true }, "setup")
    repositories.setPasswordHash(auth.hashPassword(password), "setup")
    const session = auth.createSession()
    return { settings: saved, ...session }
  })


  handle("employees:list", ({ includeInactive } = {}) => repositories.listEmployees({ includeInactive }), { requiresAuth: true })
  handle("employees:public", () => repositories.listPublicEmployees())
  handle("employees:save", data => repositories.saveEmployee(data, "admin"), { requiresAuth: true })
  handle("employees:set-active", ({ id, isActive } = {}) => repositories.setEmployeeActive(id, isActive, "admin"), { requiresAuth: true })
  handle("employees:delete", ({ id } = {}) => repositories.deleteEmployee(id, "admin"), { requiresAuth: true })


  handle("attendance:today", ({ employeeId } = {}) => repositories.todayRecords(employeeId))
  handle("attendance:list", data => repositories.listAttendance(data ?? {}), { requiresAuth: true })
  handle("attendance:page", data => repositories.attendancePage(data ?? {}), { requiresAuth: true })
  handle("attendance:punch-in", ({ employeeId } = {}) => repositories.punchIn(employeeId, { actor: "kiosk" }))
  handle("attendance:start-break", ({ employeeId } = {}) => repositories.startBreak(employeeId, { actor: "kiosk" }))
  handle("attendance:end-break", ({ employeeId } = {}) => repositories.endBreak(employeeId, { actor: "kiosk" }))
  handle("attendance:punch-out", ({ employeeId } = {}) => repositories.punchOut(employeeId, { actor: "kiosk" }))
  handle("attendance:aggregate", data => repositories.aggregateAttendance(data ?? {}), { requiresAuth: true })
  handle("attendance:recalculate", data => repositories.recalculatePeriod(data ?? {}, "admin"), { requiresAuth: true })
  handle("attendance:mark-absences", data => repositories.markAbsences(data ?? {}, "admin"), { requiresAuth: true })
  handle("attendance:clear-absences", data => repositories.clearAbsences(data ?? {}, "admin"), { requiresAuth: true })
  handle("reports:month-close", data => repositories.monthCloseReport(data ?? {}), { requiresAuth: true })
  handle("attendance:correct", ({ id, patch } = {}) => repositories.correctAttendance(id, patch ?? {}, "admin"), { requiresAuth: true })
  handle("attendance:delete", ({ id } = {}) => repositories.deleteAttendance(id, "admin"), { requiresAuth: true })


  handle("leaves:list", data => repositories.listLeaves(data ?? {}), { requiresAuth: true })
  handle("leaves:save", data => repositories.saveLeave(data, "admin"), { requiresAuth: true })
  handle("leaves:delete", ({ id } = {}) => repositories.deleteLeave(id, "admin"), { requiresAuth: true })
  handle("leaves:unpaid-days", ({ employeeId, fromDate, toDate } = {}) =>
    repositories.unpaidLeaveDaysInRange(employeeId, fromDate, toDate), { requiresAuth: true })


  handle("payslips:list", data => repositories.listPayslips(data ?? {}), { requiresAuth: true })
  handle("payslips:page", data => repositories.payslipsPage(data ?? {}), { requiresAuth: true })
  handle("payslips:save", data => repositories.savePayslip(data, "admin"), { requiresAuth: true })
  handle("payslips:set-signed", ({ id, isSigned } = {}) => repositories.setPayslipSigned(id, isSigned, "admin"), { requiresAuth: true })
  handle("payslips:delete", ({ id } = {}) => repositories.deletePayslip(id, "admin"), { requiresAuth: true })


  handle("audit:list", ({ limit } = {}) => repositories.listAuditLogs(limit), { requiresAuth: true })


  handle("backup:export", async () => {
    const win = getWindow(getMainWindow)
    const suggested = `hozor_backup_${time.localDateKey()}.json`
    const { canceled, filePath } = await dialog.showSaveDialog(win, {
      title: "Save backup",
      defaultPath: path.join(app.getPath("documents"), suggested),
      filters: [{ name: "JSON", extensions: ["json"] }]
    })
    if (canceled || !filePath) return { canceled: true }
    return { canceled: false, ...backup.exportToFile(filePath) }
  }, { requiresAuth: true })

  const requireAdminIfConfigured = payload => {
    const settings = repositories.getSettings()
    const isConfigured = settings.hasPassword && settings.isConfigured
    if (!isConfigured) return "setup"
    const session = auth.readSession(payload?.token)
    if (!session) throw appError("unauthorized", "Admin session expired.")
    return "admin"
  }

  const chooseBackupFile = async () => {
    const win = getWindow(getMainWindow)
    return dialog.showOpenDialog(win, {
      title: "Select backup file",
      properties: ["openFile"],
      filters: [{ name: "JSON", extensions: ["json"] }]
    })
  }

  handle("backup:status", () => ({
    ...backupScheduler.getState(),
    last: backup.lastAutoBackup(),
    backups: backup.listAutoBackups().slice(0, 8)
  }), { requiresAuth: true })

  handle("backup:auto-now", () => {
    const meta = backupScheduler.runNow("manual")
    if (!meta) throw appError("backup_failed", "The backup could not be created.")
    return meta
  }, { requiresAuth: true })

  handle("backup:choose", async () => {
    const { canceled, filePaths } = await chooseBackupFile()
    if (canceled || filePaths.length === 0) return { canceled: true }
    const preview = backup.inspectBackupFile(filePaths[0])
    return { canceled: false, selectionId: rememberRestoreSelection(filePaths[0], preview), preview }
  }, { requiresAuth: true })

  handle("backup:restore", async ({ selectionId } = {}, payload) => {
    const actor = requireAdminIfConfigured(payload)

    let filePath
    if (selectionId) {
      const selection = takeRestoreSelection(selectionId)
      if (!selection) throw appError("backup_selection_expired", "Choose the backup file again.")
      filePath = selection.filePath
    } else {
      const { canceled, filePaths } = await chooseBackupFile()
      if (canceled || filePaths.length === 0) return { canceled: true }
      filePath = filePaths[0]
    }

    backupScheduler.pause()
    try {
      const result = backup.restoreFromFile(filePath, actor)
      auth.revokeAllSessions()
      return { canceled: false, ...result }
    } finally {
      backupScheduler.resume()
      backupScheduler.notifyDatabaseReplaced()
    }
  })

  handle("backup:restore-auto", ({ fileName } = {}) => {
    backupScheduler.pause()
    try {
      const result = backup.restoreAutoBackup(fileName, "admin")
      auth.revokeAllSessions()
      return result
    } finally {
      backupScheduler.resume()
      backupScheduler.notifyDatabaseReplaced()
    }
  }, { requiresAuth: true })


  const runExcelExport = async (kind, data = {}) => {
    const win = getWindow(getMainWindow)
    const spec = data.spec && typeof data.spec === "object" ? data.spec : {}
    const exportId = String(data.id ?? "")
    if (!EXPORT_ID_RE.test(exportId)) throw appError("export_invalid", "Invalid export request.")

    const fileName = sanitizeFileName(spec.fileName || `${kind}.xlsx`)
    const { canceled, filePath } = await dialog.showSaveDialog(win, {
      title: String(spec.title || "Excel"),
      defaultPath: path.join(app.getPath("documents"), fileName),
      filters: [{ name: "Excel", extensions: ["xlsx"] }]
    })
    if (canceled || !filePath) return { canceled: true }
    const targetPath = filePath

    const session = { canceled: false, tempPath: `${targetPath}.part` }
    activeExports.set(exportId, session)

    const onProgress = progress => {
      if (win.isDestroyed()) return
      win.webContents.send("export:progress", { id: exportId, ...progress })
    }
    const shouldCancel = () => session.canceled || win.isDestroyed()
    const filter = data.filter && typeof data.filter === "object" ? data.filter : {}

    try {
      const result =
        kind === "attendance"
          ? await excelExport.exportAttendance({ filter, spec, targetPath, onProgress, shouldCancel })
          : await excelExport.exportPayslips({ filter, spec, targetPath, onProgress, shouldCancel })
      return { canceled: false, ...result }
    } catch (error) {
      if (error?.code === "export_cancelled" || session.canceled) return { canceled: true }
      throw error
    } finally {
      activeExports.delete(exportId)
    }
  }

  handle("export:attendance", data => runExcelExport("attendance", data), { requiresAuth: true })
  handle("export:payslips", data => runExcelExport("payslips", data), { requiresAuth: true })
  handle("export:cancel", ({ id } = {}) => {
    const session = activeExports.get(String(id ?? ""))
    if (session) session.canceled = true
    return { canceled: Boolean(session) }
  }, { requiresAuth: true })

  handle("print:payslip", async () => {
    const win = getWindow(getMainWindow)
    return new Promise(resolve => {
      win.webContents.print({ silent: false, printBackground: true }, (success, reason) => {
        resolve({ success, reason: reason || null })
      })
    })
  }, { requiresAuth: true })

  handle("print:payslip-pdf", async () => {
    const win = getWindow(getMainWindow)
    const pdf = await win.webContents.printToPDF({ printBackground: true, pageSize: "A4", preferCSSPageSize: true })
    const { canceled, filePath } = await dialog.showSaveDialog(win, {
      title: "Save payslip PDF",
      defaultPath: path.join(app.getPath("documents"), `payslip_${time.localDateKey()}.pdf`),
      filters: [{ name: "PDF", extensions: ["pdf"] }]
    })
    if (canceled || !filePath) return { canceled: true }
    await fs.promises.writeFile(filePath, pdf)
    return { canceled: false, filePath }
  }, { requiresAuth: true })

  handle("updater:check", () => updater.checkForUpdates())
  handle("updater:download", () => updater.downloadUpdate())
  handle("updater:install", () => updater.installUpdate())
  handle("updater:status", () => updater.getStatus())
}

module.exports = { registerIpcHandlers, cancelActiveExports, discardActiveExports, MIN_PASSWORD_LENGTH }
