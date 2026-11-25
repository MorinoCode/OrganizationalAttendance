import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { createRequire } from "node:module"
import { afterEach, describe, expect, it } from "vitest"

const require = createRequire(import.meta.url)
const database = require("../src/main/db/index.cjs") as {
  initDatabaseFromFile: (filePath: string) => unknown
  closeDatabase: () => void
}
const repositories = require("../src/main/db/repositories.cjs")
const backup = require("../src/main/backup.cjs")
const scheduler = require("../src/main/backupScheduler.cjs")

function freshDatabase(): { dir: string; file: string } {
  database.closeDatabase()
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "hozor-backup-"))
  const file = path.join(dir, "hozor_ghiab.db")
  database.initDatabaseFromFile(file)
  return { dir, file }
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

afterEach(() => {
  database.closeDatabase()
})

describe("automatic backups", () => {
  it("writes a verified copy with metadata and reports it as the last healthy copy", () => {
    const { dir, file } = freshDatabase()
    seedEmployee()

    const meta = backup.createAutoBackup({ reason: "interval" })

    expect(meta).toBeTruthy()
    expect(meta.reason).toBe("interval")
    expect(meta.verified).toBe(true)
    expect(meta.counts.employees).toBe(1)
    expect(meta.path).toBe(path.join(dir, "backups", meta.fileName))
    expect(fs.existsSync(meta.path)).toBe(true)
    expect(fs.statSync(meta.path).size).toBeGreaterThan(0)
    expect(fs.existsSync(file)).toBe(true)
    expect(fs.existsSync(`${meta.path}-wal`)).toBe(false)
    expect(fs.existsSync(`${meta.path}-shm`)).toBe(false)

    const list = backup.listAutoBackups()
    expect(list).toHaveLength(1)
    expect(list[0].fileName).toBe(meta.fileName)
    expect(list[0].verified).toBe(true)
    expect(backup.lastAutoBackup()?.fileName).toBe(meta.fileName)
  })

  it("keeps only the newest copies when pruning", () => {
    freshDatabase()
    seedEmployee()

    backup.createAutoBackup({ reason: "manual" })
    backup.createAutoBackup({ reason: "manual" })
    backup.createAutoBackup({ reason: "manual" })
    expect(backup.listAutoBackups()).toHaveLength(3)

    const removed = backup.pruneAutoBackups(2)
    expect(removed).toBe(1)
    const remaining = backup.listAutoBackups()
    expect(remaining).toHaveLength(2)
    for (const entry of remaining) {
      expect(entry.fileName).toMatch(/^hozor_ghiab_\d{4}-\d{2}-\d{2}_\d{6}(-\d+)?\.db$/)
      expect(fs.existsSync(entry.path)).toBe(true)
    }
  })

  it("previews an exported file and rejects a broken one", () => {
    const { dir } = freshDatabase()
    seedEmployee()
    const exportPath = path.join(dir, "export.json")

    backup.exportToFile(exportPath)
    const preview = backup.inspectBackupFile(exportPath)
    expect(preview.counts).toEqual({ employees: 1, attendance: 0, leaves: 0, payslips: 0 })
    expect(preview.exportedAt).toBeTruthy()
    expect(preview.schemaVersion).toBeGreaterThanOrEqual(3)
    expect(preview.fileName).toBe("export.json")

    const brokenPath = path.join(dir, "broken.json")
    fs.writeFileSync(brokenPath, "not json", "utf8")
    expectCode(() => backup.inspectBackupFile(brokenPath), "backup_invalid")
    expectCode(() => backup.inspectBackupFile(path.join(dir, "missing.json")), "backup_not_found")
  })

  it("takes a snapshot before restoring an exported file", () => {
    const { dir } = freshDatabase()
    seedEmployee()
    const exportPath = path.join(dir, "export.json")
    backup.exportToFile(exportPath)

    seedEmployee({ fullName: "Second Person", employeeCode: "KW-101" })
    expect(repositories.listEmployees()).toHaveLength(2)

    const result = backup.restoreFromFile(exportPath, "admin")

    expect(result.restored).toBe(true)
    expect(result.snapshot?.reason).toBe("pre-restore")
    expect(fs.existsSync(result.snapshot.path)).toBe(true)
    expect(repositories.listEmployees().map((employee: { fullName: string }) => employee.fullName)).toEqual(["Ali Hassan"])

    const [latest] = repositories.listAuditLogs(1)
    expect(latest.entity).toBe("database")
    expect(latest.action).toBe("restored")
  })

  it("restores a database copy, snapshots the current state and keeps working afterwards", () => {
    freshDatabase()
    seedEmployee()
    const meta = backup.createAutoBackup({ reason: "manual" })

    seedEmployee({ fullName: "Second Person", employeeCode: "KW-101" })
    expect(repositories.listEmployees()).toHaveLength(2)

    const result = backup.restoreAutoBackup(meta.fileName, "admin")

    expect(result.restored).toBe(true)
    expect(result.source).toBe("auto-backup")
    expect(result.snapshot?.reason).toBe("pre-restore")
    expect(result.snapshot?.fileName).not.toBe(meta.fileName)
    expect(repositories.listEmployees().map((employee: { fullName: string }) => employee.fullName)).toEqual(["Ali Hassan"])

    const [latest] = repositories.listAuditLogs(1)
    expect(latest.action).toBe("restored")
    expect(JSON.parse(latest.details).source).toBe("auto-backup")

    seedEmployee({ fullName: "Third Person", employeeCode: "KW-102" })
    expect(repositories.listEmployees()).toHaveLength(2)
  })

  it("refuses a damaged copy and an unknown file name", () => {
    freshDatabase()
    seedEmployee()
    const meta = backup.createAutoBackup({ reason: "manual" })
    fs.writeFileSync(meta.path, "garbage", "utf8")

    expectCode(() => backup.restoreAutoBackup(meta.fileName, "admin"), "backup_corrupt")
    expectCode(() => backup.restoreAutoBackup("../hozor_ghiab.db", "admin"), "backup_not_found")
  })

  it("exposes scheduler state and creates a manual copy on demand", () => {
    freshDatabase()
    seedEmployee()

    const state = scheduler.getState()
    expect(state.keep).toBe(30)
    expect(state.intervalMinutes).toBe(60)
    expect(state.changeThreshold).toBe(25)
    expect(state.changesSinceLastBackup).toBeGreaterThan(0)

    const meta = scheduler.runNow("manual")
    expect(meta?.reason).toBe("manual")
    expect(backup.lastAutoBackup()?.fileName).toBe(meta.fileName)
    expect(scheduler.getState().changesSinceLastBackup).toBe(0)
  })
})
