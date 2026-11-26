import { afterEach, describe, expect, it, vi } from "vitest"

import {
  addDays,
  daysBetween,
  formatDate,
  formatDateTime,
  formatDuration,
  formatTime,
  fromDateTimeLocalValue,
  getPresetDateRange,
  hoursToMinutes,
  isDateKey,
  localDateKey,
  minutesToHours,
  minutesToTime,
  monthEndKey,
  monthStartKey,
  timeToMinutes,
  toDateTimeLocalValue
} from "../src/renderer/services/date"

afterEach(() => {
  vi.useRealTimers()
})

function freezeAt(year: number, monthIndex: number, day: number): void {
  vi.useFakeTimers()
  vi.setSystemTime(new Date(year, monthIndex, day, 10, 0, 0))
}

describe("date keys", () => {
  it("keeps a local punch on its local day and pads every part", () => {
    expect(localDateKey(new Date(2026, 0, 1, 0, 30, 0))).toBe("2026-01-01")
    expect(localDateKey(new Date(2026, 8, 9, 23, 59, 0))).toBe("2026-09-09")
  })

  it("accepts only yyyy-mm-dd keys", () => {
    expect(isDateKey("2026-11-25")).toBe(true)
    expect(isDateKey("2026-1-05")).toBe(false)
    expect(isDateKey("25-11-2026")).toBe(false)
    expect(isDateKey("")).toBe(false)
  })

  it("moves across month and year boundaries", () => {
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01")
    expect(addDays("2026-01-01", -1)).toBe("2025-12-31")
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28")
    expect(addDays("2028-03-01", -1)).toBe("2028-02-29")
  })

  it("builds month boundaries including leap februaries", () => {
    expect(monthStartKey("2026-11-30")).toBe("2026-11-01")
    expect(monthEndKey("2026-11-01")).toBe("2026-11-30")
    expect(monthEndKey("2026-02-10")).toBe("2026-02-28")
    expect(monthEndKey("2028-02-10")).toBe("2028-02-29")
    expect(monthEndKey("2026-12-15")).toBe("2026-12-31")
  })

  it("enumerates an inclusive range and guards against runaway loops", () => {
    expect(daysBetween("2026-11-01", "2026-11-05")).toEqual([
      "2026-11-01",
      "2026-11-02",
      "2026-11-03",
      "2026-11-04",
      "2026-11-05"
    ])
    expect(daysBetween("2026-11-05", "2026-11-01")).toEqual([])
    expect(daysBetween("2026-01-01", "2027-12-31")).toHaveLength(400)
  })
})

describe("report presets", () => {
  it("uses the first of the month up to today", () => {
    freezeAt(2026, 2, 15)
    expect(getPresetDateRange("thisMonth")).toEqual({ start: "2026-03-01", end: "2026-03-15" })
  })

  it("returns the whole previous month, including the january rollover", () => {
    freezeAt(2026, 2, 15)
    expect(getPresetDateRange("lastMonth")).toEqual({ start: "2026-02-01", end: "2026-02-28" })

    freezeAt(2026, 0, 10)
    expect(getPresetDateRange("lastMonth")).toEqual({ start: "2025-12-01", end: "2025-12-31" })
  })

  it("starts the week on sunday (kuwait work week)", () => {
    freezeAt(2026, 2, 18) // Wednesday
    expect(getPresetDateRange("thisWeek")).toEqual({ start: "2026-03-15", end: "2026-03-18" })

    freezeAt(2026, 2, 15) // Sunday
    expect(getPresetDateRange("thisWeek")).toEqual({ start: "2026-03-15", end: "2026-03-15" })
  })

  it("covers the last thirty days inclusively", () => {
    freezeAt(2026, 2, 18)
    expect(getPresetDateRange("last30Days")).toEqual({ start: "2026-02-16", end: "2026-03-18" })
  })
})

describe("time of day helpers", () => {
  it("parses and formats clock times, rejecting impossible values", () => {
    expect(timeToMinutes("08:05")).toBe(485)
    expect(timeToMinutes("8:05")).toBe(485)
    expect(timeToMinutes(" 23:59 ")).toBe(1439)
    expect(timeToMinutes("24:00")).toBeNull()
    expect(timeToMinutes("08:60")).toBeNull()
    expect(timeToMinutes("8:5")).toBeNull()
    expect(timeToMinutes("")).toBeNull()

    expect(minutesToTime(485)).toBe("08:05")
    expect(minutesToTime(-5)).toBe("00:00")
  })

  it("converts between minutes and decimal hours", () => {
    expect(minutesToHours(90)).toBe(1.5)
    expect(minutesToHours(0)).toBe(0)
    expect(hoursToMinutes(1.5)).toBe(90)
    expect(hoursToMinutes(undefined as unknown as number)).toBe(0)
  })

  it("renders durations with only the units that exist", () => {
    expect(formatDuration(0, "h", "m")).toBe("0 m")
    expect(formatDuration(45, "h", "m")).toBe("45 m")
    expect(formatDuration(120, "h", "m")).toBe("2 h")
    expect(formatDuration(90, "h", "m")).toBe("1 h 30 m")
    expect(formatDuration(-30, "h", "m")).toBe("0 m")
  })
})

describe("display formatting", () => {
  it("shows placeholders instead of crashing on empty values", () => {
    expect(formatTime(null, "en")).toBe("--:--")
    expect(formatTime(Number.NaN, "en")).toBe("--:--")
    expect(formatDateTime(null, "ar")).toBe("-")
    expect(formatDate("not-a-date", "fa")).toBe("-")
    expect(formatDate("2026-11-25", "en")).toContain("2026")
  })

  it("round-trips the datetime-local input value", () => {
    const stamp = new Date(2026, 0, 2, 3, 4, 0).getTime()
    const value = toDateTimeLocalValue(stamp)
    expect(value).toBe("2026-01-02T03:04")
    expect(fromDateTimeLocalValue(value)).toBe(stamp)

    expect(toDateTimeLocalValue(null)).toBe("")
    expect(fromDateTimeLocalValue("")).toBeNull()
    expect(fromDateTimeLocalValue("nonsense")).toBeNull()
  })
})
