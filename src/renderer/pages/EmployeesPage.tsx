import React, { useCallback, useEffect, useState } from "react"
import { useTranslation } from "react-i18next"
import {
  Edit3,
  FileSpreadsheet,
  Loader2,
  Plus,
  Power,
  Search,
  Trash2,
  User,
  X
} from "lucide-react"

import { api } from "../services/api"
import { errorKey, isApiError } from "../services/errors"
import { fromInputValue, toInputValue } from "../services/money"
import { CompanySettings, Employee, SalaryType } from "../types"
import { ConfirmDialog } from "../components/ConfirmDialog"
import { EmployeeReportModal } from "../components/EmployeeReportModal"
import { FeedbackBanner, FeedbackTone } from "../components/FeedbackBanner"

interface EmployeesPageProps {
  settings: CompanySettings
  onSessionEnded: (message: string) => void
}

interface EmployeeFormState {
  id?: string
  fullName: string
  employeeCode: string
  phone: string
  department: string
  salaryType: SalaryType
  baseRate: string
}

const emptyForm = (): EmployeeFormState => ({
  fullName: "",
  employeeCode: "",
  phone: "",
  department: "",
  salaryType: "fixed_monthly",
  baseRate: "0"
})

const SALARY_TYPES: SalaryType[] = ["fixed_monthly", "hourly", "daily", "custom"]

export const EmployeesPage: React.FC<EmployeesPageProps> = ({ settings, onSessionEnded }) => {
  const { t } = useTranslation()
  const [employees, setEmployees] = useState<Employee[]>([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState("")
  const [form, setForm] = useState<EmployeeFormState | null>(null)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState<Employee | null>(null)
  const [reporting, setReporting] = useState<Employee | null>(null)
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
      setEmployees(await api.employees.list(true))
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
    setForm({ ...emptyForm(), baseRate: toInputValue(0, settings.currencyDecimals) })
  }

  const openEdit = (employee: Employee) => {
    setForm({
      id: employee.id,
      fullName: employee.fullName,
      employeeCode: employee.employeeCode,
      phone: employee.phone,
      department: employee.department,
      salaryType: employee.salaryType,
      baseRate: toInputValue(employee.baseRateMinor, settings.currencyDecimals)
    })
  }

  const handleSave = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!form) return
    setSaving(true)
    try {
      await api.employees.save({
        id: form.id,
        fullName: form.fullName,
        employeeCode: form.employeeCode,
        phone: form.phone,
        department: form.department,
        salaryType: form.salaryType,
        baseRateMinor: fromInputValue(form.baseRate, settings.currencyDecimals)
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

  const handleToggleActive = async (employee: Employee) => {
    try {
      await api.employees.setActive(employee.id, !employee.isActive)
      await load()
    } catch (caught) {
      handleError(caught)
    }
  }

  const handleDelete = async () => {
    if (!deleting) return
    try {
      await api.employees.remove(deleting.id)
      setDeleting(null)
      await load()
    } catch (caught) {
      setDeleting(null)
      handleError(caught)
    }
  }

  const filtered = employees.filter(employee => {
    const term = query.trim().toLowerCase()
    if (!term) return true
    return [employee.fullName, employee.employeeCode, employee.department]
      .join(" ")
      .toLowerCase()
      .includes(term)
  })

  const activeCount = employees.filter(employee => employee.isActive).length

  return (
    <div className="space-y-6">
      {feedback && <FeedbackBanner tone={feedback.tone} message={feedback.message} onClose={() => setFeedback(null)} />}

      <div className="panel flex flex-wrap items-center justify-between gap-4 px-6 py-5">
        <div>
          <p className="eyebrow">{t("admin.dashboard")}</p>
          <h2 className="mt-1 text-lg font-semibold tracking-tight text-[#f4ece0]">{t("admin.employees")}</h2>
          <p className="mt-1 text-xs text-slate-400">
            {t("employees.countSummary", { total: employees.length, active: activeCount })}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="pointer-events-none absolute start-3 top-2.5 h-4 w-4 text-slate-400" aria-hidden />
            <input
              type="search"
              value={query}
              onChange={event => setQuery(event.target.value)}
              placeholder={t("employees.searchPlaceholder")}
              aria-label={t("employees.searchPlaceholder")}
              className="w-56 rounded-xl border border-[color:var(--line)] bg-[rgba(255,246,230,0.045)] py-2 pe-3 ps-9 text-sm text-[#f4ece0] placeholder-[#6b6054] focus:border-[rgba(214,171,91,0.6)] focus:outline-none"
            />
          </div>
          <button
            type="button"
            onClick={openAdd}
            className="btn btn-primary"
          >
            <Plus className="h-4 w-4" aria-hidden />
            <span>{t("employees.addEmployee")}</span>
          </button>
        </div>
      </div>

      <div className="panel overflow-hidden">
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>{t("employees.name")}</th>
                <th>{t("employees.code")}</th>
                <th>{t("employees.department")}</th>
                <th>{t("employees.salaryType")}</th>
                <th>{t("employees.baseRate")}</th>
                <th>{t("employees.phone")}</th>
                <th>{t("employees.status")}</th>
                <th className="text-center">{t("employees.actions")}</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={8} className="px-6 py-16 text-center text-slate-400">
                    <Loader2 className="mx-auto mb-2 h-5 w-5 animate-spin" aria-hidden />
                    {t("common.loading")}
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-16 text-center text-sm text-slate-500">
                    <User className="mx-auto mb-3 h-12 w-12 text-slate-600 opacity-60" aria-hidden />
                    <p className="text-base font-semibold text-slate-400">{t("employees.noEmployees")}</p>
                    <button
                      type="button"
                      onClick={openAdd}
                      className="btn btn-primary mt-4 text-xs"
                    >
                      {t("employees.addEmployee")}
                    </button>
                  </td>
                </tr>
              ) : (
                filtered.map(employee => (
                  <tr key={employee.id}>
                    <td className="flex items-center gap-3 font-semibold leading-snug text-[#f0e9df]">
                      <span className="grid h-9 w-9 place-items-center rounded-lg border border-[rgba(214,171,91,0.25)] bg-[rgba(214,171,91,0.1)] text-sm font-semibold text-[#e6c98a]">
                        {employee.fullName.slice(0, 1)}
                      </span>
                      <span>{employee.fullName}</span>
                    </td>
                    <td className="font-mono text-[#d6ab5b]">{employee.employeeCode}</td>
                    <td className="max-w-[11rem] truncate text-[#c0b4a3]" title={employee.department || undefined}>
                      {employee.department || "-"}
                    </td>
                    <td>
                      <span className="chip">
                        {t(`employees.salaryTypes.${employee.salaryType}`)}
                      </span>
                    </td>
                    <td className="whitespace-nowrap font-mono font-semibold text-[#78dcbc]">
                      {toInputValue(employee.baseRateMinor, settings.currencyDecimals)} {settings.currency}
                    </td>
                    <td className="whitespace-nowrap font-mono text-xs text-[#8d8275]">{employee.phone || "-"}</td>
                    <td>
                      <span
                        className={`rounded-full border px-2.5 py-0.5 text-[0.7rem] font-semibold ${
                          employee.isActive
                            ? "border-emerald-500/30 bg-emerald-500/20 text-emerald-400"
                            : "border-slate-700 bg-slate-800 text-slate-500"
                        }`}
                      >
                        {employee.isActive ? t("employees.active") : t("employees.inactive")}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          type="button"
                          onClick={() => setReporting(employee)}
                          title={t("employees.workReport")}
                          aria-label={t("employees.workReport")}
                          className="grid h-8 w-8 place-items-center rounded-lg border border-[rgba(70,195,159,0.28)] bg-[rgba(43,166,136,0.12)] text-[#78dcbc] transition-colors hover:bg-[rgba(43,166,136,0.22)]"
                        >
                          <FileSpreadsheet className="h-3.5 w-3.5" aria-hidden />
                        </button>
                        <button
                          type="button"
                          onClick={() => openEdit(employee)}
                          title={t("common.edit")}
                          aria-label={t("common.edit")}
                          className="grid h-8 w-8 place-items-center rounded-lg border border-[color:var(--line)] bg-[rgba(255,246,230,0.04)] text-[#ded4c6] transition-colors hover:bg-[rgba(255,246,230,0.08)]"
                        >
                          <Edit3 className="h-3.5 w-3.5 text-[#d6ab5b]" aria-hidden />
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleToggleActive(employee)}
                          title={employee.isActive ? t("employees.deactivate") : t("employees.activate")}
                          aria-label={employee.isActive ? t("employees.deactivate") : t("employees.activate")}
                          className={`grid h-8 w-8 place-items-center rounded-lg border transition-colors ${
                            employee.isActive
                              ? "border-[rgba(216,149,78,0.3)] bg-[rgba(216,149,78,0.1)] text-[#e6b276] hover:bg-[rgba(216,149,78,0.2)]"
                              : "border-[rgba(70,195,159,0.3)] bg-[rgba(43,166,136,0.12)] text-[#78dcbc] hover:bg-[rgba(43,166,136,0.22)]"
                          }`}
                        >
                          <Power className="h-3.5 w-3.5" aria-hidden />
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleting(employee)}
                          title={t("employees.deletePermanent")}
                          aria-label={t("employees.deletePermanent")}
                          className="grid h-8 w-8 place-items-center rounded-lg border border-[rgba(200,95,78,0.3)] bg-[rgba(200,95,78,0.1)] text-[#e9a094] transition-colors hover:bg-[rgba(200,95,78,0.22)]"
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
        <p className="border-t border-[color:var(--line)] bg-[rgba(11,10,8,0.5)] px-6 py-3 text-[0.66rem] text-[#7b7063]">
          {t("employees.deleteHint")}
        </p>
      </div>

      {form && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(6,5,4,0.74)] p-4 backdrop-blur-sm">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="employee-form-title"
            className="custom-scrollbar panel max-h-[90vh] w-full max-w-lg overflow-y-auto p-6"
          >
            <div className="flex items-center justify-between border-b border-[color:var(--line)] pb-4">
              <h3 id="employee-form-title" className="text-base font-semibold text-[#f4ece0]">
                {form.id ? t("employees.editEmployee") : t("employees.addEmployee")}
              </h3>
              <button
                type="button"
                onClick={() => setForm(null)}
                className="rounded-lg p-1 text-slate-400 transition-colors hover:bg-[rgba(255,246,230,0.06)] hover:text-[#f4ece0]"
                aria-label={t("common.close")}
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSave} className="mt-6 space-y-4">
              <div>
                <label className="mb-1.5 block text-xs font-medium text-slate-400" htmlFor="employee-name">
                  {t("employees.name")} *
                </label>
                <input
                  id="employee-name"
                  type="text"
                  required
                  value={form.fullName}
                  onChange={event => setForm({ ...form, fullName: event.target.value })}
                  className="w-full rounded-xl border border-[color:var(--line)] bg-[rgba(255,246,230,0.045)] px-4 py-2.5 text-sm text-[#f4ece0] focus:border-[rgba(214,171,91,0.6)] focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-slate-400" htmlFor="employee-code">
                    {t("employees.code")} *
                  </label>
                  <input
                    id="employee-code"
                    type="text"
                    required
                    value={form.employeeCode}
                    onChange={event => setForm({ ...form, employeeCode: event.target.value })}
                    className="w-full rounded-xl border border-[color:var(--line)] bg-[rgba(255,246,230,0.045)] px-4 py-2.5 font-mono text-sm text-[#f4ece0] focus:border-[rgba(214,171,91,0.6)] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-slate-400" htmlFor="employee-department">
                    {t("employees.department")}
                  </label>
                  <input
                    id="employee-department"
                    type="text"
                    value={form.department}
                    onChange={event => setForm({ ...form, department: event.target.value })}
                    className="w-full rounded-xl border border-[color:var(--line)] bg-[rgba(255,246,230,0.045)] px-4 py-2.5 text-sm text-[#f4ece0] focus:border-[rgba(214,171,91,0.6)] focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-slate-400" htmlFor="employee-salary-type">
                    {t("employees.salaryType")}
                  </label>
                  <select
                    id="employee-salary-type"
                    value={form.salaryType}
                    onChange={event => setForm({ ...form, salaryType: event.target.value as SalaryType })}
                    style={{ colorScheme: "dark", backgroundColor: "#14110d" }}
                    className="w-full rounded-xl border border-[color:var(--line)] bg-[#14110d] px-4 py-2.5 text-sm text-[#f4ece0] focus:border-[rgba(214,171,91,0.6)] focus:outline-none [color-scheme:dark]"
                  >
                    {SALARY_TYPES.map(type => (
                      <option key={type} value={type} style={{ backgroundColor: "#14110d", color: "#f4ece0" }} className="bg-[#14110d] text-[#f4ece0]">
                        {t(`employees.salaryTypes.${type}`)}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-slate-400" htmlFor="employee-rate">
                    {t("employees.baseRate")} ({settings.currency})
                  </label>
                  <input
                    id="employee-rate"
                    type="number"
                    step={Math.pow(10, -settings.currencyDecimals)}
                    min={0}
                    dir="ltr"
                    value={form.baseRate}
                    onChange={event => setForm({ ...form, baseRate: event.target.value })}
                    className="w-full rounded-xl border border-[color:var(--line)] bg-[rgba(255,246,230,0.045)] px-4 py-2.5 font-mono text-sm text-[#f4ece0] focus:border-[rgba(214,171,91,0.6)] focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-medium text-slate-400" htmlFor="employee-phone">
                  {t("employees.phone")}
                </label>
                <input
                  id="employee-phone"
                  type="tel"
                  value={form.phone}
                  onChange={event => setForm({ ...form, phone: event.target.value })}
                  placeholder="+965 ..."
                  dir="ltr"
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-2.5 font-mono text-sm text-slate-100 focus:border-blue-500 focus:outline-none"
                />
              </div>

              <div className="flex gap-2.5 border-t border-[color:var(--line)] pt-4">
                <button type="button" onClick={() => setForm(null)} className="btn btn-ghost flex-1">
                  {t("common.cancel")}
                </button>
                <button type="submit" disabled={saving} className="btn btn-primary flex-1">
                  {saving ? t("common.loading") : t("common.save")}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ConfirmDialog
        isOpen={Boolean(deleting)}
        title={t("employees.deletePermanent")}
        message={`${deleting?.fullName ?? ""} — ${t("employees.confirmDelete")}`}
        confirmLabel={t("employees.deletePermanent")}
        cancelLabel={t("common.cancel")}
        onConfirm={() => void handleDelete()}
        onCancel={() => setDeleting(null)}
      />

      <EmployeeReportModal
        employee={reporting}
        isOpen={Boolean(reporting)}
        onClose={() => setReporting(null)}
        settings={settings}
        onSessionEnded={onSessionEnded}
      />

    </div>
  )
}
