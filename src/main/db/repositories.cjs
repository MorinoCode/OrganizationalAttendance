"use strict"


const crypto = require("node:crypto")
const { getDb, withTransaction } = require("./index.cjs")
const { appError } = require("../lib/errors.cjs")
const time = require("../lib/time.cjs")
const shift = require("../lib/shift.cjs")
const {
  requireString,
  optionalString,
  toInteger,
  toNumber,
  toMinor,
  toBoolean,
  assertDateKey
} = require("../lib/validate.cjs")

const SALARY_TYPES = ["fixed_monthly", "hourly", "daily", "custom"]
const LEAVE_TYPES = ["paid", "unpaid", "sick", "emergency"]
const PAYMENT_METHODS = ["cash", "bank_transfer", "cheque", "knet"]
const ATTENDANCE_STATUSES = ["present", "on_break", "completed", "absent"]

const newId = prefix => `${prefix}-${crypto.randomUUID()}`
const nowIso = () => new Date().toISOString()


function mapSettings(row) {
  return {
    companyName: row.company_name ?? "",
    ownerName: row.owner_name ?? "",
    ownerRole: row.owner_role ?? "",
    currency: row.currency ?? "KWD",
    currencyDecimals: Number(row.currency_decimals ?? 3),
    defaultDailyHours: Number(row.default_daily_hours ?? 8),
    standardWorkDays: Number(row.standard_work_days ?? 26),
    overtimeMultiplier: Number(row.overtime_multiplier ?? 1.25),
    shiftStartMinutes: Number(row.shift_start_minutes ?? 480),
    shiftEndMinutes: Number(row.shift_end_minutes ?? 1020),
    graceMinutes: Number(row.grace_minutes ?? 10),
    workDays: shift.parseWorkDays(row.work_days) ?? [0, 1, 2, 3, 4],
    isConfigured: Boolean(row.is_configured),
    logoPath: row.logo_path ?? null,
    hasPassword: Boolean(row.admin_password_hash),
    updatedAt: row.updated_at ?? null
  }
}

function mapEmployee(row) {
  return {
    id: row.id,
    fullName: row.full_name,
    employeeCode: row.employee_code,
    phone: row.phone ?? "",
    department: row.department ?? "",
    salaryType: row.salary_type,
    baseRateMinor: Number(row.base_rate_minor ?? 0),
    isActive: Boolean(row.is_active),
    createdAt: row.created_at,
    updatedAt: row.updated_at
  }
}

function mapBreak(row) {
  return {
    id: row.id,
    breakStartAt: Number(row.break_start_at),
    breakEndAt: row.break_end_at === null ? null : Number(row.break_end_at),
    durationMinutes: Number(row.duration_minutes ?? 0)
  }
}

function mapAttendance(row, breaks = [], now = Date.now()) {
  const punchInAt = row.punch_in_at === null ? null : Number(row.punch_in_at)
  const punchOutAt = row.punch_out_at === null ? null : Number(row.punch_out_at)
  const breakMinutes = Number(row.break_minutes ?? 0)
  const netMinutes = punchOutAt === null
    ? time.netWorkedMinutes({ punchInAt, punchOutAt: null, breakMinutes }, now)
    : Number(row.net_minutes ?? 0)

  return {
    id: row.id,
    employeeId: row.employee_id,
    employeeName: row.employee_name ?? "",
    recordDate: row.record_date,
    punchInAt,
    punchOutAt,
    breakMinutes,
    netMinutes,
    lateMinutes: Number(row.late_minutes ?? 0),
    earlyLeaveMinutes: Number(row.early_leave_minutes ?? 0),
    status: row.status,
    notes: row.notes ?? "",
    breaks
  }
}

function mapLeave(row) {
  return {
    id: row.id,
    employeeId: row.employee_id,
    employeeName: row.employee_name ?? "",
    leaveType: row.leave_type,
    startDate: row.start_date,
    endDate: row.end_date,
    days: Number(row.days ?? 1),
    isPaid: Boolean(row.is_paid),
    reason: row.reason ?? "",
    createdAt: row.created_at
  }
}

function mapPayslip(row) {
  const nullable = key => (row[key] === null || row[key] === "" ? "" : row[key])
  return {
    id: row.id,
    number: row.number,
    employeeId: row.employee_id,
    employeeName: row.employee_name,
    employeeCode: row.employee_code,
    department: row.department ?? "",
    salaryType: row.salary_type,
    baseRateMinor: Number(row.base_rate_minor ?? 0),
    periodStart: row.period_start,
    periodEnd: row.period_end,
    workedDays: Number(row.worked_days ?? 0),
    workedMinutes: Number(row.worked_minutes ?? 0),
    breakMinutes: Number(row.break_minutes ?? 0),
    overtimeMinutes: Number(row.overtime_minutes ?? 0),
    unpaidLeaveDays: Number(row.unpaid_leave_days ?? 0),
    baseSalaryMinor: Number(row.base_salary_minor ?? 0),
    overtimeAmountMinor: Number(row.overtime_amount_minor ?? 0),
    bonusesMinor: Number(row.bonuses_minor ?? 0),
    deductionsMinor: Number(row.deductions_minor ?? 0),
    netAmountMinor: Number(row.net_amount_minor ?? 0),
    paymentDate: nullable("payment_date"),
    paymentMethod: row.payment_method ?? "bank_transfer",
    notes: row.notes ?? "",
    isSigned: Boolean(row.is_signed),
    signedAt: row.signed_at ?? null,
    createdAt: row.created_at
  }
}


function logAudit(db, { actor, entity, entityId, action, details }) {
  db.prepare(
    "INSERT INTO audit_logs (at, actor, entity, entity_id, action, details) VALUES (?, ?, ?, ?, ?, ?)"
  ).run(
    nowIso(),
    actor || "system",
    entity,
    entityId ?? null,
    action,
    typeof details === "string" ? details : JSON.stringify(details ?? {})
  )
}

function listAuditLogs(limit = 50) {
  return getDb()
    .prepare("SELECT * FROM audit_logs ORDER BY id DESC LIMIT ?")
    .all(toInteger(limit, { min: 1, max: 500, fallback: 50 }))
    .map(row => ({
      id: Number(row.id),
      at: row.at,
      actor: row.actor,
      entity: row.entity,
      entityId: row.entity_id,
      action: row.action,
      details: row.details
    }))
}


function rawSettingsRow(db = getDb()) {
  const row = db.prepare("SELECT * FROM company_settings WHERE id = 1").get()
  if (!row) throw appError("settings_missing", "Company settings are missing.")
  return row
}

function getSettings() {
  return mapSettings(rawSettingsRow())
}

function getPasswordHash() {
  return rawSettingsRow().admin_password_hash || ""
}

function setPasswordHash(hash, actor) {
  return withTransaction(db => {
    db.prepare("UPDATE company_settings SET admin_password_hash = ?, is_configured = 1, updated_at = ? WHERE id = 1")
      .run(requireString(hash, "password_hash_required", 400), nowIso())
    logAudit(db, { actor, entity: "settings", entityId: "1", action: "password_changed" })
    return mapSettings(rawSettingsRow(db))
  })
}

function scheduledMinuteOfDay(value, label) {
  const minutes = shift.timeToMinutes(value)
  if (minutes === null) throw appError("invalid_shift_range", `${label} is not a valid time of day.`)
  return minutes
}

function shiftSettings(db = getDb()) {
  return mapSettings(rawSettingsRow(db))
}

function resolveShiftSettings(patch = {}, current) {
  const shiftStartMinutes = patch.shiftStartMinutes !== undefined
    ? scheduledMinuteOfDay(patch.shiftStartMinutes, "Shift start")
    : scheduledMinuteOfDay(current.shift_start_minutes, "Shift start")
  const shiftEndMinutes = patch.shiftEndMinutes !== undefined
    ? scheduledMinuteOfDay(patch.shiftEndMinutes, "Shift end")
    : scheduledMinuteOfDay(current.shift_end_minutes, "Shift end")

  if (shiftEndMinutes <= shiftStartMinutes) {
    throw appError("invalid_shift_range", "Shift end must be after the shift start.")
  }

  const graceMinutes = patch.graceMinutes !== undefined
    ? toInteger(patch.graceMinutes, { min: 0, max: 120, fallback: Number(current.grace_minutes ?? 10) })
    : Number(current.grace_minutes ?? 10)

  const workDays = shift.parseWorkDays(patch.workDays !== undefined ? patch.workDays : current.work_days)
  if (!workDays) throw appError("invalid_work_days", "At least one working day is required.")

  return {
    shift_start_minutes: shiftStartMinutes,
    shift_end_minutes: shiftEndMinutes,
    grace_minutes: graceMinutes,
    work_days: workDays.join(",")
  }
}

function updateSettings(patch = {}, actor) {
  return withTransaction(db => {
    const current = rawSettingsRow(db)

    const currency = patch.currency !== undefined
      ? requireString(patch.currency, "currency_required", 12)
      : current.currency

    const shiftPatch = resolveShiftSettings(patch, current)

    const next = {
      company_name: patch.companyName !== undefined
        ? requireString(patch.companyName, "company_name_required", 120)
        : current.company_name,
      owner_name: patch.ownerName !== undefined
        ? requireString(patch.ownerName, "owner_name_required", 120)
        : current.owner_name,
      owner_role: patch.ownerRole !== undefined
        ? optionalString(patch.ownerRole, 120)
        : current.owner_role,
      currency,
      currency_decimals: patch.currencyDecimals !== undefined
        ? toInteger(patch.currencyDecimals, { min: 0, max: 4, fallback: current.currency_decimals })
        : current.currency_decimals,
      default_daily_hours: patch.defaultDailyHours !== undefined
        ? toNumber(patch.defaultDailyHours, { min: 1, max: 24, fallback: current.default_daily_hours })
        : current.default_daily_hours,
      standard_work_days: patch.standardWorkDays !== undefined
        ? toInteger(patch.standardWorkDays, { min: 1, max: 31, fallback: current.standard_work_days })
        : current.standard_work_days,
      overtime_multiplier: patch.overtimeMultiplier !== undefined
        ? toNumber(patch.overtimeMultiplier, { min: 0, max: 10, fallback: current.overtime_multiplier })
        : current.overtime_multiplier,
      shift_start_minutes: shiftPatch.shift_start_minutes,
      shift_end_minutes: shiftPatch.shift_end_minutes,
      grace_minutes: shiftPatch.grace_minutes,
      work_days: shiftPatch.work_days,
      is_configured: patch.isConfigured !== undefined
        ? (toBoolean(patch.isConfigured) ? 1 : 0)
        : current.is_configured,
      logo_path: patch.logoPath !== undefined ? optionalString(patch.logoPath, 400) : current.logo_path
    }

    db.prepare(`
      UPDATE company_settings SET
        company_name = ?, owner_name = ?, owner_role = ?, currency = ?, currency_decimals = ?,
        default_daily_hours = ?, standard_work_days = ?, overtime_multiplier = ?,
        shift_start_minutes = ?, shift_end_minutes = ?, grace_minutes = ?, work_days = ?,
        is_configured = ?, logo_path = ?, updated_at = ?
      WHERE id = 1
    `).run(
      next.company_name,
      next.owner_name,
      next.owner_role,
      next.currency,
      next.currency_decimals,
      next.default_daily_hours,
      next.standard_work_days,
      next.overtime_multiplier,
      next.shift_start_minutes,
      next.shift_end_minutes,
      next.grace_minutes,
      next.work_days,
      next.is_configured,
      next.logo_path,
      nowIso()
    )

    logAudit(db, { actor, entity: "settings", entityId: "1", action: "updated" })
    return mapSettings(rawSettingsRow(db))
  })
}


function employeeRow(db, id) {
  return db.prepare("SELECT * FROM employees WHERE id = ?").get(String(id ?? ""))
}

function getEmployee(id) {
  const row = employeeRow(getDb(), id)
  return row ? mapEmployee(row) : null
}

function listEmployees({ includeInactive = false } = {}) {
  const sql = includeInactive
    ? "SELECT * FROM employees ORDER BY is_active DESC, full_name COLLATE NOCASE"
    : "SELECT * FROM employees WHERE is_active = 1 ORDER BY full_name COLLATE NOCASE"
  return getDb().prepare(sql).all().map(mapEmployee)
}

function listPublicEmployees() {
  return getDb()
    .prepare("SELECT id, full_name, employee_code, department FROM employees WHERE is_active = 1 ORDER BY full_name COLLATE NOCASE")
    .all()
    .map(row => ({
      id: row.id,
      fullName: row.full_name,
      employeeCode: row.employee_code,
      department: row.department ?? ""
    }))
}

function assertUniqueCode(db, employeeCode, excludeId) {
  const row = db
    .prepare("SELECT id FROM employees WHERE employee_code = ? AND id IS NOT ?")
    .get(employeeCode, excludeId ?? null)
  if (row) throw appError("employee_code_taken", "This employee code is already used.")
}

function saveEmployee(input = {}, actor) {
  return withTransaction(db => {
    const fullName = requireString(input.fullName, "employee_name_required", 120)
    const employeeCode = requireString(input.employeeCode, "employee_code_required", 40)
    const salaryType = SALARY_TYPES.includes(input.salaryType) ? input.salaryType : "custom"
    const baseRateMinor = toMinor(input.baseRateMinor)
    const phone = optionalString(input.phone, 40)
    const department = optionalString(input.department, 80)

    if (input.id) {
      const existing = employeeRow(db, input.id)
      if (!existing) throw appError("employee_not_found", "Employee not found.")
      assertUniqueCode(db, employeeCode, existing.id)

      db.prepare(`
        UPDATE employees SET full_name = ?, employee_code = ?, phone = ?, department = ?,
          salary_type = ?, base_rate_minor = ?, updated_at = ?
        WHERE id = ?
      `).run(fullName, employeeCode, phone, department, salaryType, baseRateMinor, nowIso(), existing.id)

      logAudit(db, {
        actor,
        entity: "employee",
        entityId: existing.id,
        action: "updated",
        details: { before: { fullName: existing.full_name, code: existing.employee_code, baseRateMinor: existing.base_rate_minor }, after: { fullName, employeeCode, baseRateMinor } }
      })
      return mapEmployee(employeeRow(db, existing.id))
    }

    assertUniqueCode(db, employeeCode, null)
    const id = newId("emp")
    db.prepare(`
      INSERT INTO employees (id, full_name, employee_code, phone, department, salary_type, base_rate_minor, is_active, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?)
    `).run(id, fullName, employeeCode, phone, department, salaryType, baseRateMinor, nowIso(), nowIso())

    logAudit(db, { actor, entity: "employee", entityId: id, action: "created" })
    return mapEmployee(employeeRow(db, id))
  })
}

function setEmployeeActive(id, isActive, actor) {
  return withTransaction(db => {
    const existing = employeeRow(db, id)
    if (!existing) throw appError("employee_not_found", "Employee not found.")
    db.prepare("UPDATE employees SET is_active = ?, updated_at = ? WHERE id = ?")
      .run(toBoolean(isActive) ? 1 : 0, nowIso(), existing.id)
    logAudit(db, {
      actor,
      entity: "employee",
      entityId: existing.id,
      action: toBoolean(isActive) ? "activated" : "deactivated"
    })
    return mapEmployee(employeeRow(db, existing.id))
  })
}

function deleteEmployee(id, actor) {
  return withTransaction(db => {
    const existing = employeeRow(db, id)
    if (!existing) throw appError("employee_not_found", "Employee not found.")

    const payslips = db.prepare("SELECT COUNT(*) AS total FROM payslips WHERE employee_id = ?").get(existing.id).total
    const attendance = db.prepare("SELECT COUNT(*) AS total FROM attendance_records WHERE employee_id = ?").get(existing.id).total
    if (Number(payslips) > 0 || Number(attendance) > 0) {
      throw appError("employee_has_history", "Employees with payroll or attendance history cannot be deleted.")
    }

    db.prepare("DELETE FROM employees WHERE id = ?").run(existing.id)
    logAudit(db, { actor, entity: "employee", entityId: existing.id, action: "deleted", details: { fullName: existing.full_name } })
    return { id: existing.id }
  })
}


function breaksFor(db, attendanceIds) {
  if (attendanceIds.length === 0) return new Map()
  const placeholders = attendanceIds.map(() => "?").join(", ")
  const rows = db
    .prepare(`SELECT * FROM break_logs WHERE attendance_id IN (${placeholders}) ORDER BY break_start_at`)
    .all(...attendanceIds)

  const grouped = new Map()
  for (const row of rows) {
    const list = grouped.get(row.attendance_id) ?? []
    list.push(mapBreak(row))
    grouped.set(row.attendance_id, list)
  }
  return grouped
}

function attendanceWhere({ employeeId, fromDate, toDate } = {}) {
  const clauses = []
  const params = []
  if (employeeId) {
    clauses.push("a.employee_id = ?")
    params.push(String(employeeId))
  }
  if (fromDate) {
    clauses.push("a.record_date >= ?")
    params.push(assertDateKey(fromDate, "invalid_date"))
  }
  if (toDate) {
    clauses.push("a.record_date <= ?")
    params.push(assertDateKey(toDate, "invalid_date"))
  }
  return { where: clauses.length ? `WHERE ${clauses.join(" AND ")}` : "", params }
}

const ATTENDANCE_PAGE_SIZE = 50
const MAX_PAGE_SIZE = 200

function resolvePage({ page, pageSize, limit, offset } = {}, fallbackSize = ATTENDANCE_PAGE_SIZE) {
  const size = toInteger(pageSize ?? limit, { min: 1, max: MAX_PAGE_SIZE, fallback: fallbackSize })
  const pageNumber = toInteger(page, { min: 1, max: 1_000_000, fallback: 1 })
  const skip = toInteger(offset !== undefined ? offset : (pageNumber - 1) * size, {
    min: 0,
    max: 100_000_000,
    fallback: 0
  })
  return { limit: size, offset: skip, page: Math.floor(skip / size) + 1, pageSize: size }
}

function attendanceQuery(db, filter = {}) {
  const { employeeId, fromDate, toDate, page, pageSize, limit, offset } = filter
  const { where, params } = attendanceWhere({ employeeId, fromDate, toDate })
  const paged = page !== undefined || pageSize !== undefined || limit !== undefined || offset !== undefined
  const paging = paged ? resolvePage({ page, pageSize, limit, offset }) : null

  const rows = db
    .prepare(`
      SELECT a.*, e.full_name AS employee_name
      FROM attendance_records a
      JOIN employees e ON e.id = a.employee_id
      ${where}
      ORDER BY a.record_date DESC, a.punch_in_at DESC
      ${paging ? "LIMIT ? OFFSET ?" : ""}
    `)
    .all(...params, ...(paging ? [paging.limit, paging.offset] : []))

  const breaks = breaksFor(db, rows.map(row => row.id))
  const now = Date.now()
  return rows.map(row => mapAttendance(row, breaks.get(row.id) ?? [], now))
}

function listAttendance(filter = {}) {
  return attendanceQuery(getDb(), filter)
}

function countAttendance(filter = {}) {
  const { where, params } = attendanceWhere(filter)
  const row = getDb()
    .prepare(`
      SELECT COUNT(*) AS total
      FROM attendance_records a
      JOIN employees e ON e.id = a.employee_id
      ${where}
    `)
    .get(...params)
  return Number(row?.total ?? 0)
}

function attendancePage(filter = {}, { withCount = true } = {}) {
  const paging = resolvePage(filter)
  return {
    rows: attendanceQuery(getDb(), { ...filter, ...paging }),
    total: withCount ? countAttendance(filter) : null,
    page: paging.page,
    pageSize: paging.pageSize
  }
}

function todayRecords(employeeId) {
  const today = time.localDateKey()
  return listAttendance({ employeeId, fromDate: today, toDate: today })
}

function findOpenRecord(db, employeeId) {
  const row = db
    .prepare(`
      SELECT * FROM attendance_records
      WHERE employee_id = ? AND punch_in_at IS NOT NULL AND punch_out_at IS NULL
      ORDER BY punch_in_at DESC LIMIT 1
    `)
    .get(String(employeeId))
  if (!row) throw appError("no_active_shift", "There is no open shift for this employee.")
  return row
}

function recordById(db, id) {
  return db.prepare("SELECT * FROM attendance_records WHERE id = ?").get(String(id ?? ""))
}

function attendanceResult(db, id) {
  const row = recordById(db, id)
  const breaks = breaksFor(db, [row.id]).get(row.id) ?? []
  return mapAttendance(row, breaks)
}

function punchIn(employeeId, { now = Date.now(), actor } = {}) {
  return withTransaction(db => {
    const employee = employeeRow(db, employeeId)
    if (!employee) throw appError("employee_not_found", "Employee not found.")
    if (!Number(employee.is_active)) throw appError("employee_inactive", "Employee is not active.")

    const recordDate = time.localDateKey(now)
    const existing = db
      .prepare("SELECT * FROM attendance_records WHERE employee_id = ? AND record_date = ?")
      .get(employee.id, recordDate)

    if (existing) {
      if (existing.punch_out_at !== null) {
        throw appError("attendance_already_completed", "Today's shift is already closed.")
      }
      return attendanceResult(db, existing.id)
    }

    const id = newId("att")
    const stamp = nowIso()
    const schedule = shiftSettings(db)
    const lateMinutes = shift.isWorkingDay(recordDate, schedule.workDays)
      ? shift.lateMinutesFor({
        punchInAt: now,
        recordDate,
        shiftStartMinutes: schedule.shiftStartMinutes,
        graceMinutes: schedule.graceMinutes
      })
      : 0

    db.prepare(`
      INSERT INTO attendance_records
        (id, employee_id, record_date, punch_in_at, punch_out_at, break_minutes, net_minutes, status, notes, created_at, updated_at, late_minutes, early_leave_minutes)
      VALUES (?, ?, ?, ?, NULL, 0, 0, 'present', '', ?, ?, ?, 0)
    `).run(id, employee.id, recordDate, now, stamp, stamp, lateMinutes)

    logAudit(db, { actor: actor || "kiosk", entity: "attendance", entityId: id, action: "punch_in" })
    return attendanceResult(db, id)
  })
}

function startBreak(employeeId, { now = Date.now(), actor } = {}) {
  return withTransaction(db => {
    const record = findOpenRecord(db, employeeId)
    const openBreak = db
      .prepare("SELECT * FROM break_logs WHERE attendance_id = ? AND break_end_at IS NULL")
      .get(record.id)
    if (openBreak) throw appError("break_already_open", "A break is already running.")

    db.prepare(`
      INSERT INTO break_logs (id, attendance_id, break_start_at, break_end_at, duration_minutes)
      VALUES (?, ?, ?, NULL, 0)
    `).run(newId("brk"), record.id, now)

    db.prepare("UPDATE attendance_records SET status = 'on_break', updated_at = ? WHERE id = ?")
      .run(nowIso(), record.id)

    logAudit(db, { actor: actor || "kiosk", entity: "attendance", entityId: record.id, action: "break_start" })
    return attendanceResult(db, record.id)
  })
}

function closeOpenBreak(db, attendanceId, now) {
  const openBreak = db
    .prepare("SELECT * FROM break_logs WHERE attendance_id = ? AND break_end_at IS NULL")
    .get(attendanceId)
  if (!openBreak) return null

  const duration = time.minutesBetween(Number(openBreak.break_start_at), now)
  db.prepare("UPDATE break_logs SET break_end_at = ?, duration_minutes = ? WHERE id = ?")
    .run(now, duration, openBreak.id)
  return { id: openBreak.id, duration }
}

function sumBreakMinutes(db, attendanceId) {
  const row = db
    .prepare("SELECT COALESCE(SUM(duration_minutes), 0) AS total FROM break_logs WHERE attendance_id = ?")
    .get(attendanceId)
  return Number(row?.total ?? 0)
}

function endBreak(employeeId, { now = Date.now(), actor } = {}) {
  return withTransaction(db => {
    const record = findOpenRecord(db, employeeId)
    const closed = closeOpenBreak(db, record.id, now)
    if (!closed) throw appError("no_open_break", "There is no running break.")

    const breakMinutes = sumBreakMinutes(db, record.id)
    db.prepare("UPDATE attendance_records SET break_minutes = ?, status = 'present', updated_at = ? WHERE id = ?")
      .run(breakMinutes, nowIso(), record.id)

    logAudit(db, { actor: actor || "kiosk", entity: "attendance", entityId: record.id, action: "break_end" })
    return attendanceResult(db, record.id)
  })
}

function punchOut(employeeId, { now = Date.now(), actor } = {}) {
  return withTransaction(db => {
    const record = findOpenRecord(db, employeeId)
    if (now < Number(record.punch_in_at)) throw appError("invalid_time_range", "Punch-out time is before punch-in.")

    closeOpenBreak(db, record.id, now)

    const breakMinutes = sumBreakMinutes(db, record.id)
    const grossMinutes = time.minutesBetween(Number(record.punch_in_at), now)
    const netMinutes = Math.max(0, grossMinutes - breakMinutes)

    const schedule = shiftSettings(db)
    const workingDay = shift.isWorkingDay(record.record_date, schedule.workDays)
    const lateMinutes = workingDay
      ? shift.lateMinutesFor({
        punchInAt: Number(record.punch_in_at),
        recordDate: record.record_date,
        shiftStartMinutes: schedule.shiftStartMinutes,
        graceMinutes: schedule.graceMinutes
      })
      : 0
    const earlyLeaveMinutes = workingDay
      ? shift.earlyLeaveMinutesFor({
        punchOutAt: now,
        recordDate: record.record_date,
        shiftEndMinutes: schedule.shiftEndMinutes,
        graceMinutes: schedule.graceMinutes
      })
      : 0

    db.prepare(`
      UPDATE attendance_records
      SET punch_out_at = ?, break_minutes = ?, net_minutes = ?, status = 'completed',
          late_minutes = ?, early_leave_minutes = ?, updated_at = ?
      WHERE id = ?
    `).run(now, breakMinutes, netMinutes, lateMinutes, earlyLeaveMinutes, nowIso(), record.id)

    logAudit(db, {
      actor: actor || "kiosk",
      entity: "attendance",
      entityId: record.id,
      action: "punch_out",
      details: { netMinutes, breakMinutes }
    })
    return attendanceResult(db, record.id)
  })
}

function correctAttendance(recordId, patch = {}, actor) {
  return withTransaction(db => {
    const existing = recordById(db, recordId)
    if (!existing) throw appError("attendance_not_found", "Attendance record not found.")

    const hasIn = patch.punchInAt !== undefined ? patch.punchInAt !== null : existing.punch_in_at !== null
    const punchInAt = hasIn
      ? toInteger(patch.punchInAt ?? existing.punch_in_at, { min: 0, max: 4_102_444_800_000 })
      : null

    const hasOut = patch.punchOutAt !== undefined ? patch.punchOutAt !== null : existing.punch_out_at !== null
    const punchOutAt = hasOut
      ? toInteger(patch.punchOutAt ?? existing.punch_out_at, { min: 0, max: 4_102_444_800_000 })
      : null

    if (!punchInAt && punchOutAt) throw appError("invalid_time_range", "Punch-out requires a punch-in time.")
    if (punchInAt && punchOutAt && punchOutAt <= punchInAt) {
      throw appError("invalid_time_range", "Punch-out must be after punch-in.")
    }

    const breakMinutes = toInteger(
      patch.breakMinutes !== undefined ? patch.breakMinutes : existing.break_minutes,
      { min: 0, max: 24 * 60, fallback: Number(existing.break_minutes ?? 0) }
    )

    const netMinutes = punchInAt && punchOutAt
      ? Math.max(0, time.minutesBetween(punchInAt, punchOutAt) - breakMinutes)
      : 0

    const status = punchOutAt ? "completed" : punchInAt ? "present" : "absent"

    const schedule = shiftSettings(db)
    const workingDay = shift.isWorkingDay(existing.record_date, schedule.workDays)
    const lateMinutes = workingDay && punchInAt
      ? shift.lateMinutesFor({
        punchInAt,
        recordDate: existing.record_date,
        shiftStartMinutes: schedule.shiftStartMinutes,
        graceMinutes: schedule.graceMinutes
      })
      : 0
    const earlyLeaveMinutes = workingDay && punchOutAt
      ? shift.earlyLeaveMinutesFor({
        punchOutAt,
        recordDate: existing.record_date,
        shiftEndMinutes: schedule.shiftEndMinutes,
        graceMinutes: schedule.graceMinutes
      })
      : 0

    db.prepare("DELETE FROM break_logs WHERE attendance_id = ?").run(existing.id)
    db.prepare(`
      UPDATE attendance_records
      SET punch_in_at = ?, punch_out_at = ?, break_minutes = ?, net_minutes = ?, status = ?, notes = ?,
          late_minutes = ?, early_leave_minutes = ?, updated_at = ?
      WHERE id = ?
    `).run(
      punchInAt,
      punchOutAt,
      breakMinutes,
      netMinutes,
      status,
      patch.notes !== undefined ? optionalString(patch.notes, 500) : existing.notes,
      lateMinutes,
      earlyLeaveMinutes,
      nowIso(),
      existing.id
    )

    logAudit(db, {
      actor,
      entity: "attendance",
      entityId: existing.id,
      action: "corrected",
      details: {
        before: { punchInAt: existing.punch_in_at, punchOutAt: existing.punch_out_at, breakMinutes: existing.break_minutes },
        after: { punchInAt, punchOutAt, breakMinutes, netMinutes }
      }
    })

    return attendanceResult(db, existing.id)
  })
}

function deleteAttendance(recordId, actor) {
  return withTransaction(db => {
    const existing = recordById(db, recordId)
    if (!existing) throw appError("attendance_not_found", "Attendance record not found.")
    db.prepare("DELETE FROM attendance_records WHERE id = ?").run(existing.id)
    logAudit(db, {
      actor,
      entity: "attendance",
      entityId: existing.id,
      action: "deleted",
      details: { recordDate: existing.record_date, employeeId: existing.employee_id }
    })
    return { id: existing.id }
  })
}

function aggregateAttendance({ employeeId, fromDate, toDate, dailyHours = 8 } = {}) {
  const { where, params } = attendanceWhere({ employeeId, fromDate, toDate })
  const contracted = Math.max(0, Math.round((Number(dailyHours) || 0) * 60))

  const row = getDb()
    .prepare(`
      SELECT
        COUNT(*) AS total,
        SUM(CASE WHEN a.punch_out_at IS NOT NULL THEN 1 ELSE 0 END) AS worked_days,
        SUM(CASE WHEN a.punch_out_at IS NOT NULL THEN a.net_minutes ELSE 0 END) AS worked_minutes,
        SUM(CASE WHEN a.punch_out_at IS NOT NULL THEN a.break_minutes ELSE 0 END) AS break_minutes,
        SUM(CASE WHEN a.punch_out_at IS NOT NULL AND a.net_minutes > ? THEN a.net_minutes - ? ELSE 0 END) AS overtime_minutes,
        SUM(CASE WHEN a.punch_in_at IS NOT NULL AND a.punch_out_at IS NULL THEN 1 ELSE 0 END) AS open_records,
        MIN(a.record_date) AS first_date,
        MAX(a.record_date) AS last_date
      FROM attendance_records a
      JOIN employees e ON e.id = a.employee_id
      ${where}
    `)
    .get(contracted, contracted, ...params)

  return {
    workedDays: Number(row?.worked_days ?? 0),
    workedMinutes: Number(row?.worked_minutes ?? 0),
    breakMinutes: Number(row?.break_minutes ?? 0),
    overtimeMinutes: Number(row?.overtime_minutes ?? 0),
    openRecords: Number(row?.open_records ?? 0),
    totalRecords: Number(row?.total ?? 0),
    firstDate: row?.first_date ?? null,
    lastDate: row?.last_date ?? null
  }
}



function monthKeysEndingAt(today, months = 6) {
  assertDateKey(today, "Today")
  const safeMonths = Math.min(24, Math.max(1, Math.round(Number(months) || 6)))
  const [year, month] = today.split("-").map(Number)
  const keys = []
  for (let offset = safeMonths - 1; offset >= 0; offset -= 1) {
    const date = new Date(year, month - 1 - offset, 1)
    keys.push(`${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`)
  }
  return keys
}


function absenceSummary({
  expectedDays = 0,
  presentDays = 0,
  leaveDays = 0,
  activeEmployees = 0,
  workingDays = 0,
  workDaysPerWeek = 0
} = {}) {
  const toCount = value => Math.max(0, Math.round(Number(value) || 0))
  const expected = toCount(expectedDays)
  const present = toCount(presentDays)
  const leave = toCount(leaveDays)
  const absent = Math.max(0, expected - present - leave)
  const rate = expected > 0 ? Math.round((absent / expected) * 1000) / 1000 : 0
  return {
    expectedDays: expected,
    presentDays: present,
    leaveDays: leave,
    absentDays: absent,
    rate,
    activeEmployees: toCount(activeEmployees),
    workingDays: toCount(workingDays),
    workDaysPerWeek: toCount(workDaysPerWeek),
    hasData: expected > 0 && present + leave > 0
  }
}


function sumDepartmentCosts(rows = []) {
  return rows.reduce(
    (total, row) => ({
      employees: total.employees + Number(row.employees ?? 0),
      slips: total.slips + Number(row.slips ?? 0),
      netAmountMinor: total.netAmountMinor + Number(row.netAmountMinor ?? 0),
      overtimeAmountMinor: total.overtimeAmountMinor + Number(row.overtimeAmountMinor ?? 0),
      overtimeMinutes: total.overtimeMinutes + Number(row.overtimeMinutes ?? 0),
      workedMinutes: total.workedMinutes + Number(row.workedMinutes ?? 0)
    }),
    { employees: 0, slips: 0, netAmountMinor: 0, overtimeAmountMinor: 0, overtimeMinutes: 0, workedMinutes: 0 }
  )
}

function dashboardInsights({ today = time.localDateKey(), months = 6 } = {}) {
  const db = getDb()
  const settings = shiftSettings(db)
  const monthKeys = monthKeysEndingAt(today, months)
  const safeMonths = monthKeys.length
  const rangeStart = `${monthKeys[0]}-01`
  const currentMonthStart = `${monthKeys[monthKeys.length - 1]}-01`
  const departmentExpr = "COALESCE(NULLIF(TRIM(p.department), ''), '-')"

  const departmentCosts = db
    .prepare(
      `
      SELECT
        ${departmentExpr} AS department,
        COUNT(DISTINCT p.employee_id) AS employees,
        COUNT(*) AS slips,
        SUM(p.net_amount_minor) AS net_amount_minor,
        SUM(p.overtime_amount_minor) AS overtime_amount_minor,
        SUM(p.overtime_minutes) AS overtime_minutes,
        SUM(p.worked_minutes) AS worked_minutes
      FROM payslips p
      WHERE p.period_start >= ? AND p.period_start <= ?
      GROUP BY ${departmentExpr}
      ORDER BY net_amount_minor DESC, department ASC
    `
    )
    .all(rangeStart, today)
    .map(row => ({
      department: String(row.department ?? "-"),
      employees: Number(row.employees ?? 0),
      slips: Number(row.slips ?? 0),
      netAmountMinor: Number(row.net_amount_minor ?? 0),
      overtimeAmountMinor: Number(row.overtime_amount_minor ?? 0),
      overtimeMinutes: Number(row.overtime_minutes ?? 0),
      workedMinutes: Number(row.worked_minutes ?? 0)
    }))

  const overtimeByMonth = new Map(
    db
      .prepare(
        `
        SELECT
          substr(p.period_start, 1, 7) AS month_key,
          SUM(p.overtime_minutes) AS overtime_minutes,
          SUM(p.overtime_amount_minor) AS overtime_amount_minor
        FROM payslips p
        WHERE p.period_start >= ? AND p.period_start <= ?
        GROUP BY month_key
      `
      )
      .all(rangeStart, today)
      .map(row => [
        String(row.month_key),
        {
          overtimeMinutes: Number(row.overtime_minutes ?? 0),
          overtimeAmountMinor: Number(row.overtime_amount_minor ?? 0)
        }
      ])
  )

  const overtimeTrend = monthKeys.map(monthKey => ({
    monthKey,
    overtimeMinutes: overtimeByMonth.get(monthKey)?.overtimeMinutes ?? 0,
    overtimeAmountMinor: overtimeByMonth.get(monthKey)?.overtimeAmountMinor ?? 0
  }))

  const payrollByMonth = new Map(
    db
      .prepare(
        `
        SELECT substr(p.period_start, 1, 7) AS month_key, SUM(p.net_amount_minor) AS net_amount_minor
        FROM payslips p
        WHERE p.period_start >= ? AND p.period_start <= ?
        GROUP BY month_key
      `
      )
      .all(rangeStart, today)
      .map(row => [String(row.month_key), Number(row.net_amount_minor ?? 0)])
  )

  const payrollTrend = monthKeys.map(monthKey => ({
    monthKey,
    netAmountMinor: payrollByMonth.get(monthKey) ?? 0
  }))

  const hoursByEmployee = db
    .prepare(
      `
      SELECT
        a.employee_id AS id,
        e.full_name AS name,
        e.employee_code AS code,
        COALESCE(e.department, '') AS department,
        SUM(CASE WHEN a.punch_out_at IS NOT NULL THEN a.net_minutes ELSE 0 END) AS minutes
      FROM attendance_records a
      JOIN employees e ON e.id = a.employee_id
      WHERE a.record_date >= ? AND a.record_date <= ? AND e.is_active = 1
      GROUP BY a.employee_id
      HAVING SUM(CASE WHEN a.punch_out_at IS NOT NULL THEN a.net_minutes ELSE 0 END) > 0
      ORDER BY minutes DESC
      LIMIT 10
    `
    )
    .all(currentMonthStart, today)
    .map(row => ({
      id: String(row.id),
      name: String(row.name ?? ""),
      code: String(row.code ?? ""),
      department: String(row.department ?? ""),
      minutes: Number(row.minutes ?? 0)
    }))

  const activeEmployees = Number(
    db.prepare("SELECT COUNT(*) AS n FROM employees WHERE is_active = 1").get()?.n ?? 0
  )
  const workingDays = shift.workingDayKeys(currentMonthStart, today, settings.workDays).length
  const expectedDays = workingDays * activeEmployees
  const presentDays = Number(
    db
      .prepare(
        `
        SELECT COUNT(*) AS n FROM (
          SELECT a.employee_id, a.record_date
          FROM attendance_records a
          JOIN employees e ON e.id = a.employee_id
          WHERE a.record_date >= ? AND a.record_date <= ? AND a.punch_in_at IS NOT NULL AND e.is_active = 1
          GROUP BY a.employee_id, a.record_date
        )
      `
      )
      .get(currentMonthStart, today)?.n ?? 0
  )

  const leaveRows = db
    .prepare(
      `
      SELECT l.employee_id AS employee_id, l.start_date AS start_date, l.end_date AS end_date
      FROM leaves l
      JOIN employees e ON e.id = l.employee_id
      WHERE e.is_active = 1 AND l.start_date <= ? AND l.end_date >= ?
    `
    )
    .all(today, currentMonthStart)
  const leaveDates = new Set()
  for (const row of leaveRows) {
    const startKey = String(row.start_date) < currentMonthStart ? currentMonthStart : String(row.start_date)
    const endKey = String(row.end_date) > today ? today : String(row.end_date)
    for (const key of shift.workingDayKeys(startKey, endKey, settings.workDays)) {
      leaveDates.add(`${row.employee_id}|${key}`)
    }
  }

  const leaveDays = leaveDates.size
  const absence = absenceSummary({
    expectedDays,
    presentDays,
    leaveDays,
    activeEmployees,
    workingDays,
    workDaysPerWeek: settings.workDays.length
  })

  return {
    generatedAt: new Date().toISOString(),
    range: { fromDate: rangeStart, toDate: today, monthStart: currentMonthStart, months: safeMonths },
    departmentCosts,
    overtimeTrend,
    payrollTrend,
    hoursByEmployee,
    departmentCostsTotal: sumDepartmentCosts(departmentCosts),
    absence
  }
}

function leaveQuery(db, { employeeId, fromDate, toDate } = {}) {
  const clauses = []
  const params = []
  if (employeeId) {
    clauses.push("l.employee_id = ?")
    params.push(String(employeeId))
  }
  if (fromDate) {
    clauses.push("l.end_date >= ?")
    params.push(assertDateKey(fromDate, "invalid_date"))
  }
  if (toDate) {
    clauses.push("l.start_date <= ?")
    params.push(assertDateKey(toDate, "invalid_date"))
  }
  const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : ""
  return db
    .prepare(`
      SELECT l.*, e.full_name AS employee_name
      FROM leaves l
      JOIN employees e ON e.id = l.employee_id
      ${where}
      ORDER BY l.start_date DESC
    `)
    .all(...params)
    .map(mapLeave)
}

function listLeaves(filter = {}) {
  return leaveQuery(getDb(), filter)
}

function saveLeave(input = {}, actor) {
  return withTransaction(db => {
    const employee = employeeRow(db, input.employeeId)
    if (!employee) throw appError("employee_not_found", "Employee not found.")

    const leaveType = LEAVE_TYPES.includes(input.leaveType) ? input.leaveType : "unpaid"
    const startDate = assertDateKey(input.startDate, "invalid_date")
    const endDate = assertDateKey(input.endDate, "invalid_date")
    if (endDate < startDate) throw appError("invalid_date_range", "End date is before start date.")

    const days = time.inclusiveDayCount(startDate, endDate)
    if (days < 1) throw appError("invalid_date_range", "Invalid leave range.")

    const isPaid = input.isPaid !== undefined ? toBoolean(input.isPaid) : leaveType === "paid" || leaveType === "sick"
    const reason = optionalString(input.reason, 300)

    if (input.id) {
      const existing = db.prepare("SELECT * FROM leaves WHERE id = ?").get(String(input.id))
      if (!existing) throw appError("leave_not_found", "Leave record not found.")
      db.prepare(`
        UPDATE leaves SET employee_id = ?, leave_type = ?, start_date = ?, end_date = ?, days = ?, is_paid = ?, reason = ?, updated_at = ?
        WHERE id = ?
      `).run(employee.id, leaveType, startDate, endDate, days, isPaid ? 1 : 0, reason, nowIso(), existing.id)
      logAudit(db, { actor, entity: "leave", entityId: existing.id, action: "updated" })
      return mapLeave(db.prepare("SELECT l.*, e.full_name AS employee_name FROM leaves l JOIN employees e ON e.id = l.employee_id WHERE l.id = ?").get(existing.id))
    }

    const id = newId("lev")
    db.prepare(`
      INSERT INTO leaves (id, employee_id, leave_type, start_date, end_date, days, is_paid, reason, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, employee.id, leaveType, startDate, endDate, days, isPaid ? 1 : 0, reason, nowIso(), nowIso())
    logAudit(db, { actor, entity: "leave", entityId: id, action: "created", details: { leaveType, startDate, endDate, days } })
    return mapLeave(db.prepare("SELECT l.*, e.full_name AS employee_name FROM leaves l JOIN employees e ON e.id = l.employee_id WHERE l.id = ?").get(id))
  })
}

function deleteLeave(id, actor) {
  return withTransaction(db => {
    const existing = db.prepare("SELECT * FROM leaves WHERE id = ?").get(String(id ?? ""))
    if (!existing) throw appError("leave_not_found", "Leave record not found.")
    db.prepare("DELETE FROM leaves WHERE id = ?").run(existing.id)
    logAudit(db, { actor, entity: "leave", entityId: existing.id, action: "deleted" })
    return { id: existing.id }
  })
}

function unpaidLeaveDaysInRange(employeeId, fromDate, toDate) {
  const rows = getDb()
    .prepare("SELECT start_date, end_date FROM leaves WHERE employee_id = ? AND is_paid = 0 AND end_date >= ? AND start_date <= ?")
    .all(String(employeeId), assertDateKey(fromDate, "invalid_date"), assertDateKey(toDate, "invalid_date"))
  return rows.reduce((total, row) => total + time.overlapDayCount(fromDate, toDate, row.start_date, row.end_date), 0)
}


function payslipWhere({ employeeId, fromDate, toDate, search } = {}) {
  const clauses = []
  const params = []
  const term = typeof search === "string" ? search.trim() : ""
  if (term) {
    const like = `%${term.replace(/[%_\\]/g, match => `\\${match}`)}%`
    clauses.push(
      "(number LIKE ? ESCAPE '\\' OR employee_name LIKE ? ESCAPE '\\' OR employee_code LIKE ? ESCAPE '\\' OR period_start LIKE ? ESCAPE '\\' OR period_end LIKE ? ESCAPE '\\')"
    )
    params.push(like, like, like, like, like)
  }
  if (employeeId) {
    clauses.push("employee_id = ?")
    params.push(String(employeeId))
  }
  if (fromDate) {
    clauses.push("period_end >= ?")
    params.push(assertDateKey(fromDate, "invalid_date"))
  }
  if (toDate) {
    clauses.push("period_start <= ?")
    params.push(assertDateKey(toDate, "invalid_date"))
  }
  return { where: clauses.length ? `WHERE ${clauses.join(" AND ")}` : "", params }
}

function payslipQuery(db, filter = {}) {
  const { employeeId, fromDate, toDate, search, page, pageSize, limit, offset } = filter
  const { where, params } = payslipWhere({ employeeId, fromDate, toDate, search })
  const paged = page !== undefined || pageSize !== undefined || limit !== undefined || offset !== undefined
  const paging = paged ? resolvePage({ page, pageSize, limit, offset }) : null
  return db
    .prepare(
      `SELECT * FROM payslips ${where} ORDER BY period_end DESC, created_at DESC ${paging ? "LIMIT ? OFFSET ?" : ""}`
    )
    .all(...params, ...(paging ? [paging.limit, paging.offset] : []))
    .map(mapPayslip)
}

function listPayslips(filter = {}) {
  return payslipQuery(getDb(), filter)
}

function countPayslips(filter = {}) {
  const { where, params } = payslipWhere(filter)
  return Number(getDb().prepare(`SELECT COUNT(*) AS total FROM payslips ${where}`).get(...params)?.total ?? 0)
}

function payslipsPage(filter = {}, { withCount = true } = {}) {
  const paging = resolvePage(filter)
  return {
    rows: payslipQuery(getDb(), { ...filter, ...paging }),
    total: withCount ? countPayslips(filter) : null,
    page: paging.page,
    pageSize: paging.pageSize
  }
}

function nextPayslipNumber(db, year) {
  const prefix = `PS-${year}-`
  const row = db
    .prepare("SELECT number FROM payslips WHERE number LIKE ? ORDER BY number DESC LIMIT 1")
    .get(`${prefix}%`)
  const last = row ? Number(String(row.number).slice(prefix.length)) : 0
  const next = Number.isFinite(last) ? last + 1 : 1
  return `${prefix}${String(next).padStart(4, "0")}`
}

function savePayslip(input = {}, actor) {
  return withTransaction(db => {
    const employee = employeeRow(db, input.employeeId)
    if (!employee) throw appError("employee_not_found", "Employee not found.")

    const periodStart = assertDateKey(input.periodStart, "invalid_date")
    const periodEnd = assertDateKey(input.periodEnd, "invalid_date")
    if (periodEnd < periodStart) throw appError("invalid_date_range", "End date is before start date.")

    const baseSalaryMinor = toMinor(input.baseSalaryMinor)
    const overtimeAmountMinor = toMinor(input.overtimeAmountMinor)
    const bonusesMinor = toMinor(input.bonusesMinor)
    const deductionsMinor = toMinor(input.deductionsMinor)
    const netAmountMinor = Math.max(0, baseSalaryMinor + overtimeAmountMinor + bonusesMinor - deductionsMinor)

    const paymentMethod = PAYMENT_METHODS.includes(input.paymentMethod) ? input.paymentMethod : "bank_transfer"
    const paymentDate = input.paymentDate ? assertDateKey(input.paymentDate, "invalid_date") : ""
    const notes = optionalString(input.notes, 500)

    if (input.id) {
      const existing = db.prepare("SELECT * FROM payslips WHERE id = ?").get(String(input.id))
      if (!existing) throw appError("payslip_not_found", "Payslip not found.")
      db.prepare(`
        UPDATE payslips SET
          period_start = ?, period_end = ?, worked_days = ?, worked_minutes = ?, break_minutes = ?,
          overtime_minutes = ?, unpaid_leave_days = ?, base_salary_minor = ?, overtime_amount_minor = ?,
          bonuses_minor = ?, deductions_minor = ?, net_amount_minor = ?, payment_date = ?, payment_method = ?,
          notes = ?, updated_at = ?
        WHERE id = ?
      `).run(
        periodStart,
        periodEnd,
        toInteger(input.workedDays, { min: 0, max: 366 }),
        toInteger(input.workedMinutes, { min: 0, max: 366 * 24 * 60 }),
        toInteger(input.breakMinutes, { min: 0, max: 366 * 24 * 60 }),
        toInteger(input.overtimeMinutes, { min: 0, max: 366 * 24 * 60 }),
        toInteger(input.unpaidLeaveDays, { min: 0, max: 366 }),
        baseSalaryMinor,
        overtimeAmountMinor,
        bonusesMinor,
        deductionsMinor,
        netAmountMinor,
        paymentDate,
        paymentMethod,
        notes,
        nowIso(),
        existing.id
      )
      logAudit(db, { actor, entity: "payslip", entityId: existing.id, action: "updated", details: { netAmountMinor } })
      return mapPayslip(db.prepare("SELECT * FROM payslips WHERE id = ?").get(existing.id))
    }

    const duplicate = db
      .prepare("SELECT number FROM payslips WHERE employee_id = ? AND period_start = ? AND period_end = ?")
      .get(employee.id, periodStart, periodEnd)
    if (duplicate) {
      throw appError(
        "payslip_period_exists",
        `A payslip (${duplicate.number}) already exists for this employee and period.`
      )
    }

    const id = newId("ps")
    const number = nextPayslipNumber(db, Number(periodEnd.slice(0, 4)))
    const insert = db.prepare(`
      INSERT INTO payslips (
        id, number, employee_id, employee_name, employee_code, department, salary_type, base_rate_minor,
        period_start, period_end, worked_days, worked_minutes, break_minutes, overtime_minutes, unpaid_leave_days,
        base_salary_minor, overtime_amount_minor, bonuses_minor, deductions_minor, net_amount_minor,
        payment_date, payment_method, notes, is_signed, signed_at, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, NULL, ?, ?)
    `)
    const createdAt = nowIso()
    const insertArgs = [
      id,
      number,
      employee.id,
      employee.full_name,
      employee.employee_code,
      employee.department,
      employee.salary_type,
      Number(employee.base_rate_minor),
      periodStart,
      periodEnd,
      toInteger(input.workedDays, { min: 0, max: 366 }),
      toInteger(input.workedMinutes, { min: 0, max: 366 * 24 * 60 }),
      toInteger(input.breakMinutes, { min: 0, max: 366 * 24 * 60 }),
      toInteger(input.overtimeMinutes, { min: 0, max: 366 * 24 * 60 }),
      toInteger(input.unpaidLeaveDays, { min: 0, max: 366 }),
      baseSalaryMinor,
      overtimeAmountMinor,
      bonusesMinor,
      deductionsMinor,
      netAmountMinor,
      paymentDate,
      paymentMethod,
      notes,
      createdAt,
      createdAt
    ]

    try {
      insert.run(...insertArgs)
    } catch (error) {
      if (/UNIQUE constraint failed/i.test(String(error?.message ?? ""))) {
        throw appError("payslip_period_exists", "A payslip already exists for this employee and period.")
      }
      throw error
    }

    logAudit(db, { actor, entity: "payslip", entityId: id, action: "created", details: { number, netAmountMinor } })
    return mapPayslip(db.prepare("SELECT * FROM payslips WHERE id = ?").get(id))
  })
}

function setPayslipSigned(id, isSigned, actor) {
  return withTransaction(db => {
    const existing = db.prepare("SELECT * FROM payslips WHERE id = ?").get(String(id ?? ""))
    if (!existing) throw appError("payslip_not_found", "Payslip not found.")
    const signed = toBoolean(isSigned)
    db.prepare("UPDATE payslips SET is_signed = ?, signed_at = ?, updated_at = ? WHERE id = ?")
      .run(signed ? 1 : 0, signed ? nowIso() : null, nowIso(), existing.id)
    logAudit(db, { actor, entity: "payslip", entityId: existing.id, action: signed ? "signed" : "unsigned" })
    return mapPayslip(db.prepare("SELECT * FROM payslips WHERE id = ?").get(existing.id))
  })
}

function deletePayslip(id, actor) {
  return withTransaction(db => {
    const existing = db.prepare("SELECT * FROM payslips WHERE id = ?").get(String(id ?? ""))
    if (!existing) throw appError("payslip_not_found", "Payslip not found.")
    db.prepare("DELETE FROM payslips WHERE id = ?").run(existing.id)
    logAudit(db, { actor, entity: "payslip", entityId: existing.id, action: "deleted", details: { number: existing.number } })
    return { id: existing.id }
  })
}


function employeeStartKey(row) {
  const created = String(row?.created_at ?? "").slice(0, 10)
  return time.isValidDateKey(created) ? created : ""
}

function periodRange(fromDate, toDate) {
  const from = assertDateKey(fromDate, "invalid_date")
  const to = assertDateKey(toDate, "invalid_date")
  if (to < from) throw appError("invalid_date_range", "End date is before start date.")
  if (time.inclusiveDayCount(from, to) > 366) {
    throw appError("invalid_date_range", "The requested period is longer than a year.")
  }
  return { from, to }
}


function recalculatePeriod({ fromDate, toDate, actor } = {}) {
  const { from, to } = periodRange(fromDate, toDate)
  return withTransaction(db => {
    const schedule = shiftSettings(db)
    const rows = db
      .prepare("SELECT * FROM attendance_records WHERE record_date >= ? AND record_date <= ?")
      .all(from, to)
    const update = db.prepare(
      "UPDATE attendance_records SET late_minutes = ?, early_leave_minutes = ?, updated_at = ? WHERE id = ?"
    )
    const stamp = nowIso()
    let updated = 0

    for (const row of rows) {
      if (row.punch_in_at === null) {
        if (Number(row.late_minutes ?? 0) !== 0 || Number(row.early_leave_minutes ?? 0) !== 0) {
          update.run(0, 0, stamp, row.id)
          updated += 1
        }
        continue
      }

      const workingDay = shift.isWorkingDay(row.record_date, schedule.workDays)
      const lateMinutes = workingDay
        ? shift.lateMinutesFor({
          punchInAt: Number(row.punch_in_at),
          recordDate: row.record_date,
          shiftStartMinutes: schedule.shiftStartMinutes,
          graceMinutes: schedule.graceMinutes
        })
        : 0
      const earlyLeaveMinutes = workingDay && row.punch_out_at !== null
        ? shift.earlyLeaveMinutesFor({
          punchOutAt: Number(row.punch_out_at),
          recordDate: row.record_date,
          shiftEndMinutes: schedule.shiftEndMinutes,
          graceMinutes: schedule.graceMinutes
        })
        : 0

      if (
        Number(row.late_minutes ?? 0) !== lateMinutes ||
        Number(row.early_leave_minutes ?? 0) !== earlyLeaveMinutes
      ) {
        update.run(lateMinutes, earlyLeaveMinutes, stamp, row.id)
        updated += 1
      }
    }

    logAudit(db, {
      actor,
      entity: "attendance",
      entityId: null,
      action: "recalculated",
      details: { fromDate: from, toDate: to, updated }
    })

    return { fromDate: from, toDate: to, updated }
  })
}


function monthCloseReport({ fromDate, toDate } = {}) {
  const { from, to } = periodRange(fromDate, toDate)
  const asOf = time.localDateKey()
  const effectiveTo = to > asOf ? asOf : to
  const db = getDb()
  const settings = shiftSettings(db)

  const employeeRows = db.prepare("SELECT * FROM employees ORDER BY full_name").all()
  const attendanceRows = db
    .prepare("SELECT * FROM attendance_records WHERE record_date >= ? AND record_date <= ?")
    .all(from, to)
  const leaveRows = db
    .prepare("SELECT * FROM leaves WHERE end_date >= ? AND start_date <= ?")
    .all(from, to)

  const recordsByEmployee = new Map()
  for (const row of attendanceRows) {
    const list = recordsByEmployee.get(row.employee_id) ?? []
    list.push(row)
    recordsByEmployee.set(row.employee_id, list)
  }

  const leavesByEmployee = new Map()
  for (const row of leaveRows) {
    const list = leavesByEmployee.get(row.employee_id) ?? []
    list.push(row)
    leavesByEmployee.set(row.employee_id, list)
  }

  const totals = {
    requiredDays: 0,
    presentDays: 0,
    absentDays: 0,
    leaveDays: 0,
    unpaidLeaveDays: 0,
    lateMinutes: 0,
    earlyLeaveMinutes: 0,
    workedMinutes: 0,
    overtimeMinutes: 0,
    openRecords: 0
  }

  const employees = []

  for (const employeeRow of employeeRows) {
    const employee = mapEmployee(employeeRow)
    const records = recordsByEmployee.get(employee.id) ?? []
    const leaves = leavesByEmployee.get(employee.id) ?? []

    const startKey = employeeStartKey(employeeRow)
    const requiredStart = startKey && startKey > from ? startKey : from
    const requiredDates = new Set(shift.workingDayKeys(requiredStart, effectiveTo, settings.workDays))

    const presentDates = new Set()
    let lateMinutes = 0
    let earlyLeaveMinutes = 0
    let workedMinutes = 0
    let overtimeMinutes = 0
    let openRecords = 0
    let absentMarkedDays = 0

    for (const record of records) {
      if (record.punch_in_at === null) {
        if (record.status === "absent") absentMarkedDays += 1
        continue
      }

      presentDates.add(record.record_date)
      const workingDay = requiredDates.has(record.record_date)

      if (workingDay) {
        lateMinutes += shift.lateMinutesFor({
          punchInAt: Number(record.punch_in_at),
          recordDate: record.record_date,
          shiftStartMinutes: settings.shiftStartMinutes,
          graceMinutes: settings.graceMinutes
        })
      }

      if (record.punch_out_at === null) {
        openRecords += 1
        continue
      }

      if (workingDay) {
        earlyLeaveMinutes += shift.earlyLeaveMinutesFor({
          punchOutAt: Number(record.punch_out_at),
          recordDate: record.record_date,
          shiftEndMinutes: settings.shiftEndMinutes,
          graceMinutes: settings.graceMinutes
        })
      }

      const netMinutes = Number(record.net_minutes ?? 0)
      workedMinutes += netMinutes
      overtimeMinutes += time.overtimeMinutesForDay(netMinutes, settings.defaultDailyHours)
    }

    const leaveDates = new Set()
    let unpaidLeaveDays = 0
    for (const leave of leaves) {
      const overlapStart = leave.start_date > from ? leave.start_date : from
      const overlapEnd = leave.end_date < effectiveTo ? leave.end_date : effectiveTo
      if (overlapEnd < overlapStart) continue
      for (const key of shift.workingDayKeys(overlapStart, overlapEnd, settings.workDays)) leaveDates.add(key)
      if (!Number(leave.is_paid)) {
        unpaidLeaveDays += time.overlapDayCount(from, effectiveTo, leave.start_date, leave.end_date)
      }
    }

    const presentDays = [...presentDates].filter(key => requiredDates.has(key)).length
    const leaveDays = [...leaveDates].filter(key => requiredDates.has(key)).length
    const absentDays = Math.max(0, requiredDates.size - presentDays - leaveDays)
    const hasActivity = requiredDates.size > 0 || presentDays > 0 || leaveDays > 0 || openRecords > 0 || records.length > 0

    if (!hasActivity) continue

    const row = {
      employeeId: employee.id,
      employeeCode: employee.employeeCode,
      employeeName: employee.fullName,
      department: employee.department,
      isActive: employee.isActive,
      requiredDays: requiredDates.size,
      presentDays,
      absentDays,
      absentMarkedDays,
      leaveDays,
      unpaidLeaveDays,
      lateMinutes,
      earlyLeaveMinutes,
      workedMinutes,
      overtimeMinutes,
      openRecords
    }

    employees.push(row)
    totals.requiredDays += row.requiredDays
    totals.presentDays += row.presentDays
    totals.absentDays += row.absentDays
    totals.leaveDays += row.leaveDays
    totals.unpaidLeaveDays += row.unpaidLeaveDays
    totals.lateMinutes += row.lateMinutes
    totals.earlyLeaveMinutes += row.earlyLeaveMinutes
    totals.workedMinutes += row.workedMinutes
    totals.overtimeMinutes += row.overtimeMinutes
    totals.openRecords += row.openRecords
  }

  return {
    periodStart: from,
    periodEnd: to,
    asOf: effectiveTo,
    shift: {
      startMinutes: settings.shiftStartMinutes,
      endMinutes: settings.shiftEndMinutes,
      graceMinutes: settings.graceMinutes,
      workDays: settings.workDays
    },
    employees,
    totals
  }
}


function markAbsences({ fromDate, toDate, actor } = {}) {
  const { from, to } = periodRange(fromDate, toDate)
  const today = time.localDateKey()
  const effectiveTo = to > today ? today : to
  if (effectiveTo < from) return { fromDate: from, toDate: to, inserted: 0, asOf: effectiveTo }
  return withTransaction(db => {
    const settings = shiftSettings(db)
    const employees = db.prepare("SELECT * FROM employees WHERE is_active = 1 ORDER BY full_name").all()
    const existing = new Set(
      db
        .prepare("SELECT employee_id, record_date FROM attendance_records WHERE record_date >= ? AND record_date <= ?")
        .all(from, to)
        .map(row => `${row.employee_id}|${row.record_date}`)
    )

    const leaveRows = db
      .prepare("SELECT * FROM leaves WHERE end_date >= ? AND start_date <= ?")
      .all(from, to)
    const leaveDatesByEmployee = new Map()
    for (const leave of leaveRows) {
      const overlapStart = leave.start_date > from ? leave.start_date : from
      const overlapEnd = leave.end_date < effectiveTo ? leave.end_date : effectiveTo
      if (overlapEnd < overlapStart) continue
      const dates = leaveDatesByEmployee.get(leave.employee_id) ?? new Set()
      for (const key of shift.workingDayKeys(overlapStart, overlapEnd, settings.workDays)) dates.add(key)
      leaveDatesByEmployee.set(leave.employee_id, dates)
    }

    const insert = db.prepare(`
      INSERT INTO attendance_records
        (id, employee_id, record_date, punch_in_at, punch_out_at, break_minutes, net_minutes, status, notes, created_at, updated_at, late_minutes, early_leave_minutes)
      VALUES (?, ?, ?, NULL, NULL, 0, 0, 'absent', '', ?, ?, 0, 0)
      ON CONFLICT (employee_id, record_date) DO NOTHING
    `)

    const stamp = nowIso()
    let inserted = 0

    for (const employeeRow of employees) {
      const employee = mapEmployee(employeeRow)
      const startKey = employeeStartKey(employeeRow)
      const requiredStart = startKey && startKey > from ? startKey : from
      const leaveDates = leaveDatesByEmployee.get(employee.id) ?? new Set()

      for (const key of shift.workingDayKeys(requiredStart, effectiveTo, settings.workDays)) {
        if (existing.has(`${employee.id}|${key}`) || leaveDates.has(key)) continue
        const result = insert.run(newId("att"), employee.id, key, stamp, stamp)
        if (Number(result?.changes ?? 0) > 0) inserted += 1
      }
    }

    if (inserted > 0) {
      logAudit(db, {
        actor,
        entity: "attendance",
        entityId: null,
        action: "absences_marked",
        details: { fromDate: from, toDate: to, inserted }
      })
    }

    return { fromDate: from, toDate: to, inserted, asOf: effectiveTo }
  })
}


function clearAbsences({ fromDate, toDate, actor } = {}) {
  const { from, to } = periodRange(fromDate, toDate)
  return withTransaction(db => {
    const result = db
      .prepare(
        "DELETE FROM attendance_records WHERE status = 'absent' AND punch_in_at IS NULL AND record_date >= ? AND record_date <= ?"
      )
      .run(from, to)
    const deleted = Number(result?.changes ?? 0)

    if (deleted > 0) {
      logAudit(db, {
        actor,
        entity: "attendance",
        entityId: null,
        action: "absences_cleared",
        details: { fromDate: from, toDate: to, deleted }
      })
    }

    return { fromDate: from, toDate: to, deleted }
  })
}

function dataCounts() {
  const db = getDb()
  const count = sql => Number(db.prepare(sql).get()?.total ?? 0)
  return {
    employees: count("SELECT COUNT(*) AS total FROM employees"),
    attendance: count("SELECT COUNT(*) AS total FROM attendance_records"),
    leaves: count("SELECT COUNT(*) AS total FROM leaves"),
    payslips: count("SELECT COUNT(*) AS total FROM payslips")
  }
}

function logDatabaseRestore(actor, details = {}) {
  logAudit(getDb(), { actor, entity: "database", entityId: null, action: "restored", details })
}

function exportAll() {
  const db = getDb()
  return {
    settings: { ...mapSettings(rawSettingsRow(db)), passwordHash: rawSettingsRow(db).admin_password_hash },
    employees: db.prepare("SELECT * FROM employees ORDER BY created_at").all().map(mapEmployee),
    attendance: attendanceQuery(db, {}),
    leaves: leaveQuery(db, {}),
    payslips: payslipQuery(db, {})
  }
}

function importAll(data, actor) {
  return withTransaction(db => {
    db.exec("DELETE FROM break_logs")
    db.exec("DELETE FROM attendance_records")
    db.exec("DELETE FROM leaves")
    db.exec("DELETE FROM payslips")
    db.exec("DELETE FROM employees")

    const insertEmployee = db.prepare(`
      INSERT INTO employees (id, full_name, employee_code, phone, department, salary_type, base_rate_minor, is_active, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)
    for (const employee of data.employees) {
      insertEmployee.run(
        employee.id,
        employee.fullName,
        employee.employeeCode,
        employee.phone ?? "",
        employee.department ?? "",
        SALARY_TYPES.includes(employee.salaryType) ? employee.salaryType : "custom",
        toMinor(employee.baseRateMinor),
        employee.isActive ? 1 : 0,
        employee.createdAt ?? nowIso(),
        employee.updatedAt ?? employee.createdAt ?? nowIso()
      )
    }

    const insertAttendance = db.prepare(`
      INSERT INTO attendance_records
        (id, employee_id, record_date, punch_in_at, punch_out_at, break_minutes, net_minutes, status, notes, created_at, updated_at, late_minutes, early_leave_minutes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)
    const insertBreak = db.prepare(`
      INSERT INTO break_logs (id, attendance_id, break_start_at, break_end_at, duration_minutes)
      VALUES (?, ?, ?, ?, ?)
    `)
    for (const record of data.attendance) {
      insertAttendance.run(
        record.id,
        record.employeeId,
        record.recordDate,
        record.punchInAt ?? null,
        record.punchOutAt ?? null,
        toInteger(record.breakMinutes, { min: 0, max: 24 * 60 }),
        toInteger(record.netMinutes, { min: 0, max: 24 * 60 }),
        ATTENDANCE_STATUSES.includes(record.status) ? record.status : "present",
        record.notes ?? "",
        record.createdAt ?? nowIso(),
        record.updatedAt ?? nowIso(),
        toInteger(record.lateMinutes ?? 0, { min: 0, max: 24 * 60 }),
        toInteger(record.earlyLeaveMinutes ?? 0, { min: 0, max: 24 * 60 })
      )
      for (const breakRow of record.breaks ?? []) {
        insertBreak.run(
          breakRow.id ?? newId("brk"),
          record.id,
          Number(breakRow.breakStartAt),
          breakRow.breakEndAt ?? null,
          toInteger(breakRow.durationMinutes, { min: 0, max: 24 * 60 })
        )
      }
    }

    const insertLeave = db.prepare(`
      INSERT INTO leaves (id, employee_id, leave_type, start_date, end_date, days, is_paid, reason, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)
    for (const leave of data.leaves) {
      insertLeave.run(
        leave.id,
        leave.employeeId,
        LEAVE_TYPES.includes(leave.leaveType) ? leave.leaveType : "unpaid",
        leave.startDate,
        leave.endDate,
        toInteger(leave.days, { min: 1, max: 366 }),
        leave.isPaid ? 1 : 0,
        leave.reason ?? "",
        leave.createdAt ?? nowIso(),
        leave.createdAt ?? nowIso()
      )
    }

    const insertPayslip = db.prepare(`
      INSERT INTO payslips (
        id, number, employee_id, employee_name, employee_code, department, salary_type, base_rate_minor,
        period_start, period_end, worked_days, worked_minutes, break_minutes, overtime_minutes, unpaid_leave_days,
        base_salary_minor, overtime_amount_minor, bonuses_minor, deductions_minor, net_amount_minor,
        payment_date, payment_method, notes, is_signed, signed_at, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)
    const seenPayslipPeriods = new Set()
    const payslipsToImport = []
    let skippedPayslips = 0
    for (const payslip of [...data.payslips].sort((a, b) =>
      String(b.createdAt ?? "").localeCompare(String(a.createdAt ?? ""))
    )) {
      const key = `${payslip.employeeId}|${payslip.periodStart}|${payslip.periodEnd}`
      if (seenPayslipPeriods.has(key)) {
        skippedPayslips += 1
        continue
      }
      seenPayslipPeriods.add(key)
      payslipsToImport.push(payslip)
    }
    for (const payslip of payslipsToImport) {
      insertPayslip.run(
        payslip.id,
        payslip.number,
        payslip.employeeId,
        payslip.employeeName,
        payslip.employeeCode,
        payslip.department ?? "",
        SALARY_TYPES.includes(payslip.salaryType) ? payslip.salaryType : "custom",
        toMinor(payslip.baseRateMinor),
        payslip.periodStart,
        payslip.periodEnd,
        toInteger(payslip.workedDays, { min: 0, max: 366 }),
        toInteger(payslip.workedMinutes, { min: 0, max: 366 * 24 * 60 }),
        toInteger(payslip.breakMinutes, { min: 0, max: 366 * 24 * 60 }),
        toInteger(payslip.overtimeMinutes, { min: 0, max: 366 * 24 * 60 }),
        toInteger(payslip.unpaidLeaveDays, { min: 0, max: 366 }),
        toMinor(payslip.baseSalaryMinor),
        toMinor(payslip.overtimeAmountMinor),
        toMinor(payslip.bonusesMinor),
        toMinor(payslip.deductionsMinor),
        toMinor(payslip.netAmountMinor),
        payslip.paymentDate ?? "",
        PAYMENT_METHODS.includes(payslip.paymentMethod) ? payslip.paymentMethod : "bank_transfer",
        payslip.notes ?? "",
        payslip.isSigned ? 1 : 0,
        payslip.signedAt ?? null,
        payslip.createdAt ?? nowIso(),
        payslip.createdAt ?? nowIso()
      )
    }

    if (data.settings?.passwordHash) {
      db.prepare("UPDATE company_settings SET admin_password_hash = ?, is_configured = ? WHERE id = 1")
        .run(data.settings.passwordHash, data.settings.isConfigured ? 1 : 0)
    }
    updateSettingsInTransaction(db, data.settings ?? {})

    logAudit(db, {
      actor,
      entity: "database",
      entityId: null,
      action: "restored",
      details: skippedPayslips > 0 ? { skippedPayslips } : {}
    })
    return { ok: true, skippedPayslips }
  })
}

function updateSettingsInTransaction(db, settings) {
  const current = rawSettingsRow(db)

  let shiftPatch
  try {
    shiftPatch = resolveShiftSettings(settings, current)
  } catch {
    shiftPatch = resolveShiftSettings({}, current)
  }

  db.prepare(`
    UPDATE company_settings SET
      company_name = ?, owner_name = ?, owner_role = ?, currency = ?, currency_decimals = ?,
      default_daily_hours = ?, standard_work_days = ?, overtime_multiplier = ?,
      shift_start_minutes = ?, shift_end_minutes = ?, grace_minutes = ?, work_days = ?,
      is_configured = ?, updated_at = ?
    WHERE id = 1
  `).run(
    settings.companyName ?? current.company_name,
    settings.ownerName ?? current.owner_name,
    settings.ownerRole ?? current.owner_role,
    settings.currency ?? current.currency,
    toInteger(settings.currencyDecimals ?? current.currency_decimals, { min: 0, max: 4, fallback: 3 }),
    toNumber(settings.defaultDailyHours ?? current.default_daily_hours, { min: 1, max: 24, fallback: 8 }),
    toInteger(settings.standardWorkDays ?? current.standard_work_days, { min: 1, max: 31, fallback: 26 }),
    toNumber(settings.overtimeMultiplier ?? current.overtime_multiplier, { min: 0, max: 10, fallback: 1.25 }),
    shiftPatch.shift_start_minutes,
    shiftPatch.shift_end_minutes,
    shiftPatch.grace_minutes,
    shiftPatch.work_days,
    settings.isConfigured ?? Boolean(current.is_configured) ? 1 : 0,
    nowIso()
  )
}

module.exports = {
  SALARY_TYPES,
  LEAVE_TYPES,
  PAYMENT_METHODS,
  listAuditLogs,
  getSettings,
  updateSettings,
  getPasswordHash,
  setPasswordHash,
  getEmployee,
  listEmployees,
  listPublicEmployees,
  saveEmployee,
  setEmployeeActive,
  deleteEmployee,
  listAttendance,
  todayRecords,
  punchIn,
  startBreak,
  endBreak,
  punchOut,
  correctAttendance,
  deleteAttendance,
  aggregateAttendance,
  recalculatePeriod,
  monthCloseReport,
  markAbsences,
  clearAbsences,
  listLeaves,
  saveLeave,
  deleteLeave,
  unpaidLeaveDaysInRange,
  listPayslips,
  savePayslip,
  setPayslipSigned,
  deletePayslip,
  exportAll,
  attendancePage,
  countAttendance,
  payslipsPage,
  countPayslips,
  dashboardInsights,
  monthKeysEndingAt,
  absenceSummary,
  sumDepartmentCosts,
  dataCounts,
  logDatabaseRestore,
  importAll
}
