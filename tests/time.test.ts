import { createRequire } from "node:module"
import { describe, expect, it } from "vitest"

const require = createRequire(import.meta.url)
const time = require("../src/main/lib/time.cjs") as {
  localDateKey: (input?: number | Date) => string
  startOfLocalDay: (key: string) => number
  endOfLocalDay: (key: string) => number
  minutesBetween: (a: number, b: number) => number
  inclusiveDayCount: (a: string, b: string) => number
  overlapDayCount: (a: string, b: string, c: string, d: string) => number
  netWorkedMinutes: (
    record: { punchInAt?: number; punchOutAt?: number | null; breakMinutes?: number },
    now?: number
  ) => number
  overtimeMinutesForDay: (netMinutes: number, dailyHours: number) => number
  isValidDateKey: (key: string) => boolean
}

describe("local date handling", () => {
  it("keeps a 00:30 local punch on the local day (the old UTC bug returned yesterday)", () => {
    const justAfterMidnight = new Date(2026, 0, 1, 0, 30, 0)
    expect(time.localDateKey(justAfterMidnight)).toBe("2026-01-01")
  })

  it("keeps a 23:59 local punch on the same local day", () => {
    const lateNight = new Date(2026, 11, 31, 23, 59, 0)
    expect(time.localDateKey(lateNight)).toBe("2026-12-31")
  })

  it("validates date keys", () => {
    expect(time.isValidDateKey("2026-02-28")).toBe(true)
    expect(time.isValidDateKey("2026-2-8")).toBe(false)
    expect(time.isValidDateKey("")).toBe(false)
  })

  it("builds local day boundaries", () => {
    const start = time.startOfLocalDay("2026-03-10")
    expect(time.localDateKey(start)).toBe("2026-03-10")
    expect(time.endOfLocalDay("2026-03-10") - start).toBe(24 * 60 * 60 * 1000 - 1)
  })
})

describe("durations", () => {
  it("counts inclusive days and range overlaps", () => {
    expect(time.inclusiveDayCount("2026-01-01", "2026-01-01")).toBe(1)
    expect(time.inclusiveDayCount("2026-01-01", "2026-01-03")).toBe(3)
    expect(time.overlapDayCount("2026-01-01", "2026-01-31", "2026-01-30", "2026-02-02")).toBe(2)
    expect(time.overlapDayCount("2026-01-01", "2026-01-05", "2026-02-01", "2026-02-05")).toBe(0)
  })

  it("never returns negative minutes", () => {
    expect(time.minutesBetween(1000, 500)).toBe(0)
    expect(time.minutesBetween(0, 90_000)).toBe(1)
  })

  it("subtracts break minutes from the gross shift", () => {
    const start = new Date(2026, 5, 1, 8, 0, 0).getTime()
    const end = new Date(2026, 5, 1, 17, 0, 0).getTime()
    expect(time.netWorkedMinutes({ punchInAt: start, punchOutAt: end, breakMinutes: 60 })).toBe(8 * 60)
  })

  it("counts an open shift up to the supplied instant", () => {
    const start = new Date(2026, 5, 1, 8, 0, 0).getTime()
    const now = new Date(2026, 5, 1, 12, 0, 0).getTime()
    expect(time.netWorkedMinutes({ punchInAt: start, punchOutAt: null, breakMinutes: 0 }, now)).toBe(240)
  })

  it("computes overtime against the contractual day", () => {
    expect(time.overtimeMinutesForDay(9 * 60, 8)).toBe(60)
    expect(time.overtimeMinutesForDay(6 * 60, 8)).toBe(0)
    expect(time.overtimeMinutesForDay(480, 0)).toBe(0)
  })
})
