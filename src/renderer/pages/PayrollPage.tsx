import React, { useCallback, useEffect, useMemo, useState } from "react"
import { useTranslation } from "react-i18next"
import {
  AlertTriangle,
  BadgeCheck,
  Eye,
  FileSpreadsheet,
  FileText,
  History,
  Loader2,
  MessageCircle,
  Pencil,
  Plus,
  Printer,
  Save,
  Search,
  Trash2,
  X
} from "lucide-react"

import { api, isDesktopRuntime } from "../services/api"
import { errorKey, isApiError } from "../services/errors"
import { exportPayslipsExcel } from "../services/excel"
import { addDays, DatePreset, formatDate, formatDateTime, formatDuration, getPresetDateRange, minutesToHours, monthStartKey, todayKey } from "../services/date"
import { formatMoney, fromInputValue, toInputValue } from "../services/money"
import {
  computeNetMinor,
  suggestBaseSalaryMinor,
  suggestOvertimeAmountMinor,
  suggestUnpaidLeaveDeductionMinor
} from "../services/payroll"
import {
  AttendanceSummary,
  CompanySettings,
  Employee,
  Language,
  PaymentMethod,
  Payslip
} from "../types"
import { ConfirmDialog } from "../components/ConfirmDialog"
import { FeedbackBanner, FeedbackTone } from "../components/FeedbackBanner"
import { PayslipPreviewModal } from "../components/PayslipPreviewModal"
import { buildPayslipMessage, openWhatsAppPayslip, cleanPhoneNumber } from "../utils/whatsapp"

interface PayrollPageProps {
  settings: CompanySettings
  onSessionEnded: (message: string) => void
}

interface PayrollFormState {
  id?: string
  employeeId: string
  periodStart: string
  periodEnd: string
  workedDays: number
  workedMinutes: number
  overtimeMinutes: number
  unpaidLeaveDays: number
  baseSalary: string
  overtimeAmount: string
  bonuses: string
  deductions: string
  paymentDate: string
  paymentMethod: PaymentMethod
  notes: string
}

const PAYMENT_METHODS: PaymentMethod[] = ["bank_transfer", "cash", "knet", "cheque"]

const EMPTY_SUMMARY: AttendanceSummary = {
  workedDays: 0,
  workedMinutes: 0,
  breakMinutes: 0,
  overtimeMinutes: 0,
  openRecords: 0,
  firstDate: null,
  lastDate: null
}

export const PayrollPage: React.FC<PayrollPageProps> = ({ settings, onSessionEnded }) => {
  const { t, i18n } = useTranslation()
  const lang = (i18n.language || "ar") as Language
  const decimals = settings.currencyDecimals

  const [employees, setEmployees] = useState<Employee[]>([])
  const [payslips, setPayslips] = useState<Payslip[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [query, setQuery] = useState("")
  const [filterEmployeeId, setFilterEmployeeId] = useState("")
  const [form, setForm] = useState<PayrollFormState | null>(null)
  const [previewPayslip, setPreviewPayslip] = useState<Payslip | null>(null)
  const [summary, setSummary] = useState<AttendanceSummary>(EMPTY_SUMMARY)
  const [loadingSummary, setLoadingSummary] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState<Payslip | null>(null)
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
      const [staff, slips] = await Promise.all([api.employees.list(true), api.payslips.list()])
      setEmployees(staff)
      setPayslips(slips)
      setSelectedId(current => current ?? slips[0]?.id ?? null)
    } catch (caught) {
      handleError(caught)
    } finally {
      setLoading(false)
    }
  }, [handleError])

  useEffect(() => {
    void load()
  }, [load])

  const filteredPayslips = useMemo(() => {
    const term = query.trim().toLowerCase()
    return payslips.filter(slip => {
      if (filterEmployeeId && slip.employeeId !== filterEmployeeId) return false
      if (!term) return true
      return [slip.employeeName, slip.employeeCode, slip.number, slip.periodStart, slip.periodEnd]
        .join(" ")
        .toLowerCase()
        .includes(term)
    })
  }, [payslips, query, filterEmployeeId])

  const selectedPayslip = payslips.find(slip => slip.id === selectedId) ?? null

  const recalculate = useCallback(
    async (employeeId: string, fromDate: string, toDate: string) => {
      const employee = employees.find(item => item.id === employeeId)
      if (!employee) return
      setLoadingSummary(true)
      try {
        const [aggregate, unpaidDays] = await Promise.all([
          api.attendance.aggregate({ employeeId, fromDate, toDate, dailyHours: settings.defaultDailyHours }),
          api.leaves.unpaidDays(employeeId, fromDate, toDate)
        ])
        setSummary(aggregate)
        setForm(current =>
          current
            ? {
                ...current,
                workedDays: aggregate.workedDays,
                workedMinutes: aggregate.workedMinutes,
                overtimeMinutes: aggregate.overtimeMinutes,
                unpaidLeaveDays: unpaidDays,
                baseSalary: toInputValue(suggestBaseSalaryMinor(employee, settings, aggregate), decimals),
                overtimeAmount: toInputValue(suggestOvertimeAmountMinor(employee, settings, aggregate), decimals),
                deductions: toInputValue(suggestUnpaidLeaveDeductionMinor(employee, settings, unpaidDays), decimals)
              }
            : current
        )
      } catch (caught) {
        handleError(caught)
      } finally {
        setLoadingSummary(false)
      }
    },
    [employees, settings, decimals, handleError]
  )

  useEffect(() => {
    if (!form || form.id) return
    void recalculate(form.employeeId, form.periodStart, form.periodEnd)
  }, [form?.employeeId, form?.periodStart, form?.periodEnd, form?.id])

  const openCreate = () => {
    const active = employees.filter(employee => employee.isActive)
    if (active.length === 0) {
      setFeedback({ tone: "error", message: t("employees.noEmployees") })
      return
    }
    const preferred = active.find(employee => employee.id === filterEmployeeId) ?? active[0]
    setSummary(EMPTY_SUMMARY)
    setForm({
      employeeId: preferred.id,
      periodStart: monthStartKey(),
      periodEnd: todayKey(),
      workedDays: 0,
      workedMinutes: 0,
      overtimeMinutes: 0,
      unpaidLeaveDays: 0,
      baseSalary: toInputValue(0, decimals),
      overtimeAmount: toInputValue(0, decimals),
      bonuses: toInputValue(0, decimals),
      deductions: toInputValue(0, decimals),
      paymentDate: todayKey(),
      paymentMethod: "bank_transfer",
      notes: ""
    })
  }

  const openEdit = (slip: Payslip) => {
    setSummary({
      workedDays: slip.workedDays,
      workedMinutes: slip.workedMinutes,
      breakMinutes: slip.breakMinutes,
      overtimeMinutes: slip.overtimeMinutes,
      openRecords: 0,
      firstDate: slip.periodStart,
      lastDate: slip.periodEnd
    })
    setForm({
      id: slip.id,
      employeeId: slip.employeeId,
      periodStart: slip.periodStart,
      periodEnd: slip.periodEnd,
      workedDays: slip.workedDays,
      workedMinutes: slip.workedMinutes,
      overtimeMinutes: slip.overtimeMinutes,
      unpaidLeaveDays: slip.unpaidLeaveDays,
      baseSalary: toInputValue(slip.baseSalaryMinor, decimals),
      overtimeAmount: toInputValue(slip.overtimeAmountMinor, decimals),
      bonuses: toInputValue(slip.bonusesMinor, decimals),
      deductions: toInputValue(slip.deductionsMinor, decimals),
      paymentDate: slip.paymentDate || todayKey(),
      paymentMethod: slip.paymentMethod,
      notes: slip.notes
    })
  }

  const handleSave = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!form) return
    setSaving(true)
    try {
      const saved = await api.payslips.save({
        id: form.id,
        employeeId: form.employeeId,
        periodStart: form.periodStart,
        periodEnd: form.periodEnd,
        workedDays: form.workedDays,
        workedMinutes: form.workedMinutes,
        breakMinutes: summary.breakMinutes,
        overtimeMinutes: form.overtimeMinutes,
        unpaidLeaveDays: form.unpaidLeaveDays,
        baseSalaryMinor: fromInputValue(form.baseSalary, decimals),
        overtimeAmountMinor: fromInputValue(form.overtimeAmount, decimals),
        bonusesMinor: fromInputValue(form.bonuses, decimals),
        deductionsMinor: fromInputValue(form.deductions, decimals),
        paymentDate: form.paymentDate,
        paymentMethod: form.paymentMethod,
        notes: form.notes
      })
      setForm(null)
      setSelectedId(saved.id)
      setFeedback({ tone: "success", message: t("settings.savedSuccess") })
      await load()
    } catch (caught) {
      handleError(caught)
    } finally {
      setSaving(false)
    }
  }

  const handleToggleSigned = async (slip: Payslip) => {
    try {
      const updated = await api.payslips.setSigned(slip.id, !slip.isSigned)
      setPayslips(current => current.map(item => (item.id === updated.id ? updated : item)))
    } catch (caught) {
      handleError(caught)
    }
  }

  const handleDelete = async () => {
    if (!deleting) return
    try {
      await api.payslips.remove(deleting.id)
      setDeleting(null)
      setSelectedId(null)
      await load()
    } catch (caught) {
      setDeleting(null)
      handleError(caught)
    }
  }

  const handlePrint = async () => {
    if (!isDesktopRuntime()) {
      window.print()
      return
    }
    try {
      await api.print.payslip()
    } catch (caught) {
      handleError(caught)
    }
  }

  const handleSavePdf = async () => {
    if (!isDesktopRuntime()) {
      window.print()
      return
    }
    try {
      const result = await api.print.payslipPdf()
      if (!result.canceled && result.filePath) {
        setFeedback({ tone: "success", message: t("settings.savedBackupTo", { path: result.filePath }) })
      }
    } catch (caught) {
      handleError(caught)
    }
  }

  const handleExportLedger = async () => {
    try {
      await exportPayslipsExcel(filteredPayslips, settings)
    } catch (caught) {
      handleError(caught)
    }
  }

  const handleSendWhatsAppForSlip = (slip: Payslip) => {
    const emp = employees.find(item => item.id === slip.employeeId)
    const phone = emp?.phone || ""
    if (!cleanPhoneNumber(phone)) {
      setFeedback({ tone: "error", message: t("payroll.noEmployeePhone") })
      return
    }

    const message = buildPayslipMessage({
      slip,
      settings,
      lang,
      formatMoneyFn: minor => formatMoney(minor, settings.currency, decimals)
    })

    const opened = openWhatsAppPayslip({ phone, message })
    if (opened) {
      setFeedback({ tone: "success", message: t("payroll.whatsAppSuccess") })
    }
  }

  const handleSendWhatsApp = () => {
    if (selectedPayslip) {
      handleSendWhatsAppForSlip(selectedPayslip)
    }
  }

  const formNet = form
    ? computeNetMinor({
        baseSalaryMinor: fromInputValue(form.baseSalary, decimals),
        overtimeAmountMinor: fromInputValue(form.overtimeAmount, decimals),
        bonusesMinor: fromInputValue(form.bonuses, decimals),
        deductionsMinor: fromInputValue(form.deductions, decimals)
      })
    : 0

  const money = (minor: number) => formatMoney(minor, settings.currency, decimals, lang)

  return (
    <div className="space-y-6">
      {feedback && <FeedbackBanner tone={feedback.tone} message={feedback.message} onClose={() => setFeedback(null)} />}

      <div className="panel flex flex-wrap items-center justify-between gap-4 px-6 py-5 no-print">
        <div>
          <p className="eyebrow">{t("admin.dashboard")}</p>
          <h2 className="mt-1 text-lg font-semibold tracking-tight text-[#f4ece0]">{t("payroll.title")}</h2>
          <p className="mt-1 text-xs text-slate-400">
            {t("payroll.archive")} — {payslips.length}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={handleExportLedger}
            disabled={filteredPayslips.length === 0}
            className="btn border border-[rgba(70,195,159,0.4)] bg-[rgba(43,166,136,0.18)] text-[#78dcbc] hover:bg-[rgba(43,166,136,0.3)]"
          >
            <FileSpreadsheet className="h-4 w-4" aria-hidden />
            <span>{t("payroll.exportPayrollExcel")}</span>
          </button>
          <button
            type="button"
            onClick={openCreate}
            className="btn btn-primary"
          >
            <Plus className="h-4 w-4" aria-hidden />
            <span>{t("payroll.generatePayslip")}</span>
          </button>
          {selectedPayslip && (
            <>
              <button
                type="button"
                onClick={() => setPreviewPayslip(selectedPayslip)}
                className="btn border border-[rgba(214,171,91,0.35)] bg-[rgba(214,171,91,0.12)] text-[#e6c98a] hover:bg-[rgba(214,171,91,0.22)]"
              >
                <Eye className="h-4 w-4" aria-hidden />
                <span>{t("payroll.preview.openPreview")}</span>
              </button>
              <button
                type="button"
                onClick={() => void handlePrint()}
                className="btn btn-ghost"
              >
                <Printer className="h-4 w-4 text-blue-400" aria-hidden />
                <span>{t("payroll.printReceipt")}</span>
              </button>
              <button
                type="button"
                onClick={() => void handleSavePdf()}
                className="btn btn-ghost"
              >
                <Save className="h-4 w-4 text-emerald-400" aria-hidden />
                <span>{t("payroll.savePdf")}</span>
              </button>
              <button
                type="button"
                onClick={handleSendWhatsApp}
                className="btn border border-[rgba(70,195,159,0.35)] bg-[rgba(43,166,136,0.16)] text-[#78dcbc] hover:bg-[rgba(43,166,136,0.28)]"
              >
                <MessageCircle className="h-4 w-4 text-emerald-400" aria-hidden />
                <span>{t("payroll.sendWhatsApp")}</span>
              </button>
            </>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-12">
        <div className="panel flex h-[780px] flex-col gap-3 p-5 no-print lg:col-span-4">
          <div className="flex items-center justify-between border-b border-[color:var(--line)] pb-3">
            <div className="flex items-center gap-2 text-slate-200">
              <History className="h-4 w-4 text-blue-400" aria-hidden />
              <h3 className="text-[0.82rem] font-semibold">{t("payroll.archive")}</h3>
            </div>
            <span className="rounded-md border border-[color:var(--line)] bg-[rgba(255,246,230,0.04)] px-2 py-0.5 font-mono text-[0.7rem] font-semibold text-[#e6c98a]">
              {filteredPayslips.length}
            </span>
          </div>

          <div className="space-y-2.5">
            <div className="relative">
              <Search className="pointer-events-none absolute start-3 top-2.5 h-4 w-4 text-slate-400" aria-hidden />
              <input
                type="search"
                value={query}
                onChange={event => setQuery(event.target.value)}
                placeholder={t("payroll.searchPayslips")}
                aria-label={t("payroll.searchPayslips")}
                className="w-full rounded-xl border border-[color:var(--line)] bg-[rgba(255,246,230,0.045)] py-2 pe-3 ps-9 text-xs text-[#f4ece0] placeholder-[#6b6054] focus:border-[rgba(214,171,91,0.6)] focus:outline-none"
              />
            </div>
            <select
              value={filterEmployeeId}
              onChange={event => setFilterEmployeeId(event.target.value)}
              aria-label={t("attendance.filterByEmployee")}
              className="w-full rounded-xl border border-[color:var(--line)] bg-[rgba(255,246,230,0.045)] px-3 py-2 text-xs text-[#f4ece0] focus:border-[rgba(214,171,91,0.6)] focus:outline-none"
            >
              <option value="">{t("attendance.allEmployees")}</option>
              {employees.map(employee => (
                <option key={employee.id} value={employee.id}>
                  {employee.fullName} ({employee.employeeCode})
                </option>
              ))}
            </select>
          </div>

          <div className="custom-scrollbar flex-1 space-y-2.5 overflow-y-auto pe-1">
            {loading ? (
              <div className="flex items-center justify-center gap-2 py-16 text-xs text-slate-400">
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                {t("common.loading")}
              </div>
            ) : filteredPayslips.length === 0 ? (
              <div className="py-16 text-center text-xs text-slate-500">
                <FileText className="mx-auto mb-2 h-10 w-10 text-slate-600 opacity-60" aria-hidden />
                <p>{t("payroll.emptyArchive")}</p>
              </div>
            ) : (
              filteredPayslips.map(slip => {
                const isSelected = selectedId === slip.id
                return (
                  <div
                    key={slip.id}
                    className={`rounded-2xl border p-3.5 transition-all ${
                      isSelected
                        ? "border-[rgba(214,171,91,0.45)] bg-[linear-gradient(90deg,rgba(214,171,91,0.16),rgba(214,171,91,0.03))] shadow-[inset_2px_0_0_0_#d6ab5b]"
                        : "border-[color:var(--line)] bg-[rgba(11,10,8,0.45)] hover:border-[rgba(214,171,186,0.25)] hover:bg-[rgba(255,246,230,0.04)]"
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => setSelectedId(slip.id)}
                      className="w-full text-start focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <h4 className="truncate text-[0.82rem] font-semibold text-[#f0e9df]" title={slip.employeeName}>
                            {slip.employeeName}
                          </h4>
                          <p className="mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-1 font-mono text-[0.63rem] text-[#8d8275]">
                            <span className="whitespace-nowrap" dir="ltr">
                              {slip.number}
                            </span>
                            <span className="text-[#5c5349]" aria-hidden>
                              ·
                            </span>
                            <span className="whitespace-nowrap" dir="ltr">
                              {slip.periodStart} → {slip.periodEnd}
                            </span>
                          </p>
                        </div>
                        <span className="whitespace-nowrap font-mono text-[0.8rem] font-semibold text-[#78dcbc]">
                          {money(slip.netAmountMinor)}
                        </span>
                      </div>
                    </button>
                    <div className="mt-2.5 flex items-center justify-between gap-2 border-t border-[rgba(214,186,140,0.1)] pt-2">
                      <span
                        className={`chip ${
                          slip.isSigned
                            ? "border-[rgba(70,195,159,0.32)] bg-[rgba(43,166,136,0.12)] text-[#78dcbc]"
                            : "text-[#8d8275]"
                        }`}
                      >
                        {slip.isSigned ? t("payroll.signed") : t("payroll.unsigned")}
                      </span>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => setPreviewPayslip(slip)}
                          title={t("payroll.preview.openPreview")}
                          aria-label={t("payroll.preview.openPreview")}
                          className="grid h-7 w-7 place-items-center rounded-md border border-[color:var(--line)] bg-[rgba(255,246,230,0.03)] text-[#9d9182] transition-colors hover:bg-[rgba(255,246,230,0.08)] hover:text-[#e6c98a]"
                        >
                          <Eye className="h-3 w-3" aria-hidden />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleSendWhatsAppForSlip(slip)}
                          title={t("payroll.sendWhatsApp")}
                          aria-label={t("payroll.sendWhatsApp")}
                          className="grid h-7 w-7 place-items-center rounded-md border border-[color:var(--line)] bg-[rgba(255,246,230,0.03)] text-[#9d9182] transition-colors hover:bg-[rgba(255,246,230,0.08)] hover:text-[#78dcbc]"
                        >
                          <MessageCircle className="h-3 w-3" aria-hidden />
                        </button>
                        <button
                          type="button"
                          onClick={() => openEdit(slip)}
                          title={t("common.edit")}
                          aria-label={t("common.edit")}
                          className="grid h-7 w-7 place-items-center rounded-md border border-[color:var(--line)] bg-[rgba(255,246,230,0.03)] text-[#9d9182] transition-colors hover:bg-[rgba(255,246,230,0.08)] hover:text-[#e6c98a]"
                        >
                          <Pencil className="h-3 w-3" aria-hidden />
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleToggleSigned(slip)}
                          title={slip.isSigned ? t("payroll.markUnsigned") : t("payroll.markSigned")}
                          aria-label={slip.isSigned ? t("payroll.markUnsigned") : t("payroll.markSigned")}
                          className={`grid h-7 w-7 place-items-center rounded-md border transition-colors ${
                            slip.isSigned
                              ? "border-[rgba(70,195,159,0.3)] bg-[rgba(43,166,136,0.12)] text-[#78dcbc] hover:bg-[rgba(43,166,136,0.22)]"
                              : "border-[color:var(--line)] bg-[rgba(255,246,230,0.03)] text-[#9d9182] hover:bg-[rgba(255,246,230,0.08)] hover:text-[#78dcbc]"
                          }`}
                        >
                          <BadgeCheck className="h-3 w-3" aria-hidden />
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleting(slip)}
                          title={t("payroll.deletePayslip")}
                          aria-label={t("payroll.deletePayslip")}
                          className="grid h-7 w-7 place-items-center rounded-md border border-[rgba(200,95,78,0.25)] bg-[rgba(200,95,78,0.08)] text-[#c98a7e] transition-colors hover:bg-[rgba(200,95,78,0.18)] hover:text-[#e9a094]"
                        >
                          <Trash2 className="h-3 w-3" aria-hidden />
                        </button>
                      </div>
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </div>

        <div
          className={`print-only-section min-h-[780px] rounded-2xl border p-8 lg:col-span-8 ${
            selectedPayslip
              ? "border-[rgba(28,25,23,0.14)] bg-[#fdfaf3] text-[#1c1917] shadow-[0_36px_70px_-46px_rgba(0,0,0,0.95)]"
              : "border-[color:var(--line)] bg-[rgba(20,17,13,0.55)] text-[#9d9182]"
          }`}
        >
          {selectedPayslip ? (
            <div className="space-y-6">
              <div className="flex flex-wrap items-center justify-between gap-4 border-b-2 border-slate-900 pb-6">
                <div>
                  <h1 className="text-2xl font-black text-slate-900">{settings.companyName}</h1>
                  <p className="mt-1 text-sm font-medium text-slate-600">
                    {settings.ownerName} — {settings.ownerRole}
                  </p>
                </div>
                <div className="text-end">
                  <span className="mb-1 inline-block rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-bold uppercase tracking-wider text-white">
                    {t("payroll.receiptTitle")}
                  </span>
                  <p className="font-mono text-xs text-slate-500">
                    {t("payroll.number")}: {selectedPayslip.number}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 md:grid-cols-4">
                <div>
                  <span className="mb-1 block text-xs text-slate-500">{t("employees.name")}</span>
                  <span className="text-sm font-bold text-slate-900">{selectedPayslip.employeeName}</span>
                </div>
                <div>
                  <span className="mb-1 block text-xs text-slate-500">{t("employees.code")}</span>
                  <span className="font-mono text-sm font-bold text-slate-900">{selectedPayslip.employeeCode}</span>
                </div>
                <div>
                  <span className="mb-1 block text-xs text-slate-500">{t("employees.department")}</span>
                  <span className="text-sm font-medium text-slate-800">{selectedPayslip.department || "-"}</span>
                </div>
                <div>
                  <span className="mb-1 block text-xs text-slate-500">{t("payroll.period")}</span>
                  <span className="whitespace-nowrap font-mono text-[0.7rem] font-medium text-slate-800" dir="ltr">
                    {selectedPayslip.periodStart} → {selectedPayslip.periodEnd}
                  </span>
                </div>
              </div>

              <div className="overflow-hidden rounded-2xl border border-slate-200">
                <table className="w-full text-start text-sm">
                  <thead className="border-b border-slate-200 bg-slate-100 font-bold text-slate-700">
                    <tr>
                      <th className="p-3 text-start">{t("payroll.baseAmount")}</th>
                      <th className="p-3 text-center">{t("payroll.workedHours")}</th>
                      <th className="p-3 text-end">{settings.currency}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 text-slate-800">
                    <tr>
                      <td className="p-3 font-semibold">{t("payroll.baseAmount")}</td>
                      <td className="p-3 text-center font-mono text-xs">
                        {selectedPayslip.workedDays} {t("payroll.workedDays")} ·{" "}
                        {minutesToHours(selectedPayslip.workedMinutes)} {t("common.hours")}
                      </td>
                      <td className="p-3 text-end font-mono font-bold">
                        {money(selectedPayslip.baseSalaryMinor)}
                      </td>
                    </tr>
                    {selectedPayslip.overtimeAmountMinor > 0 && (
                      <tr>
                        <td className="p-3">{t("payroll.overtime")}</td>
                        <td className="p-3 text-center font-mono text-xs">
                          {minutesToHours(selectedPayslip.overtimeMinutes)} {t("common.hours")}
                        </td>
                        <td className="p-3 text-end font-mono font-bold text-emerald-700">
                          +{money(selectedPayslip.overtimeAmountMinor)}
                        </td>
                      </tr>
                    )}
                    {selectedPayslip.bonusesMinor > 0 && (
                      <tr>
                        <td className="p-3">{t("payroll.bonuses")}</td>
                        <td className="p-3 text-center font-mono">-</td>
                        <td className="p-3 text-end font-mono font-bold text-emerald-700">
                          +{money(selectedPayslip.bonusesMinor)}
                        </td>
                      </tr>
                    )}
                    {selectedPayslip.deductionsMinor > 0 && (
                      <tr>
                        <td className="p-3 text-rose-600">
                          {t("payroll.deductions")}
                          {selectedPayslip.unpaidLeaveDays > 0 && (
                            <span className="ms-2 text-[11px] text-slate-500">
                              ({selectedPayslip.unpaidLeaveDays} {t("payroll.unpaidLeaveDays")})
                            </span>
                          )}
                        </td>
                        <td className="p-3 text-center font-mono">-</td>
                        <td className="p-3 text-end font-mono font-bold text-rose-600">
                          -{money(selectedPayslip.deductionsMinor)}
                        </td>
                      </tr>
                    )}
                  </tbody>
                  <tfoot className="bg-slate-900 font-bold text-white">
                    <tr>
                      <td colSpan={2} className="p-4 text-base">
                        {t("payroll.netAmount")}
                      </td>
                      <td className="p-4 text-end font-mono text-xl text-emerald-400">
                        {money(selectedPayslip.netAmountMinor)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-xs text-slate-700">
                <div>
                  <span className="font-bold">{t("payroll.paymentMethod")}: </span>
                  <span>{t(`payroll.paymentMethods.${selectedPayslip.paymentMethod}`)}</span>
                </div>
                <div>
                  <span className="font-bold">{t("payroll.paymentDate")}: </span>
                  <span className="font-mono">
                    {selectedPayslip.paymentDate ? formatDate(selectedPayslip.paymentDate, lang) : "-"}
                  </span>
                </div>
                <div>
                  <span className="font-bold">{t("payroll.signState")}: </span>
                  <span>{selectedPayslip.isSigned ? t("payroll.signed") : t("payroll.unsigned")}</span>
                </div>
              </div>

              <div className="rounded-xl border border-slate-300 bg-slate-50/60 p-4 text-xs leading-relaxed text-slate-700">
                <p className="mb-1 font-semibold text-slate-900">{t("payroll.receiptTitle")}</p>
                <p>{t("payroll.receiptDeclaration")}</p>
              </div>

              <div className="grid grid-cols-2 gap-8 border-t-2 border-slate-300 pt-8">
                <div className="flex h-36 flex-col justify-between rounded-2xl border border-dashed border-slate-400 p-4 text-center">
                  <span className="text-xs font-bold text-slate-700">{t("payroll.employerSignature")}</span>
                  <span className="border-b border-slate-400 pb-1 text-xs text-slate-400">
                    {settings.ownerName}
                  </span>
                </div>
                <div className="flex h-36 flex-col justify-between rounded-2xl border border-dashed border-slate-400 p-4 text-center">
                  <span className="text-xs font-bold text-slate-700">{t("payroll.employeeSignature")}</span>
                  <span className="border-b border-slate-400 pb-1 text-xs text-slate-400">
                    {selectedPayslip.employeeName}
                  </span>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-36 text-center text-slate-400">
              <FileText className="mb-3 h-16 w-16 text-slate-300" aria-hidden />
              <p className="text-base font-bold text-slate-600">{t("payroll.selectPrompt")}</p>
              <p className="mt-1 text-xs text-slate-400">{t("payroll.selectPromptHint")}</p>
            </div>
          )}
        </div>
      </div>

      {form && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(6,5,4,0.74)] p-4 backdrop-blur-sm">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="payslip-form-title"
            className="custom-scrollbar panel max-h-[92vh] w-full max-w-2xl overflow-y-auto p-6"
          >
            <div className="flex items-center justify-between border-b border-[color:var(--line)] pb-4">
              <h3 id="payslip-form-title" className="text-base font-semibold text-[#f4ece0]">
                {form.id ? t("payroll.editPayslip") : t("payroll.generatePayslip")}
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

            <form onSubmit={handleSave} className="mt-5 space-y-4">
              <div>
                <label className="mb-1.5 block text-xs font-medium text-slate-400" htmlFor="payslip-employee">
                  {t("payroll.employeeSelect")} *
                </label>
                <select
                  id="payslip-employee"
                  required
                  value={form.employeeId}
                  onChange={event => setForm({ ...form, employeeId: event.target.value })}
                  className="w-full rounded-xl border border-[color:var(--line)] bg-[rgba(255,246,230,0.045)] px-4 py-2.5 text-sm text-[#f4ece0] focus:border-[rgba(214,171,91,0.6)] focus:outline-none"
                >
                  {employees.map(employee => (
                    <option key={employee.id} value={employee.id}>
                      {employee.fullName} ({employee.employeeCode}) — {t(`employees.salaryTypes.${employee.salaryType}`)}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex flex-wrap items-center gap-1.5 pb-1">
                <span className="text-[11px] text-[#8d8275]">{t("common.quickPresets")}:</span>
                {(["thisMonth", "lastMonth", "thisWeek", "last30Days"] as const).map(preset => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => {
                      const r = getPresetDateRange(preset)
                      setForm({ ...form, periodStart: r.start, periodEnd: r.end })
                      void recalculate(form.employeeId, r.start, r.end)
                    }}
                    className="rounded-lg border border-[color:var(--line)] bg-[rgba(255,246,230,0.04)] px-2 py-0.5 text-[10px] text-[#c8beaf] transition-colors hover:bg-[rgba(214,171,91,0.12)] hover:text-[#e6c98a]"
                  >
                    {t(`common.presets.${preset}`)}
                  </button>
                ))}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-slate-400" htmlFor="payslip-start">
                    {t("attendance.fromDate")}
                  </label>
                  <input
                    id="payslip-start"
                    type="date"
                    value={form.periodStart}
                    onChange={event => setForm({ ...form, periodStart: event.target.value })}
                    className="w-full rounded-xl border border-[color:var(--line)] bg-[rgba(255,246,230,0.045)] px-4 py-2 text-sm text-[#f4ece0] focus:border-[rgba(214,171,91,0.6)] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-slate-400" htmlFor="payslip-end">
                    {t("attendance.toDate")}
                  </label>
                  <input
                    id="payslip-end"
                    type="date"
                    value={form.periodEnd}
                    onChange={event => setForm({ ...form, periodEnd: event.target.value })}
                    className="w-full rounded-xl border border-[color:var(--line)] bg-[rgba(255,246,230,0.045)] px-4 py-2 text-sm text-[#f4ece0] focus:border-[rgba(214,171,91,0.6)] focus:outline-none"
                  />
                </div>
              </div>

              <div className="rounded-xl border border-[color:var(--line)] bg-[rgba(11,10,8,0.5)] p-4">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-xs font-medium text-slate-400">{t("payroll.workedSummary", {
                    days: form.workedDays,
                    hours: minutesToHours(form.workedMinutes)
                  })}</span>
                  <button
                    type="button"
                    onClick={() => void recalculate(form.employeeId, form.periodStart, form.periodEnd)}
                    disabled={loadingSummary}
                    className="flex items-center gap-1.5 rounded-lg border border-[rgba(214,171,91,0.3)] bg-[rgba(214,171,91,0.1)] px-2.5 py-1.5 text-[11px] font-semibold text-[#e6c98a] transition-colors hover:bg-[rgba(214,171,91,0.2)] disabled:opacity-40"
                  >
                    {loadingSummary && <Loader2 className="h-3 w-3 animate-spin" aria-hidden />}
                    {t("common.retry")}
                  </button>
                </div>

                {summary.openRecords > 0 && (
                  <p className="mt-2 flex items-center gap-1.5 text-[11px] text-amber-300">
                    <AlertTriangle className="h-3.5 w-3.5" aria-hidden />
                    {t("payroll.uncountedOpenShifts", { count: summary.openRecords })}
                  </p>
                )}
                {summary.workedDays === 0 && (
                  <p className="mt-2 flex items-center gap-1.5 text-[11px] text-rose-300">
                    <AlertTriangle className="h-3.5 w-3.5" aria-hidden />
                    {t("payroll.noDataWarning")}
                  </p>
                )}
                <p className="mt-2 text-[11px] text-slate-500">
                  {t("payroll.overtimeHint", {
                    hours: settings.defaultDailyHours,
                    multiplier: settings.overtimeMultiplier
                  })}
                </p>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-slate-400" htmlFor="payslip-days">
                    {t("payroll.workedDays")}
                  </label>
                  <input
                    id="payslip-days"
                    type="number"
                    min={0}
                    max={366}
                    value={form.workedDays}
                    onChange={event => setForm({ ...form, workedDays: Number(event.target.value) || 0 })}
                    dir="ltr"
                    className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 font-mono text-sm text-slate-100 focus:border-blue-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-slate-400" htmlFor="payslip-hours">
                    {t("payroll.workedHours")}
                  </label>
                  <input
                    id="payslip-hours"
                    type="number"
                    min={0}
                    step={0.25}
                    value={minutesToHours(form.workedMinutes)}
                    onChange={event =>
                      setForm({ ...form, workedMinutes: Math.round((Number(event.target.value) || 0) * 60) })
                    }
                    dir="ltr"
                    className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 font-mono text-sm text-slate-100 focus:border-blue-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-slate-400" htmlFor="payslip-overtime">
                    {t("payroll.overtimeHours")}
                  </label>
                  <input
                    id="payslip-overtime"
                    type="number"
                    min={0}
                    step={0.25}
                    value={minutesToHours(form.overtimeMinutes)}
                    onChange={event =>
                      setForm({ ...form, overtimeMinutes: Math.round((Number(event.target.value) || 0) * 60) })
                    }
                    dir="ltr"
                    className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 font-mono text-sm text-slate-100 focus:border-blue-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-slate-400" htmlFor="payslip-base">
                    {t("payroll.baseAmount")} ({settings.currency})
                  </label>
                  <input
                    id="payslip-base"
                    type="number"
                    min={0}
                    step={Math.pow(10, -decimals)}
                    value={form.baseSalary}
                    onChange={event => setForm({ ...form, baseSalary: event.target.value })}
                    dir="ltr"
                    className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 font-mono text-sm font-bold text-emerald-400 focus:border-blue-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-slate-400" htmlFor="payslip-overtime-amount">
                    {t("payroll.overtime")} ({settings.currency})
                  </label>
                  <input
                    id="payslip-overtime-amount"
                    type="number"
                    min={0}
                    step={Math.pow(10, -decimals)}
                    value={form.overtimeAmount}
                    onChange={event => setForm({ ...form, overtimeAmount: event.target.value })}
                    dir="ltr"
                    className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 font-mono text-sm text-slate-100 focus:border-blue-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-slate-400" htmlFor="payslip-bonuses">
                    {t("payroll.bonusesHint")} ({settings.currency})
                  </label>
                  <input
                    id="payslip-bonuses"
                    type="number"
                    min={0}
                    step={Math.pow(10, -decimals)}
                    value={form.bonuses}
                    onChange={event => setForm({ ...form, bonuses: event.target.value })}
                    dir="ltr"
                    className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 font-mono text-sm text-slate-100 focus:border-blue-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-slate-400" htmlFor="payslip-deductions">
                    {t("payroll.deductionsHint")} ({settings.currency})
                  </label>
                  <input
                    id="payslip-deductions"
                    type="number"
                    min={0}
                    step={Math.pow(10, -decimals)}
                    value={form.deductions}
                    onChange={event => setForm({ ...form, deductions: event.target.value })}
                    dir="ltr"
                    className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 font-mono text-sm text-rose-400 focus:border-blue-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-slate-400" htmlFor="payslip-method">
                    {t("payroll.paymentMethod")}
                  </label>
                  <select
                    id="payslip-method"
                    value={form.paymentMethod}
                    onChange={event => setForm({ ...form, paymentMethod: event.target.value as PaymentMethod })}
                    className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 focus:border-blue-500 focus:outline-none"
                  >
                    {PAYMENT_METHODS.map(method => (
                      <option key={method} value={method}>
                        {t(`payroll.paymentMethods.${method}`)}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-slate-400" htmlFor="payslip-date">
                    {t("payroll.paymentDate")}
                  </label>
                  <input
                    id="payslip-date"
                    type="date"
                    value={form.paymentDate}
                    onChange={event => setForm({ ...form, paymentDate: event.target.value })}
                    className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 focus:border-blue-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-medium text-slate-400" htmlFor="payslip-notes">
                  {t("common.notes")} ({t("common.optional")})
                </label>
                <textarea
                  id="payslip-notes"
                  rows={2}
                  maxLength={500}
                  value={form.notes}
                  onChange={event => setForm({ ...form, notes: event.target.value })}
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 focus:border-blue-500 focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-between rounded-2xl border border-slate-800 bg-slate-950 p-4">
                <span className="text-sm font-bold text-slate-300">{t("payroll.netAmount")}</span>
                <span className="font-mono text-xl font-bold text-emerald-400">{money(formNet)}</span>
              </div>

              <div className="flex gap-3 border-t border-slate-800 pt-4">
                <button
                  type="button"
                  onClick={() => setForm(null)}
                  className="btn btn-ghost flex-1"
                >
                  {t("common.cancel")}
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="btn btn-primary flex-1"
                >
                  {saving ? t("common.loading") : t("common.save")}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ConfirmDialog
        isOpen={Boolean(deleting)}
        title={t("payroll.deletePayslip")}
        message={`${deleting?.number ?? ""} — ${deleting?.employeeName ?? ""}. ${t("payroll.confirmDeletePayslip")}`}
        confirmLabel={t("common.delete")}
        cancelLabel={t("common.cancel")}
        onConfirm={() => void handleDelete()}
        onCancel={() => setDeleting(null)}
      />

      <PayslipPreviewModal
        payslip={previewPayslip}
        settings={settings}
        isOpen={previewPayslip !== null}
        onClose={() => setPreviewPayslip(null)}
        onPrint={() => void handlePrint()}
        onSavePdf={() => void handleSavePdf()}
        onSendWhatsApp={slip => handleSendWhatsAppForSlip(slip)}
      />

      {selectedPayslip && (
        <p className="no-print text-center text-[11px] text-slate-600">
          {t("payroll.number")} {selectedPayslip.number} · {formatDateTime(Date.parse(selectedPayslip.createdAt), lang)}
        </p>
      )}
    </div>
  )
}
