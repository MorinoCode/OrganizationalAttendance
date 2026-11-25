"use strict"

const time = require("./time.cjs")

const MAX_MINUTES_IN_DAY = 24 * 60
const WEEKDAY_COUNT = 7
const MAX_PERIOD_DAYS = 400

const pad2 = value => String(value).padStart(2, "0")


function timeToMinutes(value) {
  if (typeof value === "number") {
    if (!Number.isFinite(value)) return null
    const rounded = Math.round(value)
    return rounded >= 0 && rounded < MAX_MINUTES_IN_DAY ? rounded : null
  }
  const match = /^(\d{1,2}):(\d{2})$/.exec(String(value ?? "").trim())
  if (!match) return null
  const hours = Number(match[1])
  const minutes = Number(match[2])
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return null
  return hours * 60 + minutes
}

function minutesToTime(minutes) {
  const total = Math.round(Number(minutes) || 0)
  const normalized = ((total % MAX_MINUTES_IN_DAY) + MAX_MINUTES_IN_DAY) % MAX_MINUTES_IN_DAY
  return `${pad2(Math.floor(normalized / 60))}:${pad2(normalized % 60)}`
}


function parseWorkDays(value) {
  const list = Array.isArray(value) ? value : String(value ?? "").split(",")
  const days = new Set()
  for (const entry of list) {
    if (entry === "" || entry === null || entry === undefined) continue
    const day = Number(entry)
    if (!Number.isInteger(day) || day < 0 || day >= WEEKDAY_COUNT) return null
    days.add(day)
  }
  if (days.size === 0) return null
  return [...days].sort((a, b) => a - b)
}

function isWorkingDay(dateKey, workDays) {
  const parts = time.parseDateKey(dateKey)
  if (!parts) return false
  const days = parseWorkDays(workDays)
  if (!days) return false
  const [year, monthIndex, day] = parts
  return days.includes(new Date(year, monthIndex, day).getDay())
}


function workingDayKeys(startKey, endKey, workDays) {
  const days = parseWorkDays(workDays)
  if (!days) return []
  const start = time.startOfLocalDay(startKey)
  const end = time.startOfLocalDay(endKey)
  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) return []

  const keys = []
  let cursor = start
  for (let guard = 0; cursor <= end && guard < MAX_PERIOD_DAYS; guard += 1) {
    const date = new Date(cursor)
    if (days.includes(date.getDay())) {
      keys.push(`${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`)
    }
    cursor += time.DAY_MS
  }
  return keys
}

function minutesOfLocalDay(epochMs) {
  const date = new Date(epochMs)
  return date.getHours() * 60 + date.getMinutes()
}


function lateMinutesFor({ punchInAt, recordDate, shiftStartMinutes, graceMinutes = 0 }) {
  if (!Number.isFinite(punchInAt)) return 0
  const start = timeToMinutes(shiftStartMinutes)
  if (start === null) return 0
  const dateKey = recordDate || time.localDateKey(punchInAt)
  if (time.localDateKey(punchInAt) !== dateKey) return 0
  const grace = Math.max(0, Math.round(Number(graceMinutes) || 0))
  return Math.max(0, minutesOfLocalDay(punchInAt) - (start + grace))
}


function earlyLeaveMinutesFor({ punchOutAt, recordDate, shiftEndMinutes, graceMinutes = 0 }) {
  if (!Number.isFinite(punchOutAt)) return 0
  const end = timeToMinutes(shiftEndMinutes)
  if (end === null) return 0
  const dateKey = recordDate || time.localDateKey(punchOutAt)
  if (time.localDateKey(punchOutAt) !== dateKey) return 0
  const grace = Math.max(0, Math.round(Number(graceMinutes) || 0))
  return Math.max(0, (end - grace) - minutesOfLocalDay(punchOutAt))
}

module.exports = {
  MAX_MINUTES_IN_DAY,
  WEEKDAY_COUNT,
  timeToMinutes,
  minutesToTime,
  parseWorkDays,
  isWorkingDay,
  workingDayKeys,
  lateMinutesFor,
  earlyLeaveMinutesFor
}
