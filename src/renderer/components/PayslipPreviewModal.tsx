import React, { useEffect } from "react"
import { useTranslation } from "react-i18next"
import { CheckCircle2, Download, MessageCircle, Printer, ShieldCheck, X } from "lucide-react"
import { formatDate, formatDateTime, minutesToHours } from "../services/date"
import { formatMoney } from "../services/money"
import { CompanySettings, Employee, Language, Payslip } from "../types"

interface PayslipPreviewModalProps {
  payslip: Payslip | null
  employee?: Employee | null
  settings: CompanySettings
  isOpen: boolean
  onClose: () => void
  onSendWhatsApp?: (payslip: Payslip) => void
  onPrint?: () => void
  onSavePdf?: () => void
}

export const PayslipPreviewModal: React.FC<PayslipPreviewModalProps> = ({
  payslip,
  employee,
  settings,
  isOpen,
  onClose,
  onSendWhatsApp,
  onPrint,
  onSavePdf
}) => {
  const { t, i18n } = useTranslation()
  const lang = (i18n.language || "ar") as Language

  useEffect(() => {
    if (!isOpen) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose()
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [isOpen, onClose])

  if (!isOpen || !payslip) return null

  const money = (minor: number) => formatMoney(minor, settings.currency, settings.currencyDecimals, lang)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(6,5,4,0.85)] p-4 backdrop-blur-md">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="payslip-preview-title"
        data-testid="payslip-preview"
        data-payslip-id={payslip.id}
        data-payslip-number={payslip.number}
        data-period-start={payslip.periodStart}
        data-period-end={payslip.periodEnd}
        data-base-minor={payslip.baseSalaryMinor}
        data-net-minor={payslip.netAmountMinor}
        data-overtime-minutes={payslip.overtimeMinutes}
        data-overtime-minor={payslip.overtimeAmountMinor}
        className="custom-scrollbar panel flex max-h-[96vh] w-full max-w-4xl flex-col overflow-hidden border border-[rgba(214,171,91,0.35)] shadow-2xl"
      >
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[color:var(--line)] bg-[rgba(20,17,13,0.95)] px-6 py-4">
          <div>
            <h3 id="payslip-preview-title" className="text-sm font-semibold text-[#f4ece0]">
              {t("payroll.preview.title")}
            </h3>
            <p className="text-[0.7rem] text-[#8d8275]">
              {settings.companyName} · {t("payroll.number")}: {payslip.number}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {onPrint && (
              <button
                type="button"
                onClick={onPrint}
                className="btn btn-primary"
                title={t("payroll.printReceipt")}
              >
                <Printer className="h-4 w-4" aria-hidden />
                <span>{t("payroll.printReceipt")}</span>
              </button>
            )}
            {onSavePdf && (
              <button
                type="button"
                onClick={onSavePdf}
                className="btn btn-ghost"
                title={t("payroll.exportPdf")}
              >
                <Download className="h-4 w-4 text-blue-400" aria-hidden />
                <span>{t("payroll.exportPdf")}</span>
              </button>
            )}
            {onSendWhatsApp && (
              <button
                type="button"
                onClick={() => onSendWhatsApp(payslip)}
                className="btn border border-[rgba(70,195,159,0.35)] bg-[rgba(43,166,136,0.18)] text-[#78dcbc] hover:bg-[rgba(43,166,136,0.28)]"
                title={t("payroll.sendWhatsApp")}
              >
                <MessageCircle className="h-4 w-4 text-emerald-400" aria-hidden />
                <span>{t("payroll.sendWhatsApp")}</span>
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="rounded-md p-1.5 text-[#7b7063] transition-colors hover:bg-[rgba(255,246,230,0.08)] hover:text-[#f4ece0]"
              aria-label={t("common.close")}
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="custom-scrollbar flex-1 overflow-y-auto bg-[rgba(10,9,7,0.92)] p-6">
          <div className="relative mx-auto w-full max-w-2xl rounded-sm border border-slate-300 bg-white p-8 text-slate-900 shadow-2xl">
            <div className="flex flex-wrap items-center justify-between gap-4 border-b-2 border-slate-900 pb-5">
              <div>
                <h1 className="text-2xl font-black tracking-tight text-slate-900">{settings.companyName}</h1>
                <p className="mt-1 text-xs font-semibold text-slate-600">
                  {settings.ownerName} — {settings.ownerRole}
                </p>
                <p className="text-[0.7rem] text-slate-500">
                  {t("payroll.currency")}: {settings.currency}
                </p>
              </div>
              <div className="text-end">
                <span className="mb-1 inline-block rounded-md bg-slate-900 px-3 py-1 text-xs font-bold uppercase tracking-wider text-white">
                  {t("payroll.receiptTitle")}
                </span>
                <p className="font-mono text-xs font-bold text-slate-700">
                  {t("payroll.number")}: {payslip.number}
                </p>
                <p className="text-[0.68rem] text-slate-500">
                  {formatDateTime(Date.parse(payslip.createdAt), lang)}
                </p>
              </div>
            </div>

            <div className="mt-5 grid grid-cols-2 gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3.5 text-xs md:grid-cols-4">
              <div>
                <span className="mb-0.5 block text-[0.68rem] text-slate-500">{t("employees.name")}</span>
                <span className="font-bold text-slate-900">{payslip.employeeName}</span>
              </div>
              <div>
                <span className="mb-0.5 block text-[0.68rem] text-slate-500">{t("employees.code")}</span>
                <span className="font-mono font-bold text-slate-900">{payslip.employeeCode}</span>
              </div>
              <div>
                <span className="mb-0.5 block text-[0.68rem] text-slate-500">{t("employees.department")}</span>
                <span className="font-medium text-slate-800">{payslip.department || "-"}</span>
              </div>
              <div>
                <span className="mb-0.5 block text-[0.68rem] text-slate-500">{t("payroll.period")}</span>
                <span className="whitespace-nowrap font-mono text-[0.68rem] font-medium text-slate-800" dir="ltr">
                  {payslip.periodStart} → {payslip.periodEnd}
                </span>
              </div>
            </div>

            <div className="mt-5 overflow-hidden rounded-xl border border-slate-200">
              <table className="w-full text-start text-xs">
                <thead className="border-b border-slate-200 bg-slate-100 font-bold text-slate-700">
                  <tr>
                    <th className="p-2.5 text-start">{t("payroll.baseAmount")}</th>
                    <th className="p-2.5 text-center">{t("payroll.workedHours")}</th>
                    <th className="p-2.5 text-end">{settings.currency}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 text-slate-800">
                  <tr>
                    <td className="p-2.5 font-semibold">{t("payroll.baseAmount")}</td>
                    <td className="p-2.5 text-center font-mono text-[0.7rem]">
                      {payslip.workedDays} {t("payroll.workedDays")} · {minutesToHours(payslip.workedMinutes)} {t("common.hours")}
                    </td>
                    <td className="p-2.5 text-end font-mono font-bold text-slate-900">
                      {money(payslip.baseSalaryMinor)}
                    </td>
                  </tr>
                  {payslip.overtimeAmountMinor > 0 && (
                    <tr>
                      <td className="p-2.5">{t("payroll.overtime")}</td>
                      <td className="p-2.5 text-center font-mono text-[0.7rem]">
                        {minutesToHours(payslip.overtimeMinutes)} {t("common.hours")}
                      </td>
                      <td className="p-2.5 text-end font-mono font-bold text-emerald-700">
                        +{money(payslip.overtimeAmountMinor)}
                      </td>
                    </tr>
                  )}
                  {payslip.bonusesMinor > 0 && (
                    <tr>
                      <td className="p-2.5">{t("payroll.bonuses")}</td>
                      <td className="p-2.5 text-center font-mono">-</td>
                      <td className="p-2.5 text-end font-mono font-bold text-emerald-700">
                        +{money(payslip.bonusesMinor)}
                      </td>
                    </tr>
                  )}
                  {payslip.deductionsMinor > 0 && (
                    <tr>
                      <td className="p-2.5 text-rose-600">
                        {t("payroll.deductions")}
                        {payslip.unpaidLeaveDays > 0 && (
                          <span className="ms-1.5 text-[0.68rem] text-slate-500">
                            ({payslip.unpaidLeaveDays} {t("payroll.unpaidLeaveDays")})
                          </span>
                        )}
                      </td>
                      <td className="p-2.5 text-center font-mono">-</td>
                      <td className="p-2.5 text-end font-mono font-bold text-rose-600">
                        -{money(payslip.deductionsMinor)}
                      </td>
                    </tr>
                  )}
                </tbody>
                <tfoot className="border-t-2 border-slate-900 bg-slate-900 font-bold text-white">
                  <tr>
                    <td colSpan={2} className="p-3 text-sm">
                      {t("payroll.netAmount")}
                    </td>
                    <td className="p-3 text-end font-mono text-lg text-emerald-400">
                      {money(payslip.netAmountMinor)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>

            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-700">
              <div>
                <span className="font-bold">{t("payroll.paymentMethod")}: </span>
                <span>{t(`payroll.paymentMethods.${payslip.paymentMethod}`)}</span>
              </div>
              <div>
                <span className="font-bold">{t("payroll.paymentDate")}: </span>
                <span className="font-mono">
                  {payslip.paymentDate ? formatDate(payslip.paymentDate, lang) : "-"}
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="font-bold">{t("payroll.signState")}: </span>
                <span className="inline-flex items-center gap-1">
                  {payslip.isSigned ? (
                    <>
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                      <span className="font-semibold text-emerald-700">{t("payroll.signed")}</span>
                    </>
                  ) : (
                    <span className="text-slate-500">{t("payroll.unsigned")}</span>
                  )}
                </span>
              </div>
            </div>

            <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50/70 p-3 text-[0.68rem] leading-relaxed text-slate-600">
              <p className="mb-0.5 font-bold text-slate-800">{t("payroll.receiptTitle")}</p>
              <p>{t("payroll.receiptDeclaration")}</p>
            </div>

            <div className="relative mt-6 grid grid-cols-2 gap-6 border-t-2 border-slate-300 pt-6">
              <div className="relative flex h-32 flex-col justify-between rounded-xl border border-dashed border-slate-400 p-3 text-center">
                <span className="text-[0.72rem] font-bold text-slate-700">{t("payroll.employerSignature")}</span>
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className="flex h-24 w-24 -rotate-12 flex-col items-center justify-center rounded-full border-2 border-double border-blue-700/80 p-1 text-center text-blue-800/90 shadow-sm">
                    <ShieldCheck className="h-4 w-4 text-blue-700" />
                    <span className="text-[0.55rem] font-black uppercase tracking-widest">{settings.companyName}</span>
                    <span className="text-[0.5rem] font-bold">{t("payroll.preview.officialStamp")}</span>
                  </div>
                </div>
                <span className="border-b border-slate-400 pb-1 text-[0.68rem] text-slate-600">
                  {settings.ownerName}
                </span>
              </div>
              <div className="flex h-32 flex-col justify-between rounded-xl border border-dashed border-slate-400 p-3 text-center">
                <span className="text-[0.72rem] font-bold text-slate-700">{t("payroll.employeeSignature")}</span>
                <span className="border-b border-slate-400 pb-1 text-[0.68rem] text-slate-600">
                  {payslip.employeeName}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
