"use strict"


const fs = require("node:fs")
const ExcelJS = require("exceljs")
const repositories = require("./db/repositories.cjs")
const { appError } = require("./lib/errors.cjs")

const PAGE_SIZE = 500
const STYLE = {
  headerFill: "1E293B",
  titleFill: "0F172A",
  totalFill: "E2E8F0"
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

function minutesToHours(minutes) {
  return Math.round(((Number(minutes) || 0) / 60) * 100) / 100
}

function formatDuration(minutes, hourUnit, minuteUnit) {
  const total = Math.max(0, Math.round(Number(minutes) || 0))
  const hours = Math.floor(total / 60)
  const rest = total % 60
  const hUnit = hourUnit || "h"
  const mUnit = minuteUnit || "m"
  if (hours === 0 && rest === 0) return `0 ${mUnit}`
  if (hours === 0) return `${rest} ${mUnit}`
  if (rest === 0) return `${hours} ${hUnit}`
  return `${hours} ${hUnit} ${rest} ${mUnit}`
}

function decimalsOf(decimals) {
  const value = Math.round(Number(decimals))
  if (!Number.isFinite(value)) return 3
  return Math.min(4, Math.max(0, value))
}

function factorOf(decimals) {
  return Math.pow(10, decimalsOf(decimals))
}

function toExcelNumber(minor, decimals) {
  return Number((((Number(minor) || 0) / factorOf(decimals))).toFixed(decimalsOf(decimals)))
}

function formatAmount(minor, decimals, locale) {
  return new Intl.NumberFormat(locale || "en-GB", {
    minimumFractionDigits: decimalsOf(decimals),
    maximumFractionDigits: decimalsOf(decimals)
  }).format((Number(minor) || 0) / factorOf(decimals))
}

function formatMoney(minor, currency, decimals, locale) {
  const code = String(currency || "").trim()
  const digits = decimalsOf(decimals)
  if (/^[A-Za-z]{3}$/.test(code)) {
    try {
      return new Intl.NumberFormat(locale || "en-GB", {
        style: "currency",
        currency: code.toUpperCase(),
        minimumFractionDigits: digits,
        maximumFractionDigits: digits
      }).format((Number(minor) || 0) / factorOf(decimals))
    } catch {
    }
  }
  return `${formatAmount(minor, digits, locale)} ${code}`.trim()
}

const timeFormatter = new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit" })
const weekdayFormatters = new Map()
const weekdayCache = new Map()

function formatTime(epochMs) {
  if (!Number.isFinite(epochMs)) return "-"
  return timeFormatter.format(new Date(epochMs))
}

function weekdayLabel(dateKey, locale) {
  if (typeof dateKey !== "string" || !DATE_RE.test(dateKey)) return "-"
  const resolvedLocale = locale || "en-GB"
  const cacheKey = `${resolvedLocale}|${dateKey}`
  const cached = weekdayCache.get(cacheKey)
  if (cached) return cached

  let formatter = weekdayFormatters.get(resolvedLocale)
  if (!formatter) {
    formatter = new Intl.DateTimeFormat(resolvedLocale, { weekday: "long" })
    weekdayFormatters.set(resolvedLocale, formatter)
  }

  const [year, month, day] = dateKey.split("-").map(Number)
  const label = formatter.format(new Date(year, month - 1, day))
  if (weekdayCache.size > 5000) weekdayCache.clear()
  weekdayCache.set(cacheKey, label)
  return label
}

function sanitizeSpec(spec) {
  if (!spec || typeof spec !== "object") throw appError("export_invalid", "The export request is incomplete.")
  const headers = Array.isArray(spec.headers) ? spec.headers.map(String) : []
  if (headers.length === 0 || headers.length > 60) throw appError("export_invalid", "The export has no columns.")
  const headerRowIndex = Number(spec.headerRowIndex)
  return {
    creator: String(spec.creator ?? "hozor-ghiab"),
    sheetName: String(spec.sheetName ?? "Sheet1").slice(0, 60),
    rtl: spec.rtl !== false,
    title: String(spec.title ?? ""),
    subtitle: spec.subtitle ? String(spec.subtitle) : "",
    headers,
    headerRowIndex: Number.isFinite(headerRowIndex) ? Math.max(1, Math.min(10, headerRowIndex)) : 3,
    widths: Array.isArray(spec.widths) ? spec.widths.map(width => Number(width) || 14).slice(0, headers.length) : [],
    locale: String(spec.locale || "en-GB"),
    statusLabels: spec.statusLabels && typeof spec.statusLabels === "object" ? spec.statusLabels : {},
    paymentMethodLabels: spec.paymentMethodLabels && typeof spec.paymentMethodLabels === "object" ? spec.paymentMethodLabels : {},
    signedLabel: String(spec.signedLabel ?? ""),
    unsignedLabel: String(spec.unsignedLabel ?? ""),
    summaryLabel: String(spec.summaryLabel ?? ""),
    currency: String(spec.currency ?? ""),
    decimals: decimalsOf(spec.decimals),
    totalLabel: String(spec.totalLabel ?? "Total"),
    showEmployee: spec.showEmployee !== false,
    hourUnit: String(spec.hourUnit ?? (spec.locale?.startsWith("ar") ? "ساعة" : spec.locale?.startsWith("fa") ? "ساعت" : "h")),
    minuteUnit: String(spec.minuteUnit ?? (spec.locale?.startsWith("ar") ? "دقيقة" : spec.locale?.startsWith("fa") ? "دقیقه" : "m"))
  }
}

function styleHeaderRow(row, columns) {
  row.font = { bold: true, size: 11, color: { argb: "FFFFFFFF" } }
  row.height = 26
  for (let index = 1; index <= columns; index += 1) {
    const cell = row.getCell(index)
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: `FF${STYLE.headerFill}` } }
    cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true }
    cell.border = { bottom: { style: "thin", color: { argb: "FF94A3B8" } } }
  }
}

function styleTotalRow(row, columns) {
  row.font = { bold: true, size: 11 }
  for (let index = 1; index <= columns; index += 1) {
    row.getCell(index).fill = { type: "pattern", pattern: "solid", fgColor: { argb: `FF${STYLE.totalFill}` } }
  }
}

function prepareSheet(workbook, spec) {
  const sheet = workbook.addWorksheet(spec.sheetName, {
    views: [{ rightToLeft: spec.rtl }],
    pageSetup: { paperSize: 9, orientation: "landscape", fitToPage: true }
  })

  if (spec.widths.length > 0) {
    sheet.columns = spec.widths.map(width => ({ width }))
  }

  const columns = spec.headers.length
  sheet.mergeCells(1, 1, 1, columns)
  const titleCell = sheet.getCell(1, 1)
  titleCell.value = spec.title
  titleCell.font = { bold: true, size: 14, color: { argb: "FFFFFFFF" } }
  titleCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: `FF${STYLE.titleFill}` } }
  titleCell.alignment = { horizontal: "center", vertical: "middle" }
  sheet.getRow(1).height = 34

  let nextRow = 2
  if (spec.subtitle) {
    sheet.mergeCells(2, 1, 2, columns)
    const subtitleCell = sheet.getCell(2, 1)
    subtitleCell.value = spec.subtitle
    subtitleCell.font = { bold: true, size: 10, color: { argb: "FF334155" } }
    subtitleCell.alignment = { horizontal: "center", vertical: "middle" }
    sheet.getRow(2).height = 22
    nextRow = 3
  }

  while (nextRow < spec.headerRowIndex) {
    sheet.getRow(nextRow).commit()
    nextRow += 1
  }

  const headerRow = sheet.getRow(spec.headerRowIndex)
  headerRow.values = spec.headers
  styleHeaderRow(headerRow, columns)
  headerRow.commit()

  return sheet
}

async function runExport({ spec: rawSpec, targetPath, fetchPage, mapRow, styleRow, totalRowValues, onProgress, shouldCancel, trailer }) {
  const spec = sanitizeSpec(rawSpec)
  if (typeof targetPath !== "string" || targetPath.length === 0) {
    throw appError("export_invalid", "A destination file is required.")
  }

  const tempPath = `${targetPath}.part`
  fs.rmSync(tempPath, { force: true })

  const workbook = new ExcelJS.stream.xlsx.WorkbookWriter({
    filename: tempPath,
    useStyles: true,
    useSharedStrings: false
  })
  workbook.creator = spec.creator
  workbook.created = new Date()

  const startedAt = Date.now()
  let written = 0

  try {
    const sheet = prepareSheet(workbook, spec)
    const state = {}
    let page = 1
    let total = 0

    for (;;) {
      if (shouldCancel?.()) throw appError("export_cancelled", "Export cancelled.")
      const result = fetchPage({ page, pageSize: PAGE_SIZE })
      if (Number.isFinite(Number(result.total)) && Number(result.total) > 0) total = Number(result.total)
      if (result.rows.length === 0) break

      let lastRow = null
      for (const item of result.rows) {
        if (written % 250 === 0 && shouldCancel?.()) throw appError("export_cancelled", "Export cancelled.")
        lastRow = sheet.addRow(mapRow(item, spec, state))
        styleRow?.(lastRow, spec)
        written += 1
      }
      lastRow?.commit()

      onProgress?.({ written, total })
      if (written >= total) break
      page += 1
      await new Promise(resolve => setImmediate(resolve))
    }

    const totalRow = sheet.addRow(totalRowValues(state, spec, total))
    styleTotalRow(totalRow, spec.headers.length)
    totalRow.commit()

    if (typeof trailer === "function") {
      for (const rowValues of trailer(state, spec)) {
        sheet.addRow(rowValues).commit()
      }
    }

    await workbook.commit()
    fs.renameSync(tempPath, targetPath)

    return { filePath: targetPath, rows: written, total, durationMs: Date.now() - startedAt }
  } catch (error) {
    try {
      await workbook.commit()
    } catch {
    }
    try {
      fs.rmSync(tempPath, { force: true })
    } catch {
    }
    throw error
  }
}

function exportAttendance({ filter = {}, spec, targetPath, onProgress, shouldCancel }) {
  return runExport({
    spec: { headerRowIndex: 4, ...spec },
    targetPath,
    fetchPage: ({ page, pageSize }) =>
      repositories.attendancePage({ ...filter, page, pageSize }, { withCount: page === 1 }),
    onProgress,
    shouldCancel,
    mapRow: (record, sheetSpec, state) => {
      state.netMinutes = (state.netMinutes ?? 0) + (Number(record.netMinutes) || 0)
      state.breakMinutes = (state.breakMinutes ?? 0) + (Number(record.breakMinutes) || 0)
      const row = [
        record.recordDate,
        weekdayLabel(record.recordDate, sheetSpec.locale),
        ...(sheetSpec.showEmployee ? [record.employeeName] : []),
        formatTime(record.punchInAt),
        formatTime(record.punchOutAt),
        record.breakMinutes,
        formatDuration(record.netMinutes, sheetSpec.hourUnit, sheetSpec.minuteUnit),
        sheetSpec.statusLabels[record.status] ?? record.status,
        record.notes || ""
      ]
      return row
    },
    totalRowValues: (state, sheetSpec) => {
      const blankColumns = sheetSpec.showEmployee ? 4 : 3
      return [
        sheetSpec.totalLabel,
        "",
        ...(sheetSpec.showEmployee ? [""] : []),
        "",
        "",
        state.breakMinutes ?? 0,
        formatDuration(state.netMinutes ?? 0, sheetSpec.hourUnit, sheetSpec.minuteUnit),
        "",
        ""
      ].slice(0, blankColumns + 5)
    }
  })
}

function exportPayslips({ filter = {}, spec, targetPath, onProgress, shouldCancel }) {
  const numFmt = `#,##0.${"0".repeat(decimalsOf(spec?.decimals))}`

  return runExport({
    spec: { headerRowIndex: 3, ...spec },
    targetPath,
    fetchPage: ({ page, pageSize }) =>
      repositories.payslipsPage({ ...filter, page, pageSize }, { withCount: page === 1 }),
    onProgress,
    shouldCancel,
    styleRow: row => {
      for (let column = 5; column <= 9; column += 1) row.getCell(column).numFmt = numFmt
      row.getCell(13).numFmt = numFmt
    },
    mapRow: (payslip, sheetSpec, state) => {
      state.netAmountMinor = (state.netAmountMinor ?? 0) + (Number(payslip.netAmountMinor) || 0)
      const values = [
        payslip.number,
        payslip.employeeName,
        payslip.employeeCode,
        payslip.department,
        `${payslip.periodStart} → ${payslip.periodEnd}`,
        payslip.workedDays,
        formatDuration(payslip.workedMinutes, sheetSpec.hourUnit, sheetSpec.minuteUnit),
        formatDuration(payslip.overtimeMinutes, sheetSpec.hourUnit, sheetSpec.minuteUnit),
        toExcelNumber(payslip.baseSalaryMinor, sheetSpec.decimals),
        toExcelNumber(payslip.overtimeAmountMinor, sheetSpec.decimals),
        toExcelNumber(payslip.bonusesMinor, sheetSpec.decimals),
        toExcelNumber(payslip.deductionsMinor, sheetSpec.decimals),
        toExcelNumber(payslip.netAmountMinor, sheetSpec.decimals),
        payslip.paymentDate,
        sheetSpec.paymentMethodLabels[payslip.paymentMethod] ?? payslip.paymentMethod,
        payslip.isSigned ? sheetSpec.signedLabel : sheetSpec.unsignedLabel
      ]
      return values
    },
    totalRowValues: (state, sheetSpec) => [
      sheetSpec.totalLabel,
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      toExcelNumber(state.netAmountMinor ?? 0, sheetSpec.decimals),
      "",
      "",
      ""
    ],
    trailer: (state, sheetSpec) => {
      const totalNet = state.netAmountMinor ?? 0
      const amount = formatAmount(totalNet, sheetSpec.decimals, sheetSpec.locale)
      const money = formatMoney(totalNet, sheetSpec.currency, sheetSpec.decimals, sheetSpec.locale)
      return [[], [`${sheetSpec.summaryLabel}: ${money} (${amount})`]]
    }
  }).then(result => result)
}

module.exports = { exportAttendance, exportPayslips, PAGE_SIZE }
