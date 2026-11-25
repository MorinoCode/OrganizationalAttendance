import { describe, expect, it } from "vitest"
import { formatAmount, formatMoney, fromInputValue, fromMajor, roundMinor, toInputValue, toMajor } from "../src/renderer/services/money"

describe("minor unit conversion", () => {
  it("converts KWD with three decimals exactly", () => {
    expect(fromMajor(12.345, 3)).toBe(12345)
    expect(toMajor(12345, 3)).toBe(12.345)
    expect(fromMajor(0.001, 3)).toBe(1)
  })

  it("rounds half away from zero and never goes negative", () => {
    expect(roundMinor(10.5)).toBe(11)
    expect(roundMinor(-10)).toBe(0)
    expect(roundMinor(Number.NaN)).toBe(0)
  })

  it("supports two-decimal currencies", () => {
    expect(fromMajor(19.999, 2)).toBe(2000)
    expect(toMajor(2000, 2)).toBe(20)
  })

  it("does not accumulate float error across a payroll sum", () => {
    const parts = [0.1, 0.2, 0.3]
    const total = parts.reduce((sum, value) => sum + fromMajor(value, 3), 0)
    expect(total).toBe(600)
    expect(toMajor(total, 3)).toBe(0.6)
  })
})

describe("input helpers", () => {
  it("parses grouped input", () => {
    expect(fromInputValue("1,234.567", 3)).toBe(1234567)
    expect(fromInputValue("", 3)).toBe(0)
    expect(fromInputValue("abc", 3)).toBe(0)
  })

  it("renders an editable value with the right precision", () => {
    expect(toInputValue(12345, 3)).toBe("12.345")
    expect(toInputValue(0, 3)).toBe("0.000")
  })
})

describe("formatting", () => {
  it("formats KWD with three decimals in English", () => {
    const formatted = formatMoney(12_345_000, "KWD", 3, "en")
    expect(formatted).toContain("12,345.000")
  })

  it("falls back to a plain amount for non-ISO currencies", () => {
    expect(formatMoney(1_500_000, "تومان", 0, "fa")).toContain("1,500,000")
  })

  it("formats plain amounts without a symbol", () => {
    expect(formatAmount(12345, 3, "en")).toBe("12.345")
  })
})
