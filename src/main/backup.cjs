"use strict"


const fs = require("node:fs")
const path = require("node:path")
const { DatabaseSync } = require("node:sqlite")
const { appError } = require("./lib/errors.cjs")
const { SCHEMA_VERSION } = require("./db/schema.cjs")
const { getDb, getDatabasePath, replaceDatabaseFrom } = require("./db/index.cjs")
const repositories = require("./db/repositories.cjs")
const time = require("./lib/time.cjs")

const BACKUP_APP_ID = "hozor-ghiab"
const BACKUP_FORMAT_VERSION = 1
const AUTO_BACKUP_DIR = "backups"
const AUTO_BACKUP_KEEP = 30
const AUTO_BACKUP_INTERVAL_MS = 60 * 60 * 1000
const AUTO_BACKUP_CHANGE_THRESHOLD = 25

const BACKUP_REASONS = ["quit", "interval", "change", "manual", "pre-restore"]

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/
const AUTO_BACKUP_NAME_RE = /^[A-Za-z0-9._-]+\.db$/

function buildBackup() {
  return {
    app: BACKUP_APP_ID,
    formatVersion: BACKUP_FORMAT_VERSION,
    schemaVersion: SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    data: repositories.exportAll()
  }
}

function assertArray(value, name) {
  if (!Array.isArray(value)) throw appError("backup_invalid", `Backup is missing "${name}".`)
  return value
}

function assertDateValue(value, name) {
  if (typeof value !== "string" || !DATE_RE.test(value)) {
    throw appError("backup_invalid", `Backup contains an invalid date in "${name}".`)
  }
  return value
}

function validateBackup(payload) {
  if (!payload || typeof payload !== "object") throw appError("backup_invalid", "Backup file is not an object.")
  if (payload.app !== BACKUP_APP_ID) throw appError("backup_invalid", "Backup file belongs to another application.")
  if (Number(payload.formatVersion) > BACKUP_FORMAT_VERSION) {
    throw appError("backup_newer_version", "Backup was created by a newer version of the application.")
  }

  const data = payload.data
  if (!data || typeof data !== "object") throw appError("backup_invalid", "Backup has no data section.")

  const employees = assertArray(data.employees, "employees")
  const attendance = assertArray(data.attendance, "attendance")
  const leaves = assertArray(data.leaves, "leaves")
  const payslips = assertArray(data.payslips, "payslips")

  const employeeIds = new Set()
  for (const employee of employees) {
    if (!employee?.id || !employee?.fullName || !employee?.employeeCode) {
      throw appError("backup_invalid", "Backup contains an invalid employee.")
    }
    employeeIds.add(employee.id)
  }

  for (const record of attendance) {
    if (!record?.id || !record?.employeeId || !employeeIds.has(record.employeeId)) {
      throw appError("backup_invalid", "Backup contains an attendance record without a valid employee.")
    }
    assertDateValue(record.recordDate, "attendance.recordDate")
  }

  for (const leave of leaves) {
    if (!leave?.id || !leave?.employeeId || !employeeIds.has(leave.employeeId)) {
      throw appError("backup_invalid", "Backup contains a leave record without a valid employee.")
    }
    assertDateValue(leave.startDate, "leaves.startDate")
    assertDateValue(leave.endDate, "leaves.endDate")
    if (leave.endDate < leave.startDate) throw appError("backup_invalid", "Backup contains a leave with an invalid range.")
  }

  const numbers = new Set()
  for (const payslip of payslips) {
    if (!payslip?.id || !payslip?.number || !payslip?.employeeName) {
      throw appError("backup_invalid", "Backup contains an invalid payslip.")
    }
    if (numbers.has(payslip.number)) throw appError("backup_invalid", "Backup contains duplicated payslip numbers.")
    numbers.add(payslip.number)
    assertDateValue(payslip.periodStart, "payslips.periodStart")
    assertDateValue(payslip.periodEnd, "payslips.periodEnd")
  }

  return {
    settings: data.settings ?? {},
    employees,
    attendance,
    leaves,
    payslips
  }
}

function parseBackupPayload(text) {
  let payload
  try {
    payload = JSON.parse(text)
  } catch {
    throw appError("backup_invalid", "Backup file is not valid JSON.")
  }
  return { payload, data: validateBackup(payload) }
}

function parseBackup(text) {
  return parseBackupPayload(text).data
}

function writeJsonAtomically(filePath, payload) {
  const tempPath = `${filePath}.tmp`
  fs.writeFileSync(tempPath, JSON.stringify(payload, null, 2), "utf8")
  fs.renameSync(tempPath, filePath)
}

function readJsonFile(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"))
  } catch {
    return null
  }
}

function exportToFile(filePath) {
  writeJsonAtomically(filePath, buildBackup())
  return { filePath, exportedAt: new Date().toISOString() }
}

function summarizeBackup(filePath, payload, data) {
  const dates = data.attendance.map(record => record.recordDate).sort()
  return {
    fileName: path.basename(filePath),
    exportedAt: typeof payload.exportedAt === "string" ? payload.exportedAt : null,
    schemaVersion: Number(payload.schemaVersion ?? 0),
    formatVersion: Number(payload.formatVersion ?? 0),
    counts: {
      employees: data.employees.length,
      attendance: data.attendance.length,
      leaves: data.leaves.length,
      payslips: data.payslips.length
    },
    attendanceFrom: dates[0] ?? null,
    attendanceTo: dates[dates.length - 1] ?? null
  }
}

function inspectBackupFile(filePath) {
  let text
  try {
    text = fs.readFileSync(filePath, "utf8")
  } catch {
    throw appError("backup_not_found", "The selected file could not be read.")
  }
  const { payload, data } = parseBackupPayload(text)
  return summarizeBackup(filePath, payload, data)
}

function readBackupFile(filePath) {
  let text
  try {
    text = fs.readFileSync(filePath, "utf8")
  } catch {
    throw appError("backup_not_found", "The selected file could not be read.")
  }
  return parseBackup(text)
}

function autoBackupDirectory() {
  return path.join(path.dirname(getDatabasePath() || "."), AUTO_BACKUP_DIR)
}

function autoBackupMetaPath(fileName) {
  return path.join(autoBackupDirectory(), `${fileName}.json`)
}

function autoBackupPath(fileName) {
  if (typeof fileName !== "string" || !AUTO_BACKUP_NAME_RE.test(fileName)) {
    throw appError("backup_not_found", "That backup copy does not exist.")
  }
  const directory = autoBackupDirectory()
  const fullPath = path.join(directory, fileName)
  if (path.resolve(path.dirname(fullPath)) !== path.resolve(directory) || !fs.existsSync(fullPath)) {
    throw appError("backup_not_found", "That backup copy does not exist.")
  }
  return fullPath
}

function removeSidecars(filePath) {
  for (const suffix of ["-wal", "-shm"]) {
    try {
      fs.rmSync(`${filePath}${suffix}`, { force: true })
    } catch {
    }
  }
}

function verifyDatabaseFile(filePath) {
  let handle = null
  try {
    handle = new DatabaseSync(filePath, { readOnly: true })
    const row = handle.prepare("PRAGMA quick_check").get()
    const detail = row ? Object.values(row)[0] : null
    return { ok: detail === "ok", detail: detail ?? null }
  } catch (error) {
    return { ok: false, detail: error instanceof Error ? error.message : String(error) }
  } finally {
    try {
      handle?.close()
    } catch {
    }
    removeSidecars(filePath)
  }
}

function readBackupMeta(fileName) {
  const meta = readJsonFile(autoBackupMetaPath(fileName))
  return meta && typeof meta === "object" ? meta : null
}

function normalizeAutoBackup(fileName, stat) {
  const meta = readBackupMeta(fileName)
  return {
    fileName,
    path: path.join(autoBackupDirectory(), fileName),
    createdAt: typeof meta?.createdAt === "string" ? meta.createdAt : stat.mtime.toISOString(),
    reason: BACKUP_REASONS.includes(meta?.reason) ? meta.reason : "interval",
    sizeBytes: Number.isFinite(meta?.sizeBytes) ? Number(meta.sizeBytes) : Number(stat.size),
    verified: typeof meta?.verified === "boolean" ? meta.verified : null,
    schemaVersion: Number.isFinite(meta?.schemaVersion) ? Number(meta.schemaVersion) : null,
    counts: meta?.counts && typeof meta.counts === "object" ? meta.counts : null
  }
}

function listAutoBackups() {
  const dbPath = getDatabasePath()
  if (!dbPath) return []
  const directory = autoBackupDirectory()
  let names = []
  try {
    names = fs.readdirSync(directory).filter(name => name.startsWith("hozor_ghiab_") && name.endsWith(".db"))
  } catch {
    return []
  }
  const entries = []
  for (const name of names) {
    try {
      const stat = fs.statSync(path.join(directory, name))
      if (!stat.isFile()) continue
      entries.push(normalizeAutoBackup(name, stat))
    } catch {
    }
  }
  return entries.sort((a, b) => (a.fileName < b.fileName ? 1 : a.fileName > b.fileName ? -1 : 0))
}

function lastAutoBackup() {
  return listAutoBackups()[0] ?? null
}

function pruneAutoBackups(keep = AUTO_BACKUP_KEEP) {
  const limit = Math.max(1, Number(keep) || AUTO_BACKUP_KEEP)
  const entries = listAutoBackups()
  const stale = entries.slice(limit)
  for (const entry of stale) {
    try {
      fs.unlinkSync(entry.path)
    } catch {
    }
    removeSidecars(entry.path)
    try {
      fs.unlinkSync(autoBackupMetaPath(entry.fileName))
    } catch {
    }
  }
  return stale.length
}

function nextAutoBackupName(stamp) {
  const base = `hozor_ghiab_${time.localDateKey(stamp)}_${String(stamp.getHours()).padStart(2, "0")}${String(stamp.getMinutes()).padStart(2, "0")}${String(stamp.getSeconds()).padStart(2, "0")}`
  const directory = autoBackupDirectory()
  let candidate = `${base}.db`
  let suffix = 1
  while (fs.existsSync(path.join(directory, candidate))) {
    candidate = `${base}-${suffix}.db`
    suffix += 1
  }
  return candidate
}

function createAutoBackup({ reason = "interval" } = {}) {
  const dbPath = getDatabasePath()
  if (!dbPath || dbPath === ":memory:" || !fs.existsSync(dbPath)) return null

  try {
    getDb().exec("PRAGMA wal_checkpoint(TRUNCATE)")
  } catch {
  }

  const directory = autoBackupDirectory()
  fs.mkdirSync(directory, { recursive: true })

  const stamp = new Date()
  const fileName = nextAutoBackupName(stamp)
  const target = path.join(directory, fileName)
  const tempPath = `${target}.tmp`

  fs.copyFileSync(dbPath, tempPath)
  fs.renameSync(tempPath, target)

  const verification = verifyDatabaseFile(target)
  let counts = null
  try {
    counts = repositories.dataCounts()
  } catch {
  }
  const stat = fs.statSync(target)
  const meta = {
    fileName,
    createdAt: stamp.toISOString(),
    reason: BACKUP_REASONS.includes(reason) ? reason : "interval",
    sizeBytes: stat.size,
    schemaVersion: SCHEMA_VERSION,
    verified: verification.ok,
    verificationDetail: verification.ok ? null : verification.detail,
    counts
  }

  try {
    writeJsonAtomically(autoBackupMetaPath(fileName), meta)
  } catch {
  }

  pruneAutoBackups()

  return { ...meta, path: target }
}

function restoreFromFile(filePath, actor, { snapshot = true } = {}) {
  const data = readBackupFile(filePath)
  const snapshotMeta = snapshot ? createAutoBackup({ reason: "pre-restore" }) : null
  repositories.importAll(data, actor || "admin")
  return { restored: true, source: "file", snapshot: snapshotMeta }
}

function restoreAutoBackup(fileName, actor) {
  const filePath = autoBackupPath(fileName)
  const verification = verifyDatabaseFile(filePath)
  if (!verification.ok) {
    throw appError("backup_corrupt", "This backup copy is damaged and cannot be restored.")
  }

  const snapshot = createAutoBackup({ reason: "pre-restore" })
  replaceDatabaseFrom(filePath)
  repositories.logDatabaseRestore(actor || "admin", { source: "auto-backup", fileName })

  return { restored: true, source: "auto-backup", fileName, snapshot }
}

module.exports = {
  BACKUP_APP_ID,
  BACKUP_FORMAT_VERSION,
  AUTO_BACKUP_KEEP,
  AUTO_BACKUP_INTERVAL_MS,
  AUTO_BACKUP_CHANGE_THRESHOLD,
  buildBackup,
  validateBackup,
  exportToFile,
  inspectBackupFile,
  restoreFromFile,
  restoreAutoBackup,
  createAutoBackup,
  listAutoBackups,
  lastAutoBackup,
  pruneAutoBackups,
  verifyDatabaseFile,
  autoBackupDirectory,
  autoBackupPath
}
