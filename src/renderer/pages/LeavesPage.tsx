import React, { useCallback, useEffect, useState } from "react"
import { useTranslation } from "react-i18next"
import { CalendarDays, Edit3, Loader2, Plus, Trash2, X } from "lucide-react"

import { api } from "../services/api"
import { errorKey, isApiError } from "../services/errors"
import { addDays, daysBetween, todayKey } from "../services/date"
import { CompanySettings, Employee, LeaveRecord, LeaveType } from "../types"
import { ConfirmDialog } from "../components/ConfirmDialog"
import { FeedbackBanner, FeedbackTone } from "../components/FeedbackBanner"

interface LeavesPageProps {
  settings: CompanySettings
  onSessionEnded: (message: string) => void
}

const LEAVE_TYPES: LeaveType[] = ["paid", "unpaid", "sick", "emergency"]

interface LeaveFormState {
  id?: string
  employeeId: string
  leaveType: LeaveType
  startDate: string
  endDate: string
  isPaid: boolean
  reason: string
}

export const LeavesPage: React.FC<LeavesPageProps> = ({ onSessionEnded }) => {
  const { t } = useTranslation()
  const [leaves, setLeaves] = useState<LeaveRecord[]>([])
  const [employees, setEmployees] = useState<Employee[]>([])
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState<LeaveFormState | null>(null)
  const [deleting, setDeleting] = useState<LeaveRecord | null>(null)
  const [saving, setSaving] = useState(false)
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
      const [rows, staff] = await Promise.all([api.leaves.list(), api.employees.list(true)])
      setLeaves(rows)
      setEmployees(staff.filter(employee => employee.isActive || rows.some(leave => leave.employeeId === employee.id)))
    } catch (caught) {
      handleError(caught)
    } finally {
      setLoading(false)
    }
  }, [handleError])

  useEffect(() => {
    void load()
  }, [load])

  const openAdd = () => {
    setForm({
      employeeId: employees[0]?.id ?? "",
      leaveType: "paid",
      startDate: todayKey(),
      endDate: addDays(todayKey(), 1),
      isPaid: true,
      reason: ""
    })
  }

  const openEdit = (leave: LeaveRecord) => {
    setForm({
      id: leave.id,
      employeeId: leave.employeeId,
      leaveType: leave.leaveType,
      startDate: leave.startDate,
      endDate: leave.endDate,
      isPaid: leave.isPaid,
      reason: leave.reason
    })
  }

  const handleSave = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!form) return
    setSaving(true)
    try {
      await api.leaves.save({
        id: form.id,
        employeeId: form.employeeId,
        leaveType: form.leaveType,
        startDate: form.startDate,
        endDate: form.endDate,
        isPaid: form.isPaid,
        reason: form.reason
      })
      setForm(null)
      setFeedback({ tone: "success", message: t("settings.savedSuccess") })
      await load()
    } catch (caught) {
      handleError(caught)
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!deleting) return
    try {
      await api.leaves.remove(deleting.id)
      setDeleting(null)
      await load()
    } catch (caught) {
      setDeleting(null)
      handleError(caught)
    }
  }

  const totalDays = leaves.reduce((total, leave) => total + leave.days, 0)
  const unpaidDays = leaves.filter(leave => !leave.isPaid).reduce((total, leave) => total + leave.days, 0)
  const formDays = form ? daysBetween(form.startDate, form.endDate).length : 0

  return (
    <div className="space-y-6">
      {feedback && <FeedbackBanner tone={feedback.tone} message={feedback.message} onClose={() => setFeedback(null)} />}

      <div className="panel flex flex-wrap items-center justify-between gap-4 px-6 py-5">
        <div>
          <p className="eyebrow">
            <CalendarDays className="h-3.5 w-3.5" aria-hidden />
            {t("admin.dashboard")}
          </p>
          <h2 className="mt-1 text-lg font-semibold tracking-tight text-[#f4ece0]">
            <span>{t("leaves.title")}</span>
          </h2>
          <p className="mt-1 text-xs text-slate-400">
            {t("leaves.summaryLine", { count: leaves.length, days: totalDays, unpaid: unpaidDays })}
          </p>
        </div>
        <button
          type="button"
          onClick={openAdd}
          disabled={employees.length === 0}
          className="btn btn-primary"
        >
          <Plus className="h-4 w-4" aria-hidden />
          <span>{t("leaves.add")}</span>
        </button>
      </div>

      <div className="panel overflow-hidden">
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>{t("leaves.employee")}</th>
                <th>{t("leaves.type")}</th>
                <th>{t("leaves.startDate")}</th>
                <th>{t("leaves.endDate")}</th>
                <th>{t("leaves.days")}</th>
                <th>{t("common.status")}</th>
                <th>{t("leaves.reason")}</th>
                <th className="text-center">{t("employees.actions")}</th>
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
              ) : leaves.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-14 text-center text-slate-500">
                    {t("leaves.noRecords")}
                  </td>
                </tr>
              ) : (
                leaves.map(leave => (
                  <tr key={leave.id}>
                    <td className="font-semibold text-[#f0e9df]">{leave.employeeName}</td>
                    <td>
                      <span className="chip">{t(`leaves.types.${leave.leaveType}`)}</span>
                    </td>
                    <td className="whitespace-nowrap font-mono text-[#ded4c6]">{leave.startDate}</td>
                    <td className="whitespace-nowrap font-mono text-[#ded4c6]">{leave.endDate}</td>
                    <td className="whitespace-nowrap font-mono font-semibold text-[#d6ab5b]">{leave.days}</td>
                    <td>
                      <span
                        className={`chip ${
                          leave.isPaid
                            ? "border-[rgba(70,195,159,0.35)] bg-[rgba(43,166,136,0.14)] text-[#78dcbc]"
                            : "border-[rgba(200,95,78,0.35)] bg-[rgba(200,95,78,0.14)] text-[#e9a094]"
                        }`}
                      >
                        {leave.isPaid ? t("leaves.paid") : t("leaves.unpaid")}
                      </span>
                    </td>
                    <td className="max-w-[16rem] truncate text-xs text-[#8d8275]" title={leave.reason || undefined}>
                      {leave.reason || "-"}
                    </td>
                    <td>
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => openEdit(leave)}
                          className="flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800 px-2.5 py-1.5 text-xs text-slate-200 transition-colors hover:bg-slate-700"
                        >
                          <Edit3 className="h-3.5 w-3.5 text-blue-400" aria-hidden />
                          <span>{t("common.edit")}</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleting(leave)}
                          title={t("common.delete")}
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

      {form && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(6,5,4,0.74)] p-4 backdrop-blur-sm">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="leave-form-title"
            className="panel w-full max-w-lg p-6"
          >
            <div className="flex items-center justify-between border-b border-[color:var(--line)] pb-4">
              <h3 id="leave-form-title" className="text-base font-semibold text-[#f4ece0]">
                {form.id ? t("leaves.edit") : t("leaves.add")}
              </h3>
              <button
                type="button"
                onClick={() => setForm(null)}
                className="rounded-lg p-1 text-[#9d9182] transition-colors hover:bg-[rgba(255,246,230,0.06)] hover:text-[#f4ece0]"
                aria-label={t("common.close")}
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSave} className="mt-5 space-y-4">
              <div>
                <label className="mb-1.5 block text-xs font-medium text-slate-400" htmlFor="leave-employee">
                  {t("leaves.employee")} *
                </label>
                <select
                  id="leave-employee"
                  required
                  value={form.employeeId}
                  onChange={event => setForm({ ...form, employeeId: event.target.value })}
                  className="w-full rounded-xl border border-[color:var(--line)] bg-[rgba(255,246,230,0.045)] px-4 py-2.5 text-sm text-[#f4ece0] focus:border-[rgba(214,171,91,0.6)] focus:outline-none"
                >
                  {employees.map(employee => (
                    <option key={employee.id} value={employee.id}>
                      {employee.fullName} ({employee.employeeCode})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-slate-400" htmlFor="leave-type">
                    {t("leaves.type")}
                  </label>
                  <select
                    id="leave-type"
                    value={form.leaveType}
                    onChange={event => setForm({ ...form, leaveType: event.target.value as LeaveType })}
                    className="w-full rounded-xl border border-[color:var(--line)] bg-[rgba(255,246,230,0.045)] px-4 py-2.5 text-sm text-[#f4ece0] focus:border-[rgba(214,171,91,0.6)] focus:outline-none"
                  >
                    {LEAVE_TYPES.map(type => (
                      <option key={type} value={type}>
                        {t(`leaves.types.${type}`)}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex items-end">
                  <label className="flex w-full cursor-pointer items-center gap-2 rounded-xl border border-[color:var(--line)] bg-[rgba(255,246,230,0.045)] px-4 py-2.5 text-sm text-[#ded4c6]">
                    <input
                      type="checkbox"
                      checked={form.isPaid}
                      onChange={event => setForm({ ...form, isPaid: event.target.checked })}
                      className="h-4 w-4 cursor-pointer accent-[#c08f38]"
                    />
                    <span>{t("leaves.paid")}</span>
                  </label>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-slate-400" htmlFor="leave-start">
                    {t("leaves.startDate")}
                  </label>
                  <input
                    id="leave-start"
                    type="date"
                    required
                    value={form.startDate}
                    onChange={event => setForm({ ...form, startDate: event.target.value })}
                    className="w-full rounded-xl border border-[color:var(--line)] bg-[rgba(255,246,230,0.045)] px-4 py-2.5 text-sm text-[#f4ece0] focus:border-[rgba(214,171,91,0.6)] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-slate-400" htmlFor="leave-end">
                    {t("leaves.endDate")}
                  </label>
                  <input
                    id="leave-end"
                    type="date"
                    required
                    value={form.endDate}
                    onChange={event => setForm({ ...form, endDate: event.target.value })}
                    className="w-full rounded-xl border border-[color:var(--line)] bg-[rgba(255,246,230,0.045)] px-4 py-2.5 text-sm text-[#f4ece0] focus:border-[rgba(214,171,91,0.6)] focus:outline-none"
                  />
                </div>
              </div>

              <div
                className={`rounded-xl border px-3.5 py-2.5 ${
                  formDays < 1
                    ? "border-[rgba(200,95,78,0.35)] bg-[rgba(200,95,78,0.07)]"
                    : "border-[color:var(--line)] bg-[rgba(255,246,230,0.025)]"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-[0.72rem] font-medium text-[#9d9182]">{t("leaves.days")}</span>
                  <span className="font-mono text-[0.85rem] font-semibold text-[#d6ab5b]">
                    {formDays} {t("leaves.dayUnit")}
                  </span>
                </div>
                {formDays < 1 && (
                  <p className="mt-1.5 text-[0.7rem] leading-relaxed text-[#e9a094]">{t("leaves.invalidRange")}</p>
                )}
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-medium text-slate-400" htmlFor="leave-reason">
                  {t("leaves.reason")} ({t("common.optional")})
                </label>
                <textarea
                  id="leave-reason"
                  rows={2}
                  maxLength={300}
                  value={form.reason}
                  onChange={event => setForm({ ...form, reason: event.target.value })}
                  className="w-full rounded-xl border border-[color:var(--line)] bg-[rgba(255,246,230,0.045)] px-4 py-2.5 text-sm text-[#f4ece0] focus:border-[rgba(214,171,91,0.6)] focus:outline-none"
                />
              </div>

              <div className="flex gap-2.5 border-t border-[color:var(--line)] pt-4">
                <button type="button" onClick={() => setForm(null)} className="btn btn-ghost flex-1">
                  {t("common.cancel")}
                </button>
                <button type="submit" disabled={saving || formDays < 1} className="btn btn-primary flex-1">
                  {saving ? t("common.loading") : t("common.save")}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ConfirmDialog
        isOpen={Boolean(deleting)}
        title={t("common.delete")}
        message={`${deleting?.employeeName ?? ""} — ${deleting?.startDate ?? ""} → ${deleting?.endDate ?? ""}. ${t("leaves.confirmDelete")}`}
        confirmLabel={t("common.delete")}
        cancelLabel={t("common.cancel")}
        onConfirm={() => void handleDelete()}
        onCancel={() => setDeleting(null)}
      />
    </div>
  )
}
