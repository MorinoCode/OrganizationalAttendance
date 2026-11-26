import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import exportJournal from "../src/main/exportJournal.cjs"

let baseDir: string

beforeEach(() => {
  baseDir = fs.mkdtempSync(path.join(os.tmpdir(), "hozor-export-journal-"))
})

afterEach(() => {
  fs.rmSync(baseDir, { recursive: true, force: true })
})

describe("export journal", () => {
  it("tracks and untracks the partial workbook before and after an export", () => {
    const tempPath = path.join(baseDir, "report.xlsx.part")
    exportJournal.track(baseDir, tempPath)

    const journal = JSON.parse(fs.readFileSync(exportJournal.journalPath(baseDir), "utf8"))
    expect(journal).toHaveLength(1)
    expect(journal[0].path).toBe(tempPath)

    exportJournal.track(baseDir, tempPath)
    expect(JSON.parse(fs.readFileSync(exportJournal.journalPath(baseDir), "utf8"))).toHaveLength(1)

    exportJournal.untrack(baseDir, tempPath)
    expect(fs.existsSync(exportJournal.journalPath(baseDir))).toBe(false)
  })

  it("removes partial workbooks left behind by a hard kill and logs each removal", () => {
    const orphan = path.join(baseDir, "attendance.xlsx.part")
    const missing = path.join(baseDir, "gone.xlsx.part")
    fs.writeFileSync(orphan, "partial")
    exportJournal.track(baseDir, orphan)
    exportJournal.track(baseDir, missing)

    const log = vi.fn()
    const removed = exportJournal.sweep(baseDir, { log })

    expect(removed).toEqual([orphan])
    expect(fs.existsSync(orphan)).toBe(false)
    expect(fs.existsSync(exportJournal.journalPath(baseDir))).toBe(false)
    expect(log.mock.calls.some(([message]) => String(message).includes(orphan))).toBe(true)
  })

  it("is a no-op when no journal exists", () => {
    const log = vi.fn()
    expect(exportJournal.sweep(baseDir, { log })).toEqual([])
    expect(log).not.toHaveBeenCalled()
    expect(fs.existsSync(exportJournal.journalPath(baseDir))).toBe(false)
  })
})
