import React, { useCallback, useEffect, useState } from "react"
import { useTranslation } from "react-i18next"
import { Edit3, FileSpreadsheet, Loader2, Printer, Trash2 } from "lucide-react"

import { api } from "../services/api"
import { errorKey, isApiError } from "../services/errors"
import { exportAttendanceExcel } from "../services/excel"
import { addDays, DatePreset, formatDuration, formatTime, getPresetDateRange, minutesToHours, todayKey } from "../services/date"
import { AttendanceRecord, CompanySettings, Employee, Language } from "../types"
import { AttendanceCorrectionModal } from "../components/AttendanceCorrectionModal"
import { ConfirmDialog } from "../components/ConfirmDialog"
import { FeedbackBanner, FeedbackTone } from "../components/FeedbackBanner"

interface AttendanceReportsPageProps {
  settings: CompanySettings
  onSessionEnded: (message: string) => void
}

export const AttendanceReportsPage: React.FC<AttendanceReportsPageProps> = ({ settings, onSessionEnded }) => {
  const { t, i18n } = useTranslation()
  const lang = (i18n.language || "ar") as Language

  const [employees, setEmployees] = useState<Employee[]>([])
  const [records, setRecords] = useState<AttendanceRecord[]>([])
  const [employeeId, setEmployeeId] = useState("")
  const [fromDate, setFromDate] = useState(() => addDays(todayKey(), -30))
  const [toDate, setToDate] = useState(() => todayKey())
  const [activePreset, setActivePreset] = useState<DatePreset | null>("last30Days")
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<AttendanceRecord | null>(null)
  const [deleting, setDeleting] = useState<AttendanceRecord | null>(null)
  const [feedback, setFeedback] = useState<{ tone: FeedbackTone; message: string } | null>(null)

  const handleError = useCallback(
    (caught: unknown) => {
      if (isApiError(caught) && caught.code === "unauthorized") {
        onSessionEnded(t("admin.sessionExpired"))
        return
      }
      setFeedback({ tone: "error", message: t(errorKey(caught)) })
    },
    [onSessionEnded, t]
  )

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const rows = await api.attendance.list({
        employeeId: employeeId || undefined,
        fromDate,
        toDate
      })
      setRecords(rows)
    } catch (caught) {
      handleError(caught)
    } finally {
      setLoading(false)
    }
  }, [employeeId, fromDate, toDate, handleError])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    let active = true
    const loadEmployees = async () => {
      try {
        const list = await api.employees.list(true)
        if (active) setEmployees(list)
      } catch (caught) {
        if (active) handleError(caught)
      }
    }
    void loadEmployees()
    return () => {
      active = false
    }
  }, [handleError])

  const selectedEmployee = employees.find(employee => employee.id === employeeId)
  const closedRecords = records.filter(record => record.punchOutAt !== null)
  const openRecords = records.length - closedRecords.length
  const totalMinutes = closedRecords.reduce((total, record) => total + record.netMinutes, 0)
  const totalBreaks = closedRecords.reduce((total, record) => total + record.breakMinutes, 0)

  const handleExport = async () => {
    try {
      await exportAttendanceExcel(records, settings, {
        fromDate,
        toDate,
        employee: selectedEmployee,
        title: selectedEmployee
          ? `${settings.companyName} — ${selectedEmployee.fullName}`
          : `${settings.companyName} — ${t("attendance.sheetName")}`
      })
    } catch (caught) {
      handleError(caught)
    }
  }

  const handleDelete = async () => {
    if (!deleting) return
    try {
      await api.attendance.remove(deleting.id)
      setDeleting(null)
      await load()
    } catch (caught) {
      setDeleting(null)
      handleError(caught)
    }
  }

  return (
    <div className="space-y-6">
      {feedback && <FeedbackBanner tone={feedback.tone} message={feedback.message} onClose={() => setFeedback(null)} />}

      <div className="panel overflow-hidden no-print">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[color:var(--line)] px-6 pb-5 pt-5">
          <div>
            <p className="eyebrow">{t("admin.dashboard")}</p>
            <h2 className="mt-1 text-lg font-semibold tracking-tight text-[#f4ece0]">
              {selectedEmployee ? `${t("employees.employeeReportTitle")}: ${selectedEmployee.fullName}` : t("admin.attendance")}
            </h2>
            <p className="mt-1 text-xs text-slate-400">
              {t("attendance.summaryLine", {
                days: closedRecords.length,
                hours: minutesToHours(totalMinutes),
                breaks: totalBreaks
              })}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleExport}
              disabled={records.length === 0}
              className="btn border border-[rgba(70,195,159,0.4)] bg-[rgba(43,166,136,0.18)] text-[#78dcbc] hover:bg-[rgba(43,166,136,0.3)]"
            >
              <FileSpreadsheet className="h-4 w-4" aria-hidden />
              <span>{t("attendance.exportExcel")}</span>
            </button>
            <button
              type="button"
              onClick={() => window.print()}
              disabled={records.length === 0}
              className="btn btn-ghost"
            >
              <Printer className="h-4 w-4 text-blue-400" aria-hidden />
              <span>{t("attendance.exportPdf")}</span>
            </button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 border-b border-[color:var(--line)] bg-[rgba(255,246,230,0.02)] px-6 py-2.5">
          <span className="text-xs text-[#8d8275]">{t("common.quickPresets")}:</span>
          {(["thisMonth", "lastMonth", "thisWeek", "last30Days"] as const).map(preset => {
            const isSelected = activePreset === preset
            return (
              <button
                key={preset}
                type="button"
                onClick={() => {
                  const r = getPresetDateRange(preset)
                  setActivePreset(preset)
                  setFromDate(r.start)
                  setToDate(r.end)
                }}
                className={`rounded-lg border px-3 py-1 text-xs font-medium transition-colors ${
                  isSelected
                    ? "border-[rgba(214,171,91,0.5)] bg-[rgba(214,171,91,0.18)] text-[#f8efd8]"
                    : "border-[color:var(--line)] bg-[rgba(255,246,230,0.04)] text-[#c8beaf] hover:bg-[rgba(255,246,230,0.08)] hover:text-[#f4ece0]"
                }`}
              >
                {t(`common.presets.${preset}`)}
              </button>
            )
          })}
        </div>

        <div className="grid grid-cols-1 gap-4 px-6 py-5 md:grid-cols-3">
          <div>
            <label className="mb-1.5 block text-xs font-medium text-slate-400" htmlFor="filter-employee">
              {t("attendance.filterByEmployee")}
            </label>
            <select
              id="filter-employee"
              value={employeeId}
              onChange={event => setEmployeeId(event.target.value)}
              className="w-full rounded-xl border border-[color:var(--line)] bg-[rgba(255,246,230,0.045)] px-4 py-2.5 text-sm text-[#f4ece0] focus:border-[rgba(214,171,91,0.6)] focus:outline-none"
            >
              <option value="">{t("attendance.allEmployees")}</option>
              {employees.map(employee => (
                <option key={employee.id} value={employee.id}>
                  {employee.fullName} ({employee.employeeCode})
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-slate-400" htmlFor="filter-from">
              {t("attendance.fromDate")}
            </label>
            <input
              id="filter-from"
              type="date"
              value={fromDate}
              onChange={event => {
                setFromDate(event.target.value)
                setActivePreset(null)
              }}
              className="w-full rounded-xl border border-[color:var(--line)] bg-[rgba(255,246,230,0.045)] px-4 py-2.5 text-sm text-[#f4ece0] focus:border-[rgba(214,171,91,0.6)] focus:outline-none"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-slate-400" htmlFor="filter-to">
              {t("attendance.toDate")}
            </label>
            <input
              id="filter-to"
              type="date"
              value={toDate}
              onChange={event => {
                setToDate(event.target.value)
                setActivePreset(null)
              }}
              className="w-full rounded-xl border border-[color:var(--line)] bg-[rgba(255,246,230,0.045)] px-4 py-2.5 text-sm text-[#f4ece0] focus:border-[rgba(214,171,91,0.6)] focus:outline-none"
            />
          </div>
        </div>

        {openRecords > 0 && (
          <p className="mx-6 mb-5 rounded-xl border border-[rgba(216,149,78,0.32)] bg-[rgba(216,149,78,0.1)] p-3 text-xs text-[#e6b276]">
            {t("attendance.openShiftsWarning", { count: openRecords })}
          </p>
        )}
      </div>

      <div className="print-only-section panel overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[color:var(--line)] bg-[rgba(11,10,8,0.55)] p-6">
          <div>
            <h3 className="text-lg font-bold text-slate-100">{settings.companyName}</h3>
            <p className="text-xs text-slate-400">
              {selectedEmployee
                ? `${t("employees.employeeReportTitle")}: ${selectedEmployee.fullName} (${selectedEmployee.employeeCode})`
                : t("attendance.filterByDateRange")}{" "}
              · {fromDate} → {toDate}
            </p>
          </div>
          <span className="rounded-lg bg-slate-800 px-3 py-1 font-mono text-xs font-bold text-blue-300">
            {t("attendance.summaryLine", {
              days: closedRecords.length,
              hours: minutesToHours(totalMinutes),
              breaks: totalBreaks
            })}
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>{t("attendance.date")}</th>
                <th>{t("attendance.employee")}</th>
                <th>{t("attendance.inTime")}</th>
                <th>{t("attendance.outTime")}</th>
                <th>{t("attendance.breakMinutes")}</th>
                <th>{t("attendance.netHours")}</th>
                <th>{t("employees.status")}</th>
                <th className="text-center no-print">{t("employees.actions")}</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={8} className="px-6 py-14 text-center text-slate-400">
                    <Loader2 className="mx-auto mb-2 h-5 w-5 animate-spin" aria-hidden />
                    {t("common.loading")}
                  </td>
                </tr>
              ) : records.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center text-slate-500">
                    {t("attendance.noRecords")}
                  </td>
                </tr>
              ) : (
                records.map(record => (
                  <tr key={record.id}>
                    <td className="whitespace-nowrap font-mono text-[#ded4c6]">{record.recordDate}</td>
                    <td className="whitespace-nowrap font-semibold text-[#f0e9df]">{record.employeeName}</td>
                    <td className="whitespace-nowrap font-mono text-[#78dcbc]">{formatTime(record.punchInAt, lang)}</td>
                    <td className="whitespace-nowrap font-mono text-[#e6c98a]">{formatTime(record.punchOutAt, lang)}</td>
                    <td className="whitespace-nowrap font-mono text-[#e6b276]">{record.breakMinutes}</td>
                    <td className="whitespace-nowrap font-mono font-semibold text-[#c2a3d8]">
                      {formatDuration(record.netMinutes, t("common.hours"), t("common.minutes"))}
                    </td>
                    <td>
                      <span className="chip">
                        {record.status === "completed"
                          ? t("kiosk.status.completed")
                          : record.status === "on_break"
                            ? t("kiosk.status.onBreak")
                            : record.status === "absent"
                              ? t("kiosk.status.absent")
                              : t("kiosk.status.working")}
                      </span>
                      {(record.lateMinutes > 0 || record.earlyLeaveMinutes > 0) && (
                        <div className="mt-1 flex flex-wrap gap-x-2 gap-y-0.5 text-[0.65rem] text-[#e6b276]">
                          {record.lateMinutes > 0 && (
                            <span className="whitespace-nowrap">
                              {t("attendance.lateShort", { minutes: record.lateMinutes })}
                            </span>
                          )}
                          {record.earlyLeaveMinutes > 0 && (
                            <span className="whitespace-nowrap text-[#c98a7e]">
                              {t("attendance.earlyLeaveShort", { minutes: record.earlyLeaveMinutes })}
                            </span>
                          )}
                        </div>
                      )}
                    </td>
                    <td className="no-print">
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => setEditing(record)}
                          className="flex items-center gap-1.5 rounded-lg border border-[rgba(214,171,91,0.3)] bg-[rgba(214,171,91,0.1)] px-2.5 py-1.5 text-xs text-[#e6c98a] transition-colors hover:bg-[rgba(214,171,91,0.2)]"
                        >
                          <Edit3 className="h-3.5 w-3.5" aria-hidden />
                          <span>{t("attendance.correct")}</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleting(record)}
                          title={t("attendance.deleteRecord")}
                          className="rounded-lg border border-rose-500/30 bg-rose-500/10 p-1.5 text-rose-400 transition-colors hover:bg-rose-500/20"
                        >
                          <Trash2 className="h-3.5 w-3.5" aria-hidden />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <AttendanceCorrectionModal
        record={editing}
        onClose={() => setEditing(null)}
        onSaved={() => void load()}
        onSessionEnded={onSessionEnded}
      />

      <ConfirmDialog
        isOpen={Boolean(deleting)}
        title={t("attendance.deleteRecord")}
        message={`${deleting?.employeeName ?? ""} — ${deleting?.recordDate ?? ""}. ${t("attendance.confirmDeleteRecord")}`}
        confirmLabel={t("common.delete")}
        cancelLabel={t("common.cancel")}
        onConfirm={() => void handleDelete()}
        onCancel={() => setDeleting(null)}
      />
    </div>
  )
}
