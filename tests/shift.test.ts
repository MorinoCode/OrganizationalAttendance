import { createRequire } from "node:module"
import { describe, expect, it } from "vitest"

const require = createRequire(import.meta.url)
const shift = require("../src/main/lib/shift.cjs") as {
  timeToMinutes: (value: unknown) => number | null
  minutesToTime: (value: number) => string
  parseWorkDays: (value: unknown) => number[] | null
  isWorkingDay: (dateKey: string, workDays: unknown) => boolean
  workingDayKeys: (startKey: string, endKey: string, workDays: unknown) => string[]
  lateMinutesFor: (input: {
    punchInAt: number
    recordDate?: string
    shiftStartMinutes: number
    graceMinutes?: number
  }) => number
  earlyLeaveMinutesFor: (input: {
    punchOutAt: number
    recordDate?: string
    shiftEndMinutes: number
    graceMinutes?: number
  }) => number
}

const KUWAIT_WEEK = [0, 1, 2, 3, 4] // Sunday to Thursday
const at = (day: number, hour: number, minute = 0) => new Date(2026, 10, day, hour, minute, 0).getTime()

describe("shift helpers", () => {
  it("parses and formats times of day", () => {
    expect(shift.timeToMinutes("08:30")).toBe(510)
    expect(shift.timeToMinutes(480)).toBe(480)
    expect(shift.timeToMinutes("24:00")).toBeNull()
    expect(shift.timeToMinutes("8:5")).toBeNull()
    expect(shift.timeToMinutes("")).toBeNull()
    expect(shift.minutesToTime(510)).toBe("08:30")
    expect(shift.minutesToTime(0)).toBe("00:00")
  })

  it("normalizes work day configurations", () => {
    expect(shift.parseWorkDays("0,1,2,3,4")).toEqual([0, 1, 2, 3, 4])
    expect(shift.parseWorkDays([6, 0, 0, 5])).toEqual([0, 5, 6])
    expect(shift.parseWorkDays("")).toBeNull()
    expect(shift.parseWorkDays("7")).toBeNull()
    expect(shift.parseWorkDays([-1, 2])).toBeNull()
  })

  it("counts working days and excludes the weekend", () => {
    expect(shift.isWorkingDay("2026-11-20", KUWAIT_WEEK)).toBe(false)
    expect(shift.isWorkingDay("2026-11-21", KUWAIT_WEEK)).toBe(false)
    expect(shift.isWorkingDay("2026-11-22", KUWAIT_WEEK)).toBe(true)
    expect(shift.workingDayKeys("2026-11-20", "2026-11-25", KUWAIT_WEEK)).toEqual([
      "2026-11-22",
      "2026-11-23",
      "2026-11-24",
      "2026-11-25"
    ])
    expect(shift.workingDayKeys("2026-11-25", "2026-11-20", KUWAIT_WEEK)).toEqual([])
    expect(shift.workingDayKeys("2026-11-20", "2026-11-21", KUWAIT_WEEK)).toEqual([])
  })

  it("applies the grace period to lateness", () => {
    const base = { recordDate: "2026-11-25", shiftStartMinutes: 480, graceMinutes: 10 }
    expect(shift.lateMinutesFor({ ...base, punchInAt: at(25, 8, 10) })).toBe(0)
    expect(shift.lateMinutesFor({ ...base, punchInAt: at(25, 8, 11) })).toBe(1)
    expect(shift.lateMinutesFor({ ...base, punchInAt: at(25, 8, 25) })).toBe(15)
    expect(shift.lateMinutesFor({ ...base, punchInAt: at(25, 7, 45) })).toBe(0)
  })

  it("applies the grace period to early leave", () => {
    const base = { recordDate: "2026-11-25", shiftEndMinutes: 1020, graceMinutes: 10 }
    expect(shift.earlyLeaveMinutesFor({ ...base, punchOutAt: at(25, 17, 5) })).toBe(0)
    expect(shift.earlyLeaveMinutesFor({ ...base, punchOutAt: at(25, 16, 50) })).toBe(0)
    expect(shift.earlyLeaveMinutesFor({ ...base, punchOutAt: at(25, 16, 40) })).toBe(10)
    expect(shift.earlyLeaveMinutesFor({ ...base, punchOutAt: at(25, 19, 0) })).toBe(0)
  })

  it("ignores punches recorded on another calendar day (overnight shifts)", () => {
    expect(
      shift.lateMinutesFor({
        recordDate: "2026-11-24",
        punchInAt: at(25, 9, 0),
        shiftStartMinutes: 480,
        graceMinutes: 0
      })
    ).toBe(0)
    expect(
      shift.earlyLeaveMinutesFor({
        recordDate: "2026-11-24",
        punchOutAt: at(25, 9, 0),
        shiftEndMinutes: 1020,
        graceMinutes: 0
      })
    ).toBe(0)
  })
})
