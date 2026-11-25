"use strict"

const MINUTE_MS = 60 * 1000
const DAY_MS = 24 * 60 * 60 * 1000

const pad2 = value => String(value).padStart(2, "0")

function localDateKey(input = Date.now()) {
  const date = input instanceof Date ? input : new Date(input)
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`
}

function parseDateKey(dateKey) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(dateKey ?? ""))
  if (!match) return null
  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  if (month < 1 || month > 12 || day < 1 || day > 31) return null
  return [year, month - 1, day]
}

function isValidDateKey(dateKey) {
  return parseDateKey(dateKey) !== null
}

function startOfLocalDay(dateKey) {
  const parts = parseDateKey(dateKey)
  if (!parts) return NaN
  const [year, monthIndex, day] = parts
  return new Date(year, monthIndex, day, 0, 0, 0, 0).getTime()
}

function endOfLocalDay(dateKey) {
  return startOfLocalDay(dateKey) + DAY_MS - 1
}

function minutesBetween(startMs, endMs) {
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs)) return 0
  if (endMs <= startMs) return 0
  return Math.floor((endMs - startMs) / MINUTE_MS)
}

function inclusiveDayCount(startKey, endKey) {
  const start = startOfLocalDay(startKey)
  const end = startOfLocalDay(endKey)
  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) return 0
  return Math.round((end - start) / DAY_MS) + 1
}

function overlapDayCount(aStart, aEnd, bStart, bEnd) {
  const start = Math.max(startOfLocalDay(aStart), startOfLocalDay(bStart))
  const end = Math.min(startOfLocalDay(aEnd), startOfLocalDay(bEnd))
  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) return 0
  return Math.round((end - start) / DAY_MS) + 1
}

function netWorkedMinutes({ punchInAt, punchOutAt, breakMinutes }, now = Date.now()) {
  if (!Number.isFinite(punchInAt)) return 0
  const end = Number.isFinite(punchOutAt) ? punchOutAt : now
  const gross = minutesBetween(punchInAt, end)
  return Math.max(0, gross - Math.max(0, Number(breakMinutes) || 0))
}

function overtimeMinutesForDay(netMinutes, dailyHours) {
  const contracted = Math.round((Number(dailyHours) || 0) * 60)
  if (contracted <= 0) return 0
  return Math.max(0, Math.round(netMinutes) - contracted)
}

module.exports = {
  MINUTE_MS,
  DAY_MS,
  localDateKey,
  parseDateKey,
  isValidDateKey,
  startOfLocalDay,
  endOfLocalDay,
  minutesBetween,
  inclusiveDayCount,
  overlapDayCount,
  netWorkedMinutes,
  overtimeMinutesForDay
}
