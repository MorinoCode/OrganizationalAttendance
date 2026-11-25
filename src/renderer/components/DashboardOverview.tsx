import React, { useCallback, useEffect, useMemo, useState } from "react"
import { useTranslation } from "react-i18next"
import {
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  BarChart3,
  Calendar,
  CheckCircle2,
  Clock,
  ExternalLink,
  MessageCircle,
  TrendingUp,
  UserCheck,
  UserX,
  Users
} from "lucide-react"

import { api } from "../services/api"
import { errorKey, isApiError } from "../services/errors"
import { addDays, formatDate, minutesToHours, monthStartKey, todayKey } from "../services/date"
import { formatMoney } from "../services/money"
import { AttendanceRecord, CompanySettings, Employee, Language, Payslip } from "../types"
import { cleanPhoneNumber } from "../utils/whatsapp"

interface DashboardOverviewProps {
  settings: CompanySettings
  onNavigateTab: (tab: "employees" | "attendance" | "leaves" | "payroll" | "monthClose" | "settings") => void
  onSessionEnded: (message: string) => void
}

export const DashboardOverview: React.FC<DashboardOverviewProps> = ({
  settings,
  onNavigateTab,
  onSessionEnded
}) => {
  const { t, i18n } = useTranslation()
  const lang = (i18n.language || "ar") as Language

  const [employees, setEmployees] = useState<Employee[]>([])
  const [todayRecords, setTodayRecords] = useState<AttendanceRecord[]>([])
  const [monthRecords, setMonthRecords] = useState<AttendanceRecord[]>([])
  const [pastOpenRecords, setPastOpenRecords] = useState<AttendanceRecord[]>([])
  const [payslips, setPayslips] = useState<Payslip[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadData = useCallback(async () => {
    setLoading(true)
    setError(null)
    const today = todayKey()
    const mStart = monthStartKey(today)
    try {
      const [empList, todayList, mList, pastList, slipList] = await Promise.all([
        api.employees.list(true),
        api.attendance.today(),
        api.attendance.list({ fromDate: mStart, toDate: today }),
        api.attendance.list({ fromDate: addDays(today, -30), toDate: addDays(today, -1) }),
        api.payslips.list({})
      ])
      setEmployees(empList)
      setTodayRecords(todayList)
      setMonthRecords(mList)
      setPastOpenRecords(pastList.filter(record => record.punchOutAt === null))
      setPayslips(slipList)
    } catch (caught) {
      if (isApiError(caught) && caught.code === "unauthorized") {
        onSessionEnded(t("admin.sessionExpired"))
        return
      }
      setError(t(errorKey(caught)))
    } finally {
      setLoading(false)
    }
  }, [onSessionEnded, t])

  useEffect(() => {
    void loadData()
  }, [loadData])

  const activeEmployees = useMemo(
    () => employees.filter(employee => employee.isActive),
    [employees]
  )

  const missingToday = useMemo(() => {
    const presentIds = new Set(todayRecords.map(record => record.employeeId))
    return activeEmployees.filter(employee => !presentIds.has(employee.id))
  }, [activeEmployees, todayRecords])

  const employeeMonthHours = useMemo(() => {
    const map = new Map<string, number>()
    for (const record of monthRecords) {
      if (record.punchOutAt !== null) {
        const current = map.get(record.employeeId) || 0
        map.set(record.employeeId, current + record.netMinutes)
      }
    }
    const list = activeEmployees.map(employee => {
      const minutes = map.get(employee.id) || 0
      return {
        id: employee.id,
        name: employee.fullName,
        code: employee.employeeCode,
        department: employee.department,
        hours: minutesToHours(minutes),
        minutes
      }
    })
    list.sort((a, b) => b.minutes - a.minutes)
    const max = Math.max(...list.map(item => item.minutes), 1)
    return { list, max }
  }, [activeEmployees, monthRecords])

  const monthlyPayrollTrends = useMemo(() => {
    const monthsMap = new Map<string, number>()
    const now = new Date()
    const last6Keys: string[] = []

    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
      last6Keys.push(key)
      monthsMap.set(key, 0)
    }

    for (const slip of payslips) {
      const key = slip.periodStart ? slip.periodStart.slice(0, 7) : ""
      if (monthsMap.has(key)) {
        const current = monthsMap.get(key) || 0
        monthsMap.set(key, current + slip.netAmountMinor)
      }
    }

    const items = last6Keys.map(key => {
      const [year, month] = key.split("-").map(Number)
      const date = new Date(year, month - 1, 1)
      const label = date.toLocaleDateString(lang === "fa" ? "fa-IR" : lang === "ar" ? "ar-KW" : "en-US", {
        month: "short"
      })
      const totalMinor = monthsMap.get(key) || 0
      return {
        key,
        label,
        year,
        totalMinor,
        formatted: formatMoney(totalMinor, settings.currency, settings.currencyDecimals, lang)
      }
    })

    const maxMinor = Math.max(...items.map(item => item.totalMinor), 1)
    return { items, maxMinor }
  }, [payslips, settings.currencyDecimals, lang])

  const sendWhatsAppPrompt = (employee: Employee) => {
    if (!employee.phone) return
    const phone = cleanPhoneNumber(employee.phone)
    const text = encodeURIComponent(
      lang === "ar"
        ? `السلام عليكم ${employee.fullName}، نود الاستفسار عن سبب عدم تسجيل دوام اليوم في شركة ${settings.companyName}.`
        : lang === "fa"
        ? `سلام ${employee.fullName} عزیز، لطفاً وضعیت حضور امروز خود را در شرکت ${settings.companyName} مشخص فرمایید.`
        : `Hello ${employee.fullName}, please update your attendance status today for ${settings.companyName}.`
    )
    window.open(`https://wa.me/${phone}?text=${text}`, "_blank")
  }

  return (
    <div className="space-y-6">
      {error && (
        <div className="panel flex items-center gap-3 border-[rgba(200,95,78,0.4)] bg-[rgba(200,95,78,0.1)] p-4 text-xs text-[#e9a094]">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="panel space-y-4 p-5">
          <div className="flex items-center justify-between border-b border-[color:var(--line)] pb-3">
            <div className="flex items-center gap-2.5">
              <span className="grid h-8 w-8 place-items-center rounded-lg border border-[rgba(235,160,80,0.35)] bg-[rgba(235,160,80,0.12)] text-[#e6b276]">
                <UserX className="h-4 w-4" />
              </span>
              <div>
                <h3 className="text-sm font-semibold text-[#f4ece0]">
                  {t("dashboard.alerts.notClockedInToday")}
                </h3>
                <p className="text-[0.68rem] text-[#8d8275]">
                  {missingToday.length} {t("employees.employee")}
                </p>
              </div>
            </div>
            {missingToday.length > 0 && (
              <span className="rounded-md border border-[rgba(235,160,80,0.3)] bg-[rgba(235,160,80,0.1)] px-2 py-0.5 font-mono text-[0.68rem] font-semibold text-[#e6b276]">
                {missingToday.length}
              </span>
            )}
          </div>

          {missingToday.length === 0 ? (
            <div className="flex items-center gap-2.5 py-6 text-center text-xs text-[#78dcbc]">
              <CheckCircle2 className="h-4 w-4" />
              <span>{t("dashboard.alerts.allGood")}</span>
            </div>
          ) : (
            <div className="custom-scrollbar max-h-56 space-y-2 overflow-y-auto pe-1">
              {missingToday.map(emp => (
                <div
                  key={emp.id}
                  className="flex items-center justify-between rounded-xl border border-[color:var(--line)] bg-[rgba(255,246,230,0.03)] px-3 py-2.5 text-xs transition-colors hover:bg-[rgba(255,246,230,0.06)]"
                >
                  <div className="flex items-center gap-2.5">
                    <span className="grid h-7 w-7 place-items-center rounded-lg bg-[rgba(255,246,230,0.06)] font-semibold text-[#d6ab5b]">
                      {emp.fullName.slice(0, 1)}
                    </span>
                    <div>
                      <p className="font-semibold text-[#f4ece0]">{emp.fullName}</p>
                      <p className="font-mono text-[0.68rem] text-[#8d8275]">
                        {emp.employeeCode} · {emp.department || "-"}
                      </p>
                    </div>
                  </div>
                  {emp.phone && (
                    <button
                      type="button"
                      onClick={() => sendWhatsAppPrompt(emp)}
                      title={t("payroll.sendWhatsApp")}
                      className="grid h-7 w-7 place-items-center rounded-md border border-[rgba(70,195,159,0.35)] bg-[rgba(43,166,136,0.12)] text-[#78dcbc] transition-colors hover:bg-[rgba(43,166,136,0.25)]"
                    >
                      <MessageCircle className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="panel space-y-4 p-5">
          <div className="flex items-center justify-between border-b border-[color:var(--line)] pb-3">
            <div className="flex items-center gap-2.5">
              <span className="grid h-8 w-8 place-items-center rounded-lg border border-[rgba(200,95,78,0.35)] bg-[rgba(200,95,78,0.12)] text-[#e9a094]">
                <Clock className="h-4 w-4" />
              </span>
              <div>
                <h3 className="text-sm font-semibold text-[#f4ece0]">
                  {t("dashboard.alerts.unclosedPastShifts")}
                </h3>
                <p className="text-[0.68rem] text-[#8d8275]">
                  {pastOpenRecords.length} {t("admin.attendance")}
                </p>
              </div>
            </div>
            {pastOpenRecords.length > 0 && (
              <span className="rounded-md border border-[rgba(200,95,78,0.3)] bg-[rgba(200,95,78,0.1)] px-2 py-0.5 font-mono text-[0.68rem] font-semibold text-[#e9a094]">
                {pastOpenRecords.length}
              </span>
            )}
          </div>

          {pastOpenRecords.length === 0 ? (
            <div className="flex items-center gap-2.5 py-6 text-center text-xs text-[#78dcbc]">
              <CheckCircle2 className="h-4 w-4" />
              <span>{t("dashboard.alerts.allShiftsClosed")}</span>
            </div>
          ) : (
            <div className="custom-scrollbar max-h-56 space-y-2 overflow-y-auto pe-1">
              {pastOpenRecords.map(record => (
                <div
                  key={record.id}
                  className="flex items-center justify-between rounded-xl border border-[color:var(--line)] bg-[rgba(255,246,230,0.03)] px-3 py-2.5 text-xs transition-colors hover:bg-[rgba(255,246,230,0.06)]"
                >
                  <div>
                    <p className="font-semibold text-[#f4ece0]">{record.employeeName}</p>
                    <p className="font-mono text-[0.68rem] text-[#e9a094]">
                      {record.recordDate} · {t("kiosk.status.working")}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => onNavigateTab("attendance")}
                    className="flex items-center gap-1.5 rounded-lg border border-[rgba(214,171,91,0.3)] bg-[rgba(214,171,91,0.1)] px-2.5 py-1 text-[0.68rem] font-semibold text-[#e6c98a] transition-colors hover:bg-[rgba(214,171,91,0.2)]"
                  >
                    <span>{t("dashboard.alerts.correctShift")}</span>
                    <ArrowRight className="h-3 w-3 rtl:rotate-180" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <div className="panel space-y-4 p-5 lg:col-span-6">
          <div className="flex items-center justify-between border-b border-[color:var(--line)] pb-3">
            <div className="flex items-center gap-2.5">
              <span className="grid h-8 w-8 place-items-center rounded-lg border border-[rgba(214,171,91,0.35)] bg-[rgba(214,171,91,0.12)] text-[#e6c98a]">
                <BarChart3 className="h-4 w-4" />
              </span>
              <div>
                <h3 className="text-sm font-semibold text-[#f4ece0]">
                  {t("dashboard.analytics.hoursThisMonth")}
                </h3>
                <p className="text-[0.68rem] text-[#8d8275]">
                  {formatDate(monthStartKey(), lang)} → {formatDate(todayKey(), lang)}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => onNavigateTab("attendance")}
              className="text-[0.68rem] text-[#d6ab5b] hover:underline"
            >
              {t("common.viewAll")}
            </button>
          </div>

          {employeeMonthHours.list.length === 0 ? (
            <p className="py-12 text-center text-xs text-[#8d8275]">
              {t("dashboard.analytics.noData")}
            </p>
          ) : (
            <div className="space-y-3 pt-1">
              {employeeMonthHours.list.slice(0, 7).map(item => {
                const percent = Math.min(100, Math.round((item.minutes / employeeMonthHours.max) * 100))
                return (
                  <div key={item.id} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-medium text-[#f4ece0]">
                        {item.name}{" "}
                        <span className="font-mono text-[0.68rem] text-[#8d8275]">({item.code})</span>
                      </span>
                      <span className="font-mono font-semibold text-[#e6c98a]">
                        {item.hours} {t("common.hours")}
                      </span>
                    </div>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-[rgba(255,246,230,0.06)]">
                      <div
                        className="h-full rounded-full bg-[linear-gradient(90deg,rgba(214,171,91,0.6),#d6ab5b)] transition-all duration-500"
                        style={{ width: `${percent}%` }}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        <div className="panel space-y-4 p-5 lg:col-span-6">
          <div className="flex items-center justify-between border-b border-[color:var(--line)] pb-3">
            <div className="flex items-center gap-2.5">
              <span className="grid h-8 w-8 place-items-center rounded-lg border border-[rgba(120,220,188,0.35)] bg-[rgba(43,166,136,0.12)] text-[#78dcbc]">
                <TrendingUp className="h-4 w-4" />
              </span>
              <div>
                <h3 className="text-sm font-semibold text-[#f4ece0]">
                  {t("dashboard.analytics.payrollCostTrend")}
                </h3>
                <p className="text-[0.68rem] text-[#8d8275]">
                  {settings.currency} · {t("payroll.archive")}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => onNavigateTab("payroll")}
              className="text-[0.68rem] text-[#78dcbc] hover:underline"
            >
              {t("common.viewAll")}
            </button>
          </div>

          <div className="flex h-56 items-end justify-between gap-3 pt-6">
            {monthlyPayrollTrends.items.map(m => {
              const heightPercent = m.totalMinor > 0
                ? Math.max(15, Math.round((m.totalMinor / monthlyPayrollTrends.maxMinor) * 100))
                : 6
              return (
                <div key={m.key} className="flex flex-1 flex-col items-center justify-end gap-2 group">
                  <span className="font-mono text-[0.62rem] font-semibold text-[#78dcbc] opacity-0 transition-opacity group-hover:opacity-100">
                    {m.formatted}
                  </span>
                  <div className="w-full max-w-[42px] overflow-hidden rounded-t-lg bg-[rgba(255,246,230,0.06)] h-36 flex items-end">
                    <div
                      className="w-full rounded-t-lg bg-[linear-gradient(180deg,#78dcbc,#2ba688)] transition-all duration-500 group-hover:brightness-110"
                      style={{ height: `${heightPercent}%` }}
                    />
                  </div>
                  <span className="text-[0.68rem] font-semibold text-[#8d8275]">
                    {m.label}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
