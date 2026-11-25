import React, { useEffect, useState } from "react"
import { useTranslation } from "react-i18next"
import { FileSpreadsheet, Loader2, Printer, X } from "lucide-react"

import { api } from "../services/api"
import { errorKey, isApiError } from "../services/errors"
import { exportAttendanceExcel } from "../services/excel"
import { addDays, formatDuration, formatTime, minutesToHours, todayKey } from "../services/date"
import { AttendanceRecord, CompanySettings, Employee, Language } from "../types"
import { FeedbackBanner } from "./FeedbackBanner"

interface EmployeeReportModalProps {
  employee: Employee | null
  isOpen: boolean
  onClose: () => void
  settings: CompanySettings
  onSessionEnded?: (message: string) => void
}

export const EmployeeReportModal: React.FC<EmployeeReportModalProps> = ({
  employee,
  isOpen,
  onClose,
  settings,
  onSessionEnded
}) => {
  const { t, i18n } = useTranslation()
  const lang = (i18n.language || "ar") as Language

  const [fromDate, setFromDate] = useState(() => addDays(todayKey(), -30))
  const [toDate, setToDate] = useState(() => todayKey())
  const [records, setRecords] = useState<AttendanceRecord[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!employee || !isOpen) return
    let active = true

    const load = async () => {
      setLoading(true)
      setError(null)
      try {
        const rows = await api.attendance.list({ employeeId: employee.id, fromDate, toDate })
        if (active) setRecords(rows)
      } catch (caught) {
        if (!active) return
        if (isApiError(caught) && caught.code === "unauthorized" && onSessionEnded) {
          onSessionEnded(t("admin.sessionExpired"))
          return
        }
        setError(t(errorKey(caught)))
      } finally {
        if (active) setLoading(false)
      }
    }

    void load()
    return () => {
      active = false
    }
  }, [employee, isOpen, fromDate, toDate, onSessionEnded, t])

  useEffect(() => {
    if (!isOpen) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose()
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [isOpen, onClose])

  if (!isOpen || !employee) return null

  const totalMinutes = records.reduce((total, record) => total + record.netMinutes, 0)
  const totalBreaks = records.reduce((total, record) => total + record.breakMinutes, 0)

  const handleExport = async () => {
    try {
      await exportAttendanceExcel(
        { employeeId: employee.id, fromDate, toDate },
        settings,
        {
          id: crypto.randomUUID(),
          title: `${settings.companyName} — ${t("employees.employeeReportTitle")}`,
          fromDate,
          toDate,
          employee
        }
      )
    } catch (caught) {
      setError(t(errorKey(caught)))
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(6,5,4,0.74)] p-4 backdrop-blur-sm">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="employee-report-title"
        className="custom-scrollbar panel max-h-[90vh] w-full max-w-4xl overflow-y-auto p-6"
      >
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[color:var(--line)] pb-4">
          <div className="flex items-center gap-3">
            <div className="grid h-12 w-12 place-items-center rounded-xl border border-[rgba(214,171,91,0.35)] bg-[rgba(214,171,91,0.12)] text-lg font-semibold text-[#e6c98a]">
              {employee.fullName.slice(0, 1)}
            </div>
            <div>
              <h3 id="employee-report-title" className="text-lg font-bold text-slate-100">
                {employee.fullName}
              </h3>
              <p className="text-xs text-slate-400">
                {t("employees.code")}: {employee.employeeCode} • {employee.department || "-"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleExport}
              disabled={records.length === 0}
              className="btn border border-[rgba(70,195,159,0.4)] bg-[rgba(43,166,136,0.18)] text-[#78dcbc] hover:bg-[rgba(43,166,136,0.3)]"
            >
              <FileSpreadsheet className="h-4 w-4" aria-hidden />
              <span>{t("employees.exportEmployeeExcel")}</span>
            </button>
            <button
              type="button"
              onClick={() => window.print()}
              className="btn btn-ghost"
            >
              <Printer className="h-4 w-4" aria-hidden />
              <span>{t("employees.exportEmployeePdf")}</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-2 text-[#7b7063] transition-colors hover:bg-[rgba(255,246,230,0.06)] hover:text-[#f4ece0] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#c08f38]/50"
              aria-label={t("common.close")}
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {error && (
          <div className="mt-4">
            <FeedbackBanner tone="error" message={error} onClose={() => setError(null)} />
          </div>
        )}

        <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1.5 block text-xs font-medium text-slate-400" htmlFor="report-from">
              {t("attendance.fromDate")}
            </label>
            <input
              id="report-from"
              type="date"
              value={fromDate}
              onChange={event => setFromDate(event.target.value)}
              className="w-full rounded-xl border border-[color:var(--line)] bg-[rgba(255,246,230,0.045)] px-4 py-2 text-sm text-[#f4ece0] focus:border-[rgba(214,171,91,0.6)] focus:outline-none"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-slate-400" htmlFor="report-to">
              {t("attendance.toDate")}
            </label>
            <input
              id="report-to"
              type="date"
              value={toDate}
              onChange={event => setToDate(event.target.value)}
              className="w-full rounded-xl border border-[color:var(--line)] bg-[rgba(255,246,230,0.045)] px-4 py-2 text-sm text-[#f4ece0] focus:border-[rgba(214,171,91,0.6)] focus:outline-none"
            />
          </div>
        </div>

        <div className="mt-5 grid grid-cols-3 gap-4">
          <div className="rounded-xl border border-[color:var(--line)] bg-[rgba(11,10,8,0.55)] p-4 text-center">
            <span className="mb-1 block text-xs text-slate-400">{t("payroll.workedDays")}</span>
            <span className="font-mono text-2xl font-bold text-blue-400">{records.length}</span>
          </div>
          <div className="rounded-xl border border-[color:var(--line)] bg-[rgba(11,10,8,0.55)] p-4 text-center">
            <span className="mb-1 block text-xs text-slate-400">{t("attendance.netHours")}</span>
            <span className="font-mono text-2xl font-bold text-emerald-400">{minutesToHours(totalMinutes)}</span>
          </div>
          <div className="rounded-xl border border-[color:var(--line)] bg-[rgba(11,10,8,0.55)] p-4 text-center">
            <span className="mb-1 block text-xs text-slate-400">{t("attendance.breakMinutes")}</span>
            <span className="font-mono text-2xl font-bold text-amber-400">{totalBreaks}</span>
          </div>
        </div>

        <div className="print-only-section mt-6 overflow-hidden rounded-xl border border-[color:var(--line)]">
          <div className="flex items-center justify-between border-b border-[color:var(--line)] bg-[rgba(11,10,8,0.55)] p-4">
            <div>
              <h4 className="text-sm font-bold text-slate-200">
                {settings.companyName} — {employee.fullName}
              </h4>
              <p className="mt-0.5 text-xs text-slate-400">
                {fromDate} → {toDate}
              </p>
            </div>
            <span className="rounded-lg bg-slate-800 px-3 py-1 font-mono text-xs font-bold text-blue-300">
              {employee.employeeCode}
            </span>
          </div>

          {loading ? (
            <div className="flex items-center justify-center gap-2 p-10 text-sm text-slate-400">
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              {t("common.loading")}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="data-table text-xs">
                <thead>
                  <tr>
                    <th className="px-3 py-2.5 text-start">{t("attendance.date")}</th>
                    <th className="px-3 py-2.5 text-start">{t("attendance.inTime")}</th>
                    <th className="px-3 py-2.5 text-start">{t("attendance.breakMinutes")}</th>
                    <th className="px-3 py-2.5 text-start">{t("attendance.outTime")}</th>
                    <th className="px-3 py-2.5 text-start">{t("attendance.netHours")}</th>
                    <th className="px-3 py-2.5 text-start">{t("employees.status")}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {records.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="p-8 text-center text-slate-500">
                        {t("attendance.noRecords")}
                      </td>
                    </tr>
                  ) : (
                    records.map(record => (
                      <tr key={record.id} className="transition-colors hover:bg-[rgba(201,162,75,0.05)]">
                        <td className="p-3 font-mono text-slate-200">{record.recordDate}</td>
                        <td className="p-3 font-mono text-emerald-400">{formatTime(record.punchInAt, lang)}</td>
                        <td className="p-3 font-mono text-amber-400">{record.breakMinutes}</td>
                        <td className="p-3 font-mono text-blue-400">{formatTime(record.punchOutAt, lang)}</td>
                        <td className="p-3 font-mono font-bold text-purple-400">
                          {formatDuration(record.netMinutes, t("common.hours"), t("common.minutes"))}
                        </td>
                        <td className="p-3">
                          {record.status === "completed" ? t("kiosk.status.completed") : t("kiosk.status.working")}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
