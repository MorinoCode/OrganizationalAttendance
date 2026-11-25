"use strict"


const backup = require("./backup.cjs")
const { getTotalChanges } = require("./db/index.cjs")
const { toErrorPayload } = require("./lib/errors.cjs")

const TICK_MS = 30 * 1000
const QUIT_MIN_GAP_MS = 10 * 60 * 1000

let timer = null
let running = false
let paused = false
let quitting = false
let baselineChanges = 0

function totalChanges() {
  try {
    return getTotalChanges()
  } catch {
    return 0
  }
}

function lastBackup() {
  try {
    return backup.lastAutoBackup()
  } catch {
    return null
  }
}

function msSinceLastBackup(now = Date.now()) {
  const last = lastBackup()
  if (!last) return Number.POSITIVE_INFINITY
  const at = Date.parse(last.createdAt)
  return Number.isFinite(at) ? Math.max(0, now - at) : Number.POSITIVE_INFINITY
}

function changesSinceBackup() {
  const last = lastBackup()
  if (!last) return totalChanges()
  return Math.max(0, totalChanges() - baselineChanges)
}

function runNow(reason = "manual") {
  if (running) return null
  running = true
  try {
    const meta = backup.createAutoBackup({ reason })
    baselineChanges = totalChanges()
    return meta
  } catch (error) {
    console.error("[backup] scheduled backup failed:", toErrorPayload(error))
    return null
  } finally {
    running = false
  }
}

function tick() {
  if (paused || running) return
  const now = Date.now()
  const gap = msSinceLastBackup(now)
  const changes = changesSinceBackup()

  if (!Number.isFinite(gap)) {
    runNow("interval")
    return
  }
  if (gap >= backup.AUTO_BACKUP_INTERVAL_MS && changes > 0) {
    runNow("interval")
    return
  }
  if (changes >= backup.AUTO_BACKUP_CHANGE_THRESHOLD && gap >= QUIT_MIN_GAP_MS) {
    runNow("change")
  }
}

function start() {
  if (timer) return
  baselineChanges = totalChanges()
  timer = setInterval(tick, TICK_MS)
  if (typeof timer.unref === "function") timer.unref()
  const firstRun = setTimeout(tick, 20 * 1000)
  if (typeof firstRun.unref === "function") firstRun.unref()
}

function stop() {
  if (!timer) return
  clearInterval(timer)
  timer = null
}

function pause() {
  paused = true
}

function resume() {
  paused = false
}

function notifyDatabaseReplaced() {
  baselineChanges = totalChanges()
}

function onQuit() {
  if (quitting) return
  quitting = true
  stop()
  if (paused) return
  const gap = msSinceLastBackup()
  if (!Number.isFinite(gap) || gap >= QUIT_MIN_GAP_MS || changesSinceBackup() > 0) {
    runNow("quit")
  }
}

function getState() {
  return {
    directory: (() => {
      try {
        return backup.autoBackupDirectory()
      } catch {
        return null
      }
    })(),
    keep: backup.AUTO_BACKUP_KEEP,
    intervalMinutes: Math.round(backup.AUTO_BACKUP_INTERVAL_MS / 60000),
    changeThreshold: backup.AUTO_BACKUP_CHANGE_THRESHOLD,
    changesSinceLastBackup: changesSinceBackup()
  }
}

module.exports = { start, stop, pause, resume, tick, runNow, onQuit, notifyDatabaseReplaced, getState }
