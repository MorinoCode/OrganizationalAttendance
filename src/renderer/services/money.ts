import { Language } from "../types"
import { LOCALES } from "./date"


export const MAX_SAFE_MINOR = 999_999_999_999

function decimalsOf(decimals: number): number {
  const value = Math.round(Number(decimals))
  if (!Number.isFinite(value)) return 3
  return Math.min(4, Math.max(0, value))
}

export function factorOf(decimals: number): number {
  return Math.pow(10, decimalsOf(decimals))
}

export function roundMinor(value: number): number {
  if (!Number.isFinite(value)) return 0
  const rounded = Math.round(value)
  if (rounded < 0) return 0
  return Math.min(rounded, MAX_SAFE_MINOR)
}

export function fromMajor(value: number, decimals: number): number {
  return roundMinor((Number(value) || 0) * factorOf(decimals))
}

export function toMajor(minor: number, decimals: number): number {
  return (Number(minor) || 0) / factorOf(decimals)
}

export function formatAmount(minor: number, decimals: number, lang: Language = "en"): string {
  return new Intl.NumberFormat(LOCALES[lang], {
    minimumFractionDigits: decimalsOf(decimals),
    maximumFractionDigits: decimalsOf(decimals)
  }).format(toMajor(minor, decimals))
}

export function toExcelNumber(minor: number, decimals: number): number {
  return Number(toMajor(minor, decimals).toFixed(decimalsOf(decimals)))
}

const ISO_CURRENCY = /^[A-Za-z]{3}$/

export function formatMoney(minor: number, currency: string, decimals: number, lang: Language = "en"): string {
  const code = String(currency || "").trim()
  const digits = decimalsOf(decimals)

  if (ISO_CURRENCY.test(code)) {
    try {
      return new Intl.NumberFormat(LOCALES[lang], {
        style: "currency",
        currency: code.toUpperCase(),
        minimumFractionDigits: digits,
        maximumFractionDigits: digits
      }).format(toMajor(minor, digits))
    } catch {
    }
  }

  return `${formatAmount(minor, digits, lang)} ${code}`.trim()
}

export function toInputValue(minor: number, decimals: number): string {
  return String(toMajor(minor, decimals).toFixed(decimalsOf(decimals)))
}

export function fromInputValue(value: string | number, decimals: number): number {
  const text = String(value ?? "").replace(/,/g, "").trim()
  if (!text) return 0
  const parsed = Number(text)
  return Number.isFinite(parsed) ? fromMajor(parsed, decimals) : 0
}
