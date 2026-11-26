import { createRequire } from "node:module"
import { describe, expect, it } from "vitest"

const require = createRequire(import.meta.url)
const validate = require("../src/main/lib/validate.cjs") as {
  requireString: (value: unknown, code: string, maxLength?: number) => string
  optionalString: (value: unknown, maxLength?: number) => string
  toInteger: (value: unknown, options?: { min?: number; max?: number; fallback?: number }) => number
  toNumber: (value: unknown, options?: { min?: number; max?: number; fallback?: number }) => number
  toMinor: (value: unknown) => number
  toBoolean: (value: unknown) => boolean
  assertDateKey: (value: unknown, code: string) => string
}

function codeOf(fn: () => unknown): string | undefined {
  try {
    fn()
  } catch (error) {
    return (error as { code?: string }).code
  }
  return undefined
}

describe("required and optional text", () => {
  it("trims required text and reports the caller's error code", () => {
    expect(validate.requireString("  Ali Hassan  ", "employee_name_required")).toBe("Ali Hassan")
    expect(validate.requireString(123, "anything")).toBe("123")
    expect(codeOf(() => validate.requireString("   ", "employee_name_required"))).toBe("employee_name_required")
    expect(codeOf(() => validate.requireString(null, "employee_code_required"))).toBe("employee_code_required")
    expect(codeOf(() => validate.requireString("x".repeat(121), "too_long", 120))).toBe("too_long")
    expect(validate.requireString("x".repeat(120), "too_long", 120)).toHaveLength(120)
  })

  it("truncates optional text instead of failing the write", () => {
    expect(validate.optionalString("  sales  ")).toBe("sales")
    expect(validate.optionalString(null)).toBe("")
    expect(validate.optionalString("abcdef", 3)).toBe("abc")
  })
})

describe("numeric coercion", () => {
  it("rounds integers, clamps them and falls back on garbage", () => {
    expect(validate.toInteger(3.6)).toBe(4)
    expect(validate.toInteger(-3.6)).toBe(-4)
    expect(validate.toInteger("12")).toBe(12)
    expect(validate.toInteger(3.6, { min: 0, max: 3 })).toBe(3)
    expect(validate.toInteger(-5, { min: 0 })).toBe(0)
    expect(validate.toInteger(Number.NaN)).toBe(0)
    expect(validate.toInteger(Number.NaN, { fallback: 7 })).toBe(7)
    expect(validate.toInteger("abc", { fallback: 7 })).toBe(7)
    expect(validate.toInteger(Number.POSITIVE_INFINITY)).toBe(0)
  })

  it("keeps fractions for numbers and honours bounds", () => {
    expect(validate.toNumber(1.239)).toBe(1.239)
    expect(validate.toNumber("2.5")).toBe(2.5)
    expect(validate.toNumber(5, { max: 4 })).toBe(4)
    expect(validate.toNumber(-1, { min: 0 })).toBe(0)
    expect(validate.toNumber("abc", { fallback: 8 })).toBe(8)
  })

  it("never stores a negative or oversized money amount in minor units", () => {
    expect(validate.toMinor(-500)).toBe(0)
    expect(validate.toMinor(1234.6)).toBe(1235)
    expect(validate.toMinor(1e13)).toBe(999_999_999_999)
  })

  it("treats only real truthy flags as true", () => {
    for (const value of [true, 1, "1"]) expect(validate.toBoolean(value)).toBe(true)
    for (const value of [false, 0, "0", "true", "yes", null, undefined, 2]) {
      expect(validate.toBoolean(value)).toBe(false)
    }
  })
})

describe("dates", () => {
  it("accepts padded keys and rejects everything else with the requested code", () => {
    expect(validate.assertDateKey(" 2026-11-25 ", "invalid_date")).toBe("2026-11-25")
    for (const value of ["2026-11-5", "25/11/2026", "", null, 20261125]) {
      expect(codeOf(() => validate.assertDateKey(value, "invalid_date"))).toBe("invalid_date")
    }
  })
})
