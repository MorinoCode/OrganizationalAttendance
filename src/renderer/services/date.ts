import { Language } from "../types"


export const LOCALES: Record<Language, string> = {
  ar: "ar-KW-u-ca-gregory-nu-latn",
  en: "en-GB-u-ca-gregory-nu-latn",
  fa: "fa-IR-u-ca-gregory-nu-latn"
}

const pad2 = (value: number) => String(value).padStart(2, "0")

export function localDateKey(date: Date = new Date()): string {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`
}

export function todayKey(): string {
  return localDateKey()
}

export function dateKeyToDate(dateKey: string): Date {
  const [year, month, day] = dateKey.split("-").map(Number)
  return new Date(year, (month || 1) - 1, day || 1)
}

export function isDateKey(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value)
}

export function addDays(dateKey: string, days: number): string {
  const date = dateKeyToDate(dateKey)
  date.setDate(date.getDate() + days)
  return localDateKey(date)
}

export function monthStartKey(dateKey: string = todayKey()): string {
  return `${dateKey.slice(0, 7)}-01`
}

export function monthEndKey(dateKey: string = todayKey()): string {
  const [year, month] = dateKey.split("-").map(Number)
  return localDateKey(new Date(year, month, 0))
}

export type DatePreset = "thisMonth" | "lastMonth" | "thisWeek" | "last30Days"

export function getPresetDateRange(preset: DatePreset): { start: string; end: string } {
  const today = todayKey()
  if (preset === "thisMonth") {
    return { start: monthStartKey(today), end: today }
  }
  if (preset === "lastMonth") {
    const now = new Date()
    const firstOfCurrent = new Date(now.getFullYear(), now.getMonth(), 1)
    const lastDayOfPrev = new Date(firstOfCurrent.getTime() - 86400000)
    const firstDayOfPrev = new Date(lastDayOfPrev.getFullYear(), lastDayOfPrev.getMonth(), 1)
    return {
      start: localDateKey(firstDayOfPrev),
      end: localDateKey(lastDayOfPrev)
    }
  }
  if (preset === "thisWeek") {
    const now = new Date()
    const day = now.getDay()
    const diffToSunday = (day + 1) % 7
    const sunday = new Date(now)
    sunday.setDate(now.getDate() - diffToSunday)
    return {
      start: localDateKey(sunday),
      end: today
    }
  }
  return {
    start: addDays(today, -30),
    end: today
  }
}

export function daysBetween(startKey: string, endKey: string): string[] {
  const result: string[] = []
  let cursor = startKey
  let guard = 0
  while (cursor <= endKey && guard < 400) {
    result.push(cursor)
    cursor = addDays(cursor, 1)
    guard += 1
  }
  return result
}

export function formatDate(dateKey: string, lang: Language): string {
  if (!isDateKey(dateKey)) return "-"
  return dateKeyToDate(dateKey).toLocaleDateString(LOCALES[lang], {
    year: "numeric",
    month: "short",
    day: "numeric"
  })
}

export function formatDateLong(dateKey: string, lang: Language): string {
  if (!isDateKey(dateKey)) return "-"
  return dateKeyToDate(dateKey).toLocaleDateString(LOCALES[lang], {
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "long"
  })
}

export function weekdayName(dateKey: string, lang: Language): string {
  if (!isDateKey(dateKey)) return "-"
  return dateKeyToDate(dateKey).toLocaleDateString(LOCALES[lang], { weekday: "long" })
}

export function formatTime(epochMs: number | null | undefined, lang: Language): string {
  if (!Number.isFinite(epochMs as number)) return "--:--"
  return new Date(epochMs as number).toLocaleTimeString(LOCALES[lang], {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  })
}

export function formatTimeWithSeconds(epochMs: number | null | undefined, lang: Language): string {
  if (!Number.isFinite(epochMs as number)) return "--:--:--"
  return new Date(epochMs as number).toLocaleTimeString(LOCALES[lang], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false
  })
}

export function formatDateTime(epochMs: number | null | undefined, lang: Language): string {
  if (!Number.isFinite(epochMs as number)) return "-"
  return new Date(epochMs as number).toLocaleString(LOCALES[lang], {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  })
}

export function toDateTimeLocalValue(epochMs: number | null | undefined): string {
  if (!Number.isFinite(epochMs as number)) return ""
  const date = new Date(epochMs as number)
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}T${pad2(date.getHours())}:${pad2(date.getMinutes())}`
}

export function fromDateTimeLocalValue(value: string): number | null {
  if (!value) return null
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? null : parsed.getTime()
}

export function minutesToTime(minutes: number): string {
  const total = Math.max(0, Math.round(Number(minutes) || 0))
  return `${pad2(Math.floor(total / 60) % 24)}:${pad2(total % 60)}`
}

export function timeToMinutes(value: string): number | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec(String(value ?? "").trim())
  if (!match) return null
  const hours = Number(match[1])
  const minutes = Number(match[2])
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return null
  return hours * 60 + minutes
}

export function minutesToHours(minutes: number): number {
  return Math.round((Number(minutes) || 0) / 60 * 100) / 100
}

export function hoursToMinutes(hours: number): number {
  return Math.round((Number(hours) || 0) * 60)
}

export function formatDuration(minutes: number, hourUnit: string, minuteUnit: string): string {
  const total = Math.max(0, Math.round(Number(minutes) || 0))
  const hours = Math.floor(total / 60)
  const rest = total % 60
  if (hours === 0) return `${rest} ${minuteUnit}`
  if (rest === 0) return `${hours} ${hourUnit}`
  return `${hours} ${hourUnit} ${rest} ${minuteUnit}`
}
