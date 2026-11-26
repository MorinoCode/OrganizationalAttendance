"use strict"


const SCHEMA_VERSION = 5

const MIGRATION_V1 = `
CREATE TABLE IF NOT EXISTS company_settings (
  id                   INTEGER PRIMARY KEY CHECK (id = 1),
  company_name         TEXT    NOT NULL DEFAULT '',
  owner_name           TEXT    NOT NULL DEFAULT '',
  owner_role           TEXT    NOT NULL DEFAULT '',
  admin_password_hash  TEXT    NOT NULL DEFAULT '',
  currency             TEXT    NOT NULL DEFAULT 'KWD',
  currency_decimals    INTEGER NOT NULL DEFAULT 3,
  default_daily_hours  REAL    NOT NULL DEFAULT 8,
  standard_work_days   INTEGER NOT NULL DEFAULT 26,
  overtime_multiplier  REAL    NOT NULL DEFAULT 1.25,
  is_configured        INTEGER NOT NULL DEFAULT 0,
  logo_path            TEXT,
  updated_at           TEXT    NOT NULL
);

CREATE TABLE IF NOT EXISTS employees (
  id              TEXT    PRIMARY KEY,
  full_name       TEXT    NOT NULL,
  employee_code   TEXT    NOT NULL UNIQUE,
  phone           TEXT    NOT NULL DEFAULT '',
  department      TEXT    NOT NULL DEFAULT '',
  salary_type     TEXT    NOT NULL CHECK (salary_type IN ('fixed_monthly', 'hourly', 'daily', 'custom')),
  base_rate_minor INTEGER NOT NULL DEFAULT 0 CHECK (base_rate_minor >= 0),
  is_active       INTEGER NOT NULL DEFAULT 1,
  created_at      TEXT    NOT NULL,
  updated_at      TEXT    NOT NULL
);

CREATE TABLE IF NOT EXISTS attendance_records (
  id            TEXT    PRIMARY KEY,
  employee_id   TEXT    NOT NULL REFERENCES employees (id) ON DELETE CASCADE,
  record_date   TEXT    NOT NULL,
  punch_in_at   INTEGER,
  punch_out_at  INTEGER,
  break_minutes INTEGER NOT NULL DEFAULT 0 CHECK (break_minutes >= 0),
  net_minutes   INTEGER NOT NULL DEFAULT 0 CHECK (net_minutes >= 0),
  status        TEXT    NOT NULL CHECK (status IN ('present', 'on_break', 'completed', 'absent')),
  notes         TEXT    NOT NULL DEFAULT '',
  created_at    TEXT    NOT NULL,
  updated_at    TEXT    NOT NULL
);

CREATE TABLE IF NOT EXISTS break_logs (
  id               TEXT    PRIMARY KEY,
  attendance_id    TEXT    NOT NULL REFERENCES attendance_records (id) ON DELETE CASCADE,
  break_start_at   INTEGER NOT NULL,
  break_end_at     INTEGER,
  duration_minutes INTEGER NOT NULL DEFAULT 0 CHECK (duration_minutes >= 0)
);

CREATE TABLE IF NOT EXISTS leaves (
  id          TEXT    PRIMARY KEY,
  employee_id TEXT    NOT NULL REFERENCES employees (id) ON DELETE CASCADE,
  leave_type  TEXT    NOT NULL CHECK (leave_type IN ('paid', 'unpaid', 'sick', 'emergency')),
  start_date  TEXT    NOT NULL,
  end_date    TEXT    NOT NULL,
  days        INTEGER NOT NULL DEFAULT 1 CHECK (days >= 1),
  is_paid     INTEGER NOT NULL DEFAULT 0,
  reason      TEXT    NOT NULL DEFAULT '',
  created_at  TEXT    NOT NULL,
  updated_at  TEXT    NOT NULL
);

CREATE TABLE IF NOT EXISTS payslips (
  id                    TEXT    PRIMARY KEY,
  number                TEXT    NOT NULL UNIQUE,
  employee_id           TEXT    NOT NULL,
  employee_name         TEXT    NOT NULL,
  employee_code         TEXT    NOT NULL,
  department            TEXT    NOT NULL DEFAULT '',
  salary_type           TEXT    NOT NULL,
  base_rate_minor       INTEGER NOT NULL DEFAULT 0,
  period_start          TEXT    NOT NULL,
  period_end            TEXT    NOT NULL,
  worked_days           INTEGER NOT NULL DEFAULT 0,
  worked_minutes        INTEGER NOT NULL DEFAULT 0,
  break_minutes         INTEGER NOT NULL DEFAULT 0,
  overtime_minutes      INTEGER NOT NULL DEFAULT 0,
  unpaid_leave_days     INTEGER NOT NULL DEFAULT 0,
  base_salary_minor     INTEGER NOT NULL DEFAULT 0,
  overtime_amount_minor INTEGER NOT NULL DEFAULT 0,
  bonuses_minor         INTEGER NOT NULL DEFAULT 0,
  deductions_minor      INTEGER NOT NULL DEFAULT 0,
  net_amount_minor      INTEGER NOT NULL DEFAULT 0,
  payment_date          TEXT    NOT NULL DEFAULT '',
  payment_method        TEXT    NOT NULL DEFAULT 'bank_transfer',
  notes                 TEXT    NOT NULL DEFAULT '',
  is_signed             INTEGER NOT NULL DEFAULT 0,
  signed_at             TEXT,
  created_at            TEXT    NOT NULL,
  updated_at            TEXT    NOT NULL
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id        INTEGER PRIMARY KEY AUTOINCREMENT,
  at        TEXT    NOT NULL,
  actor     TEXT    NOT NULL,
  entity    TEXT    NOT NULL,
  entity_id TEXT,
  action    TEXT    NOT NULL,
  details   TEXT    NOT NULL DEFAULT ''
);

CREATE INDEX IF NOT EXISTS idx_attendance_date       ON attendance_records (record_date);
CREATE INDEX IF NOT EXISTS idx_attendance_employee   ON attendance_records (employee_id, record_date);
CREATE INDEX IF NOT EXISTS idx_break_logs_attendance ON break_logs (attendance_id);
CREATE INDEX IF NOT EXISTS idx_leaves_employee       ON leaves (employee_id, start_date);
CREATE INDEX IF NOT EXISTS idx_leaves_range          ON leaves (start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_payslips_employee     ON payslips (employee_id, period_start);
CREATE INDEX IF NOT EXISTS idx_payslips_period       ON payslips (period_start, period_end);
`

const MIGRATION_V2 = `
CREATE TABLE IF NOT EXISTS audit_logs (
  id        INTEGER PRIMARY KEY AUTOINCREMENT,
  at        TEXT    NOT NULL,
  actor     TEXT    NOT NULL,
  entity    TEXT    NOT NULL,
  entity_id TEXT,
  action    TEXT    NOT NULL,
  details   TEXT    NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS payslips_rebuilt (
  id                    TEXT    PRIMARY KEY,
  number                TEXT    NOT NULL UNIQUE,
  employee_id           TEXT    NOT NULL,
  employee_name         TEXT    NOT NULL,
  employee_code         TEXT    NOT NULL,
  department            TEXT    NOT NULL DEFAULT '',
  salary_type           TEXT    NOT NULL,
  base_rate_minor       INTEGER NOT NULL DEFAULT 0,
  period_start          TEXT    NOT NULL,
  period_end            TEXT    NOT NULL,
  worked_days           INTEGER NOT NULL DEFAULT 0,
  worked_minutes        INTEGER NOT NULL DEFAULT 0,
  break_minutes         INTEGER NOT NULL DEFAULT 0,
  overtime_minutes      INTEGER NOT NULL DEFAULT 0,
  unpaid_leave_days     INTEGER NOT NULL DEFAULT 0,
  base_salary_minor     INTEGER NOT NULL DEFAULT 0,
  overtime_amount_minor INTEGER NOT NULL DEFAULT 0,
  bonuses_minor         INTEGER NOT NULL DEFAULT 0,
  deductions_minor      INTEGER NOT NULL DEFAULT 0,
  net_amount_minor      INTEGER NOT NULL DEFAULT 0,
  payment_date          TEXT    NOT NULL DEFAULT '',
  payment_method        TEXT    NOT NULL DEFAULT 'bank_transfer',
  notes                 TEXT    NOT NULL DEFAULT '',
  is_signed             INTEGER NOT NULL DEFAULT 0,
  signed_at             TEXT,
  created_at            TEXT    NOT NULL,
  updated_at            TEXT    NOT NULL
);

INSERT OR IGNORE INTO payslips_rebuilt (
  id, number, employee_id, employee_name, employee_code, department, salary_type, base_rate_minor,
  period_start, period_end, worked_days, worked_minutes, break_minutes, overtime_minutes, unpaid_leave_days,
  base_salary_minor, overtime_amount_minor, bonuses_minor, deductions_minor, net_amount_minor,
  payment_date, payment_method, notes, is_signed, signed_at, created_at, updated_at
)
SELECT
  id, number, employee_id, employee_name, employee_code, COALESCE(department, ''), salary_type,
  COALESCE(base_rate_minor, 0), period_start, period_end, COALESCE(worked_days, 0),
  COALESCE(worked_minutes, 0), COALESCE(break_minutes, 0), COALESCE(overtime_minutes, 0),
  COALESCE(unpaid_leave_days, 0), COALESCE(base_salary_minor, 0), COALESCE(overtime_amount_minor, 0),
  COALESCE(bonuses_minor, 0), COALESCE(deductions_minor, 0), COALESCE(net_amount_minor, 0),
  COALESCE(payment_date, ''), COALESCE(payment_method, 'bank_transfer'), COALESCE(notes, ''),
  COALESCE(is_signed, 0), signed_at, created_at, updated_at
FROM payslips;

DROP TABLE payslips;
ALTER TABLE payslips_rebuilt RENAME TO payslips;

CREATE INDEX IF NOT EXISTS idx_payslips_employee ON payslips (employee_id, period_start);
CREATE INDEX IF NOT EXISTS idx_payslips_period   ON payslips (period_start, period_end);
`

const MIGRATION_V3 = `
ALTER TABLE company_settings ADD COLUMN shift_start_minutes INTEGER NOT NULL DEFAULT 480;
ALTER TABLE company_settings ADD COLUMN shift_end_minutes   INTEGER NOT NULL DEFAULT 1020;
ALTER TABLE company_settings ADD COLUMN grace_minutes       INTEGER NOT NULL DEFAULT 10;
ALTER TABLE company_settings ADD COLUMN work_days           TEXT    NOT NULL DEFAULT '0,1,2,3,4';

ALTER TABLE attendance_records ADD COLUMN late_minutes        INTEGER NOT NULL DEFAULT 0;
ALTER TABLE attendance_records ADD COLUMN early_leave_minutes INTEGER NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_attendance_status ON attendance_records (status);
`

const MIGRATION_V4 = `
-- Payroll rule: one payslip per employee per period. Older databases could hold duplicates,
-- so the migration keeps the most recently updated row of each group and records every
-- removed row in the audit log (nothing disappears silently).
INSERT INTO audit_logs (at, actor, entity, entity_id, action, details)
SELECT strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), 'system', 'payslip', p.id, 'deleted',
       '{"reason":"duplicate_period","schemaMigration":4,"keptId":"' || k.keep_id || '"}'
FROM payslips p
JOIN (
  SELECT g.employee_id, g.period_start, g.period_end,
         (SELECT x.id FROM payslips x
           WHERE x.employee_id = g.employee_id
             AND x.period_start = g.period_start
             AND x.period_end = g.period_end
           ORDER BY COALESCE(NULLIF(x.updated_at, ''), x.created_at) DESC, x.id DESC
           LIMIT 1) AS keep_id
  FROM (SELECT DISTINCT employee_id, period_start, period_end FROM payslips) g
) k
  ON k.employee_id = p.employee_id
 AND k.period_start = p.period_start
 AND k.period_end = p.period_end
WHERE p.id <> k.keep_id;

DELETE FROM payslips WHERE id IN (
  SELECT p.id FROM payslips p
  WHERE EXISTS (
    SELECT 1 FROM payslips q
    WHERE q.employee_id = p.employee_id
      AND q.period_start = p.period_start
      AND q.period_end = p.period_end
      AND (
        COALESCE(NULLIF(q.updated_at, ''), q.created_at) > COALESCE(NULLIF(p.updated_at, ''), p.created_at)
        OR (COALESCE(NULLIF(q.updated_at, ''), q.created_at) = COALESCE(NULLIF(p.updated_at, ''), p.created_at) AND q.id > p.id)
      )
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_payslips_employee_period
  ON payslips (employee_id, period_start, period_end);
`

const MIGRATION_V5 = `
CREATE TABLE IF NOT EXISTS attendance_records_v5 (
  id                  TEXT    PRIMARY KEY,
  employee_id         TEXT    NOT NULL REFERENCES employees (id) ON DELETE CASCADE,
  record_date         TEXT    NOT NULL,
  punch_in_at         INTEGER,
  punch_out_at        INTEGER,
  break_minutes       INTEGER NOT NULL DEFAULT 0 CHECK (break_minutes >= 0),
  net_minutes         INTEGER NOT NULL DEFAULT 0 CHECK (net_minutes >= 0),
  status              TEXT    NOT NULL CHECK (status IN ('present', 'on_break', 'completed', 'absent')),
  notes               TEXT    NOT NULL DEFAULT '',
  created_at          TEXT    NOT NULL,
  updated_at          TEXT    NOT NULL,
  late_minutes        INTEGER NOT NULL DEFAULT 0,
  early_leave_minutes INTEGER NOT NULL DEFAULT 0
);

INSERT INTO attendance_records_v5 (
  id, employee_id, record_date, punch_in_at, punch_out_at, break_minutes, net_minutes, status, notes, created_at, updated_at, late_minutes, early_leave_minutes
)
SELECT
  id, employee_id, record_date, punch_in_at, punch_out_at, break_minutes, net_minutes, status, notes, created_at, updated_at, late_minutes, early_leave_minutes
FROM attendance_records;

DROP TABLE attendance_records;
ALTER TABLE attendance_records_v5 RENAME TO attendance_records;

CREATE INDEX IF NOT EXISTS idx_attendance_date       ON attendance_records (record_date);
CREATE INDEX IF NOT EXISTS idx_attendance_employee   ON attendance_records (employee_id, record_date);
CREATE INDEX IF NOT EXISTS idx_attendance_status     ON attendance_records (status);
`

const MIGRATIONS = [
  { version: 1, sql: MIGRATION_V1 },
  { version: 2, sql: MIGRATION_V2 },
  { version: 3, sql: MIGRATION_V3 },
  { version: 4, sql: MIGRATION_V4 },
  { version: 5, sql: MIGRATION_V5 }
]

function getUserVersion(db) {
  const row = db.prepare("PRAGMA user_version").get() || {}
  const value = row.user_version ?? Object.values(row)[0] ?? 0
  return Number(value) || 0
}

function setUserVersion(db, version) {
  db.exec(`PRAGMA user_version = ${Number(version)}`)
}

function seedSettingsRow(db) {
  db.prepare(
    `INSERT OR IGNORE INTO company_settings (
      id, company_name, owner_name, owner_role, admin_password_hash,
      currency, currency_decimals, default_daily_hours, standard_work_days,
      overtime_multiplier, is_configured, logo_path, updated_at
    ) VALUES (1, '', '', '', '', 'KWD', 3, 8.0, 26, 1.25, 0, NULL, ?)`
  ).run(new Date().toISOString())
}

function runMigrations(db) {
  const current = getUserVersion(db)
  if (current > SCHEMA_VERSION) {
    throw new Error(
      `Database schema v${current} is newer than this application (v${SCHEMA_VERSION}). Please update the application.`
    )
  }

  for (const migration of MIGRATIONS) {
    if (migration.version <= current) continue
    db.exec("PRAGMA foreign_keys = OFF")
    db.exec("BEGIN IMMEDIATE")
    try {
      db.exec(migration.sql)
      if (migration.version === 1) seedSettingsRow(db)
      setUserVersion(db, migration.version)
      db.exec("COMMIT")
    } catch (error) {
      try {
        db.exec("ROLLBACK")
      } catch {
      }
      throw error
    } finally {
      db.exec("PRAGMA foreign_keys = ON")
    }
  }

  return getUserVersion(db)
}

module.exports = {
  SCHEMA_VERSION,
  MIGRATIONS,
  getUserVersion,
  setUserVersion,
  runMigrations
}
