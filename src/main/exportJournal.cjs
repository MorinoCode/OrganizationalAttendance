"use strict"

const fs = require("node:fs")
const path = require("node:path")

const JOURNAL_FILE = "pending-exports.json"

function journalPath(baseDir) {
  return path.join(baseDir, JOURNAL_FILE)
}

function readEntries(baseDir) {
  try {
    const raw = fs.readFileSync(journalPath(baseDir), "utf8")
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed.filter(entry => entry && typeof entry.path === "string") : []
  } catch {
    return []
  }
}

function writeEntries(baseDir, entries) {
  const file = journalPath(baseDir)
  const temp = `${file}.tmp`
  try {
    if (entries.length === 0) {
      fs.rmSync(file, { force: true })
      return
    }
    fs.writeFileSync(temp, JSON.stringify(entries))
    fs.renameSync(temp, file)
  } catch (error) {
    console.error("[export] could not update the pending export journal:", error?.message ?? error)
    try {
      fs.rmSync(temp, { force: true })
    } catch {
    }
  }
}

function track(baseDir, tempPath) {
  if (!baseDir || !tempPath) return
  const entries = readEntries(baseDir).filter(entry => entry.path !== tempPath)
  entries.push({ path: tempPath, startedAt: new Date().toISOString() })
  writeEntries(baseDir, entries)
}

function untrack(baseDir, tempPath) {
  if (!baseDir || !tempPath) return
  const entries = readEntries(baseDir).filter(entry => entry.path !== tempPath)
  writeEntries(baseDir, entries)
}

function sweep(baseDir, { log = console.log } = {}) {
  const file = journalPath(baseDir)
  if (!fs.existsSync(file)) return []
  const entries = readEntries(baseDir)
  const removed = []
  for (const entry of entries) {
    try {
      if (fs.existsSync(entry.path)) {
        fs.rmSync(entry.path, { force: true })
        removed.push(entry.path)
        log(`[export] removed stale partial export left by an earlier run: ${entry.path}`)
      }
    } catch (error) {
      console.error("[export] could not remove a stale partial export:", entry.path, error?.message ?? error)
    }
  }
  try {
    fs.rmSync(file, { force: true })
  } catch {
  }
  if (removed.length === 0) log("[export] startup sweep found no stale partial exports")
  return removed
}

module.exports = { track, untrack, sweep, journalPath }
