import React, { useCallback, useEffect, useMemo, useState } from "react"
import { useTranslation } from "react-i18next"
import { AlertTriangle, ClipboardCheck, Eraser, Loader2, RefreshCw } from "lucide-react"

import { api } from "../services/api"
import { errorKey, isApiError } from "../services/errors"
import { formatDuration, minutesToHours, minutesToTime, monthEndKey, todayKey } from "../services/date"
import { CompanySettings, MonthCloseReport } from "../types"
import { ConfirmDialog } from "../components/ConfirmDialog"
import { FeedbackBanner, FeedbackTone } from "../components/FeedbackBanner"

interface MonthClosePageProps {
  settings: CompanySettings
  onSessionEnded: (message: string) => void
}

type PendingAction = "mark" | "clear"

export const MonthClosePage: React.FC<MonthClosePageProps> = ({ onSessionEnded }) => {
  const { t } = useTranslation()

  const [month, setMonth] = useState(() => todayKey().slice(0, 7))
  const [report, setReport] = useState<MonthCloseReport | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<string | null>(null)
  const [feedback, setFeedback] = useState<{ tone: FeedbackTone; message: string } | null>(null)
  const [pending, setPending] = useState<PendingAction | null>(null)

  const fromDate = `${month}-01`
  const toDate = useMemo(() => monthEndKey(fromDate), [fromDate])

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
      setReport(await api.reports.monthClose(fromDate, toDate))
    } catch (caught) {
      handleError(caught)
    } finally {
      setLoading(false)
    }
  }, [fromDate, toDate, handleError])

  useEffect(() => {
    void load()
  }, [load])

  const runAction = async (kind: "recalculate" | "mark" | "clear") => {
    setBusy(kind)
    try {
      if (kind === "recalculate") {
        const result = await api.attendance.recalculate(fromDate, toDate)
        setFeedback({ tone: "success", message: t("monthClose.recalculated", { count: result.updated ?? 0 }) })
      } else if (kind === "mark") {
        const result = await api.attendance.markAbsences(fromDate, toDate)
        setFeedback({ tone: "success", message: t("monthClose.absencesMarked", { count: result.inserted ?? 0 }) })
      } else {
        const result = await api.attendance.clearAbsences(fromDate, toDate)
        setFeedback({ tone: "success", message: t("monthClose.absencesCleared", { count: result.deleted ?? 0 }) })
      }
      setPending(null)
      await load()
    } catch (caught) {
      setPending(null)
      handleError(caught)
    } finally {
      setBusy(null)
    }
  }

  const totals = report?.totals
  const employees = report?.employees ?? []
  const hourUnit = t("common.hours")
  const minuteUnit = t("common.minutes")

  const tiles = totals
    ? [
      { key: "required", label: t("monthClose.required"), value: String(totals.requiredDays), tone: "text-[#f4ece0]" },
      { key: "present", label: t("monthClose.present"), value: String(totals.presentDays), tone: "text-[#78dcbc]" },
      { key: "absent", label: t("monthClose.absent"), value: String(totals.absentDays), tone: "text-[#e9a094]" },
      { key: "leave", label: t("monthClose.leaveDays"), value: String(totals.leaveDays), tone: "text-[#e6c98a]" },
      {
        key: "late",
        label: t("monthClose.lateHours"),
        value: String(minutesToHours(totals.lateMinutes)),
        tone: "text-[#e6b276]"
      },
      { key: "unpaid", label: t("monthClose.unpaid"), value: String(totals.unpaidLeaveDays), tone: "text-[#c2a3d8]" }
    ]
    : []

  return (
    <div className="space-y-6">
      {feedback && (
        <FeedbackBanner tone={feedback.tone} message={feedback.message} onClose={() => setFeedback(null)} />
      )}

      <div className="panel overflow-hidden no-print">
        <div className="flex flex-wrap items-start justify-between gap-4 px-6 pb-5 pt-5">
          <div>
            <p className="eyebrow">{t("admin.dashboard")}</p>
            <h2 className="mt-1 text-lg font-semibold tracking-tight text-[#f4ece0]">{t("monthClose.title")}</h2>
            <p className="mt-1 max-w-xl text-xs leading-relaxed text-[#8d8275]">{t("monthClose.subtitle")}</p>
            {report && (
              <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[0.68rem] text-[#9d9182]">
                <span>
                  {t("monthClose.shiftLine", {
                    start: minutesToTime(report.shift.startMinutes),
                    end: minutesToTime(report.shift.endMinutes),
                    grace: report.shift.graceMinutes
                  })}
                </span>
                {report.asOf < report.periodEnd && (
                  <span className="chip border-[rgba(214,171,91,0.3)] bg-[rgba(214,171,91,0.1)] text-[#e6c98a]">
                    {t("monthClose.asOf", { date: report.asOf })}
                  </span>
                )}
              </p>
            )}
          </div>

          <div className="flex flex-wrap items-end gap-2">
            <div>
              <label className="mb-1.5 block text-[0.68rem] font-medium text-[#9d9182]" htmlFor="month-close-period">
                {t("monthClose.period")}
              </label>
              <input
                id="month-close-period"
                type="month"
                value={month}
                onChange={event => setMonth(event.target.value || todayKey().slice(0, 7))}
                className="rounded-xl border border-[color:var(--line)] bg-[rgba(255,246,230,0.045)] px-3 py-2 font-mono text-sm text-[#f4ece0] focus:border-[rgba(214,171,91,0.6)] focus:outline-none"
              />
            </div>
            <button
              type="button"
              onClick={() => void runAction("recalculate")}
              disabled={Boolean(busy) || loading}
              className="btn btn-ghost"
            >
              {busy === "recalculate"
                ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                : <RefreshCw className="h-4 w-4 text-[#d6ab5b]" aria-hidden />}
              <span>{t("monthClose.recalculate")}</span>
            </button>
            <button
              type="button"
              onClick={() => setPending("mark")}
              disabled={Boolean(busy) || loading}
              className="btn btn-primary"
            >
              <ClipboardCheck className="h-4 w-4" aria-hidden />
              <span>{t("monthClose.markAbsences")}</span>
            </button>
            <button
              type="button"
              onClick={() => setPending("clear")}
              disabled={Boolean(busy) || loading}
              className="btn btn-danger"
            >
              <Eraser className="h-4 w-4" aria-hidden />
              <span>{t("monthClose.clearAbsences")}</span>
            </button>
          </div>
        </div>

        {tiles.length > 0 && (
          <div className="grid grid-cols-2 gap-px border-t border-[color:var(--line)] bg-[rgba(214,186,140,0.1)] sm:grid-cols-3 lg:grid-cols-6">
            {tiles.map(tile => (
              <div key={tile.key} className="bg-[rgba(20,17,13,0.94)] px-5 py-4">
                <span className="text-[0.6rem] font-semibold uppercase tracking-[0.13em] text-[#8d8275]">
                  {tile.label}
                </span>
                <span className={`mt-2 block font-mono text-[1.25rem] font-semibold leading-none ${tile.tone}`}>
                  {tile.value}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {totals && totals.openRecords > 0 && (
        <div className="flex items-start gap-2 rounded-xl border border-[rgba(214,171,91,0.3)] bg-[rgba(214,171,91,0.08)] px-4 py-3 text-xs leading-relaxed text-[#e6c98a] no-print">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          <span>{t("monthClose.openWarning", { count: totals.openRecords })}</span>
        </div>
      )}

      <div className="panel overflow-hidden">
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>{t("monthClose.employee")}</th>
                <th>{t("monthClose.required")}</th>
                <th>{t("monthClose.present")}</th>
                <th>{t("monthClose.absent")}</th>
                <th>{t("monthClose.leaveDays")}</th>
                <th>{t("monthClose.late")}</th>
                <th>{t("monthClose.earlyLeave")}</th>
                <th>{t("monthClose.worked")}</th>
                <th>{t("monthClose.overtime")}</th>
                <th>{t("monthClose.open")}</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={10} className="px-6 py-14 text-center text-[#8d8275]">
                    <Loader2 className="mx-auto mb-2 h-5 w-5 animate-spin" aria-hidden />
                    {t("common.loading")}
                  </td>
                </tr>
              ) : employees.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-6 py-14 text-center text-xs text-[#8d8275]">
                    {t("monthClose.empty")}
                  </td>
                </tr>
              ) : (
                employees.map(row => (
                  <tr key={row.employeeId}>
                    <td className="whitespace-nowrap">
                      <span className="block font-semibold text-[#f0e9df]">{row.employeeName}</span>
                      <span className="mt-0.5 block font-mono text-[0.62rem] text-[#6b6054]">
                        {row.employeeCode}
                        {row.department ? ` · ${row.department}` : ""}
                      </span>
                    </td>
                    <td className="whitespace-nowrap font-mono text-[#c0b4a3]">{row.requiredDays}</td>
                    <td className="whitespace-nowrap font-mono font-semibold text-[#78dcbc]">{row.presentDays}</td>
                    <td className="whitespace-nowrap font-mono font-semibold text-[#e9a094]">{row.absentDays}</td>
                    <td className="whitespace-nowrap font-mono text-[#e6c98a]">{row.leaveDays}</td>
                    <td className="whitespace-nowrap font-mono text-[#e6b276]">
                      {row.lateMinutes > 0 ? formatDuration(row.lateMinutes, hourUnit, minuteUnit) : "—"}
                    </td>
                    <td className="whitespace-nowrap font-mono text-[#c98a7e]">
                      {row.earlyLeaveMinutes > 0 ? formatDuration(row.earlyLeaveMinutes, hourUnit, minuteUnit) : "—"}
                    </td>
                    <td className="whitespace-nowrap font-mono text-[#c2a3d8]">
                      {formatDuration(row.workedMinutes, hourUnit, minuteUnit)}
                    </td>
                    <td className="whitespace-nowrap font-mono text-[#e6c98a]">
                      {row.overtimeMinutes > 0 ? formatDuration(row.overtimeMinutes, hourUnit, minuteUnit) : "—"}
                    </td>
                    <td className="whitespace-nowrap">
                      {row.openRecords > 0 ? (
                        <span className="chip border-[rgba(214,171,91,0.35)] bg-[rgba(214,171,91,0.12)] text-[#e6c98a]">
                          {row.openRecords}
                        </span>
                      ) : (
                        <span className="text-[#5c5349]">—</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <ConfirmDialog
        isOpen={pending === "mark"}
        title={t("monthClose.markAbsences")}
        message={t("monthClose.confirmMark")}
        confirmLabel={t("monthClose.markAbsences")}
        cancelLabel={t("common.cancel")}
        onConfirm={() => void runAction("mark")}
        onCancel={() => setPending(null)}
      />

      <ConfirmDialog
        isOpen={pending === "clear"}
        title={t("monthClose.clearAbsences")}
        message={t("monthClose.confirmClear")}
        confirmLabel={t("monthClose.clearAbsences")}
        cancelLabel={t("common.cancel")}
        onConfirm={() => void runAction("clear")}
        onCancel={() => setPending(null)}
      />
    </div>
  )
}
