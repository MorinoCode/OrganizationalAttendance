"use strict"

const { appError } = require("./errors.cjs")

function requireString(value, code, maxLength = 200) {
  const text = String(value ?? "").trim()
  if (!text) throw appError(code, `Value for "${code}" is required.`)
  if (text.length > maxLength) throw appError(code, `Value for "${code}" is too long.`)
  return text
}

function optionalString(value, maxLength = 500) {
  const text = String(value ?? "").trim()
  return text.length > maxLength ? text.slice(0, maxLength) : text
}

function toInteger(value, { min = Number.MIN_SAFE_INTEGER, max = Number.MAX_SAFE_INTEGER, fallback = 0 } = {}) {
  const parsed = typeof value === "number" ? value : Number(value)
  if (!Number.isFinite(parsed)) return fallback
  const rounded = Math.round(parsed)
  if (rounded < min) return min
  if (rounded > max) return max
  return rounded
}

function toNumber(value, { min = -Infinity, max = Infinity, fallback = 0 } = {}) {
  const parsed = typeof value === "number" ? value : Number(value)
  if (!Number.isFinite(parsed)) return fallback
  if (parsed < min) return min
  if (parsed > max) return max
  return parsed
}

function toMinor(value) {
  return toInteger(value, { min: 0, max: 999_999_999_999, fallback: 0 })
}

function toBoolean(value) {
  return value === true || value === 1 || value === "1"
}

function assertDateKey(value, code) {
  const text = String(value ?? "").trim()
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) throw appError(code, `Invalid date: ${text}`)
  return text
}

module.exports = {
  requireString,
  optionalString,
  toInteger,
  toNumber,
  toMinor,
  toBoolean,
  assertDateKey
}
