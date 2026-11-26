import React, { useCallback, useEffect, useMemo, useState } from "react"
import { useTranslation } from "react-i18next"
import {
  AlertCircle,
  ArrowRight,
  BarChart3,
  Building2,
  CheckCircle2,
  Clock,
  Coffee,
  Gauge,
  MessageCircle,
  Timer,
  TrendingUp,
  Users,
  UserX
} from "lucide-react"

import { api } from "../services/api"
import { errorKey, isApiError } from "../services/errors"
import { addDays, formatDate, formatDuration, minutesToHours, monthStartKey, todayKey } from "../services/date"
import { formatMoney } from "../services/money"
import { AttendanceRecord, CompanySettings, DashboardInsights, Employee, Language } from "../types"
import { cleanPhoneNumber } from "../utils/whatsapp"

interface DashboardOverviewProps {
  settings: CompanySettings
  onNavigateTab: (tab: "employees" | "attendance" | "payroll" | "settings") => void
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
  const [pastOpenRecords, setPastOpenRecords] = useState<AttendanceRecord[]>([])
  const [insights, setInsights] = useState<DashboardInsights | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadData = useCallback(async () => {
    setLoading(true)
    setError(null)
    const today = todayKey()
    try {
      const [empList, todayList, pastList, insightData] = await Promise.all([
        api.employees.list(true),
        api.attendance.today(),
        api.attendance.list({ fromDate: addDays(today, -30), toDate: addDays(today, -1) }),
        api.reports.dashboardInsights(6)
      ])
      setEmployees(empList)
      setTodayRecords(todayList)
      setPastOpenRecords(pastList.filter(record => record.punchOutAt === null))
      setInsights(insightData)
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
    const list = (insights?.hoursByEmployee ?? []).map(item => ({
      ...item,
      hours: minutesToHours(item.minutes)
    }))
    const max = Math.max(...list.map(item => item.minutes), 1)
    return { list, max }
  }, [insights])

  const monthLabel = useCallback(
    (monthKey: string) => {
      const [year, month] = monthKey.split("-").map(Number)
      return new Date(year, month - 1, 1).toLocaleDateString(lang === "fa" ? "fa-IR" : lang === "ar" ? "ar-KW" : "en-US", {
        month: "short"
      })
    },
    [lang]
  )

  const monthlyPayrollTrends = useMemo(() => {
    const items = (insights?.payrollTrend ?? []).map(point => ({
      key: point.monthKey,
      label: monthLabel(point.monthKey),
      totalMinor: point.netAmountMinor,
      formatted: formatMoney(point.netAmountMinor, settings.currency, settings.currencyDecimals, lang)
    }))
    const maxMinor = Math.max(...items.map(item => item.totalMinor), 1)
    return { items, maxMinor }
  }, [insights, monthLabel, settings.currency, settings.currencyDecimals, lang])

  const overtimeTrend = useMemo(() => {
    const items = (insights?.overtimeTrend ?? []).map(point => ({
      key: point.monthKey,
      label: monthLabel(point.monthKey),
      minutes: point.overtimeMinutes,
      hours: minutesToHours(point.overtimeMinutes),
      amountMinor: point.overtimeAmountMinor,
      amount: formatMoney(point.overtimeAmountMinor, settings.currency, settings.currencyDecimals, lang)
    }))
    const maxMinutes = Math.max(...items.map(item => item.minutes), 1)
    const totalMinutes = items.reduce((sum, item) => sum + item.minutes, 0)
    const totalAmountMinor = items.reduce((sum, item) => sum + item.amountMinor, 0)
    return {
      items,
      maxMinutes,
      totalMinutes,
      totalHours: minutesToHours(totalMinutes),
      totalAmountMinor,
      totalFormatted: formatMoney(totalAmountMinor, settings.currency, settings.currencyDecimals, lang)
    }
  }, [insights, monthLabel, settings.currency, settings.currencyDecimals, lang])

  const departmentCosts = useMemo(() => {
    const rows = (insights?.departmentCosts ?? []).map(row => ({
      ...row,
      formatted: formatMoney(row.netAmountMinor, settings.currency, settings.currencyDecimals, lang),
      overtimeHours: minutesToHours(row.overtimeMinutes)
    }))
    const maxMinor = Math.max(...rows.map(row => row.netAmountMinor), 1)
    const totalMinor = insights?.departmentCostsTotal.netAmountMinor ?? 0
    return {
      rows,
      maxMinor,
      totalMinor,
      totalFormatted: formatMoney(totalMinor, settings.currency, settings.currencyDecimals, lang)
    }
  }, [insights, settings.currency, settings.currencyDecimals, lang])

  const absence = insights?.absence ?? null
  const absencePercent = absence ? Math.round(absence.rate * 1000) / 10 : 0
  const hasPayrollData = (insights?.departmentCosts.length ?? 0) > 0

  const statCells = useMemo(() => {
    const totalEmployees = employees.filter(employee => employee.isActive).length
    const working = todayRecords.filter(record => record.status === "present").length
    const onBreak = todayRecords.filter(record => record.status === "on_break").length
    const completed = todayRecords.filter(record => record.status === "completed").length
    const totalMinutes = todayRecords.reduce((total, record) => total + record.netMinutes, 0)
    const formattedHours = formatDuration(totalMinutes, t("common.hours"), t("common.minutes"))

    return [
      {
        label: t("stats.totalEmployees"),
        value: totalEmployees,
        tone: "text-[#f4ece0]",
        icon: <Users className="h-3.5 w-3.5" aria-hidden />,
        accent: "text-[#c0b4a3]"
      },
      {
        label: t("stats.activeToday"),
        value: working,
        tone: "text-[#78dcbc]",
        icon: <Clock className="h-3.5 w-3.5" aria-hidden />,
        accent: "text-[#46c39f]"
      },
      {
        label: t("stats.onBreakNow"),
        value: onBreak,
        tone: "text-[#e6b276]",
        icon: <Coffee className="h-3.5 w-3.5" aria-hidden />,
        accent: "text-[#d8954e]"
      },
      {
        label: t("stats.completedToday"),
        value: completed,
        tone: "text-[#e6c98a]",
        icon: <CheckCircle2 className="h-3.5 w-3.5" aria-hidden />,
        accent: "text-[#d6ab5b]"
      },
      {
        label: t("stats.totalHoursWorked"),
        value: formattedHours,
        tone: "text-[#c2a3d8]",
        icon: <Gauge className="h-3.5 w-3.5" aria-hidden />,
        accent: "text-[#a883c2]"
      }
    ]
  }, [employees, todayRecords, t])

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

      <div className="panel overflow-hidden no-print">
        <div className="grid grid-cols-2 gap-px bg-[rgba(214,186,140,0.1)] sm:grid-cols-3 lg:grid-cols-5">
          {statCells.map(cell => (
            <div key={cell.label} className="group bg-[rgba(20,17,13,0.94)] px-5 py-4 transition-colors hover:bg-[rgba(28,24,18,0.94)]">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[0.6rem] font-semibold uppercase tracking-[0.13em] text-[#8d8275]">
                  {cell.label}
                </span>
                <span className={cell.accent}>{cell.icon}</span>
              </div>
              <span className={`mt-2 block font-mono text-[1.25rem] sm:text-[1.4rem] font-semibold leading-none ${cell.tone}`}>
                {cell.value}
              </span>
            </div>
          ))}
        </div>
      </div>

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
                        {formatDuration(item.minutes, t("common.hours"), t("common.minutes"))}
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

        <div className="panel space-y-4 p-5 lg:col-span-6" data-testid="payroll-cost-trend">
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

          {!hasPayrollData ? (
            <p className="py-12 text-center text-xs text-[#8d8275]">{t("dashboard.analytics.noData")}</p>
          ) : (
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
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <div className="panel space-y-4 p-5 lg:col-span-5" data-testid="department-costs">
          <div className="flex items-center justify-between border-b border-[color:var(--line)] pb-3">
            <div className="flex items-center gap-2.5">
              <span className="grid h-8 w-8 place-items-center rounded-lg border border-[rgba(214,171,91,0.35)] bg-[rgba(214,171,91,0.12)] text-[#e6c98a]">
                <Building2 className="h-4 w-4" />
              </span>
              <div>
                <h3 className="text-sm font-semibold text-[#f4ece0]">{t("dashboard.analytics.departmentCosts")}</h3>
                <p className="text-[0.68rem] text-[#8d8275]">
                  {t("dashboard.analytics.departmentCostsHint", { count: insights?.range.months ?? 6 })}
                </p>
              </div>
            </div>
          </div>

          {departmentCosts.rows.length === 0 ? (
            <p className="py-12 text-center text-xs text-[#8d8275]">{t("dashboard.analytics.noData")}</p>
          ) : (
            <div className="space-y-2.5">
              {departmentCosts.rows.map(row => {
                const percent = Math.min(100, Math.max(4, Math.round((row.netAmountMinor / departmentCosts.maxMinor) * 100)))
                return (
                  <div
                    key={row.department}
                    className="space-y-1"
                    data-department={row.department}
                    data-amount-minor={row.netAmountMinor}
                    data-overtime-minutes={row.overtimeMinutes}
                  >
                    <div className="flex items-center justify-between gap-2 text-xs">
                      <span className="truncate font-medium text-[#f4ece0]">
                        {row.department}
                        <span className="ms-1.5 font-mono text-[0.66rem] text-[#8d8275]">
                          ({row.employees} {t("employees.employee")})
                        </span>
                      </span>
                      <span className="shrink-0 font-mono font-semibold text-[#e6c98a]" dir="ltr">
                        {row.formatted}
                      </span>
                    </div>
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-[rgba(255,246,230,0.06)]">
                      <div
                        className="h-full rounded-full bg-[linear-gradient(90deg,rgba(214,171,91,0.55),#d6ab5b)] transition-all duration-500"
                        style={{ width: `${percent}%` }}
                      />
                    </div>
                  </div>
                )
              })}
              <div
                className="mt-3 flex items-center justify-between border-t border-[color:var(--line)] pt-3 text-xs"
                data-testid="department-costs-total"
                data-amount-minor={departmentCosts.totalMinor}
              >
                <span className="font-semibold text-[#f4ece0]">{t("dashboard.analytics.total")}</span>
                <span className="font-mono font-semibold text-[#e6c98a]" dir="ltr">
                  {departmentCosts.totalFormatted}
                </span>
              </div>
            </div>
          )}
        </div>

        <div className="panel space-y-4 p-5 lg:col-span-4" data-testid="overtime-trend">
          <div className="flex items-center justify-between border-b border-[color:var(--line)] pb-3">
            <div className="flex items-center gap-2.5">
              <span className="grid h-8 w-8 place-items-center rounded-lg border border-[rgba(235,160,80,0.35)] bg-[rgba(235,160,80,0.12)] text-[#e6b276]">
                <Timer className="h-4 w-4" />
              </span>
              <div>
                <h3 className="text-sm font-semibold text-[#f4ece0]">{t("dashboard.analytics.overtimeTrend")}</h3>
                <p className="text-[0.68rem] text-[#8d8275]">{t("dashboard.analytics.overtimeTrendHint")}</p>
              </div>
            </div>
          </div>

          {!hasPayrollData ? (
            <p className="py-12 text-center text-xs text-[#8d8275]">{t("dashboard.analytics.noData")}</p>
          ) : (
            <>
              <div className="flex h-40 items-end justify-between gap-2 pt-4">
                {overtimeTrend.items.map(item => {
                  const heightPercent = item.minutes > 0
                    ? Math.max(12, Math.round((item.minutes / overtimeTrend.maxMinutes) * 100))
                    : 5
                  return (
                    <div
                      key={item.key}
                      className="group flex flex-1 flex-col items-center justify-end gap-2"
                      data-month={item.key}
                      data-minutes={item.minutes}
                      data-amount-minor={item.amountMinor}
                      title={`${formatDuration(item.minutes, t("common.hours"), t("common.minutes"))} · ${item.amount}`}
                    >
                      <span className="font-mono text-[0.6rem] font-semibold text-[#e6b276] opacity-0 transition-opacity group-hover:opacity-100">
                        {formatDuration(item.minutes, t("common.hours"), t("common.minutes"))}
                      </span>
                      <div className="flex h-24 w-full max-w-[30px] items-end overflow-hidden rounded-t-md bg-[rgba(255,246,230,0.06)]">
                        <div
                          className="w-full rounded-t-md bg-[linear-gradient(180deg,#e6b276,#b3762f)] transition-all duration-500 group-hover:brightness-110"
                          style={{ height: `${heightPercent}%` }}
                        />
                      </div>
                      <span className="text-[0.64rem] font-semibold text-[#8d8275]">{item.label}</span>
                    </div>
                  )
                })}
              </div>
              <div
                className="flex items-center justify-between border-t border-[color:var(--line)] pt-3 text-xs"
                data-testid="overtime-total"
                data-minutes={overtimeTrend.totalMinutes}
                data-amount-minor={overtimeTrend.totalAmountMinor}
              >
                <span className="text-[#8d8275]">{t("dashboard.analytics.overtimeTotal")}</span>
                <span className="font-mono font-semibold text-[#e6b276]" dir="ltr">
                  {formatDuration(overtimeTrend.totalMinutes, t("common.hours"), t("common.minutes"))} · {overtimeTrend.totalFormatted}
                </span>
              </div>
            </>
          )}
        </div>

        <div className="panel space-y-4 p-5 lg:col-span-3" data-testid="absence-rate">
          <div className="flex items-center justify-between border-b border-[color:var(--line)] pb-3">
            <div className="flex items-center gap-2.5">
              <span className="grid h-8 w-8 place-items-center rounded-lg border border-[rgba(200,95,78,0.35)] bg-[rgba(200,95,78,0.12)] text-[#e9a094]">
                <Gauge className="h-4 w-4" />
              </span>
              <div>
                <h3 className="text-sm font-semibold text-[#f4ece0]">{t("dashboard.analytics.absenceRate")}</h3>
                <p className="text-[0.68rem] text-[#8d8275]">{t("dashboard.analytics.absenceHint")}</p>
              </div>
            </div>
          </div>

          {!absence || !absence.hasData ? (
            <p className="py-12 text-center text-xs text-[#8d8275]">{t("dashboard.analytics.noData")}</p>
          ) : (
            <div
              className="space-y-4"
              data-rate={absence.rate}
              data-expected-days={absence.expectedDays}
              data-present-days={absence.presentDays}
              data-leave-days={absence.leaveDays}
              data-absent-days={absence.absentDays}
              data-working-days={absence.workingDays}
              data-active-employees={absence.activeEmployees}
            >
              <div className="flex items-baseline gap-2">
                <span className="font-mono text-3xl font-bold text-[#e9a094]">{absencePercent}%</span>
                <span className="text-[0.68rem] text-[#8d8275]">
                  {absence.absentDays} / {absence.expectedDays}
                </span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-[rgba(255,246,230,0.06)]">
                <div
                  className="h-full rounded-full bg-[linear-gradient(90deg,rgba(200,95,78,0.55),#c85f4e)] transition-all duration-500"
                  style={{ width: `${Math.min(100, absencePercent)}%` }}
                />
              </div>
              <dl className="grid grid-cols-2 gap-2 text-[0.68rem]">
                <div>
                  <dt className="text-[#8d8275]">{t("dashboard.analytics.daysPresent")}</dt>
                  <dd className="font-mono font-semibold text-[#78dcbc]">{absence.presentDays}</dd>
                </div>
                <div>
                  <dt className="text-[#8d8275]">{t("dashboard.analytics.daysLeave")}</dt>
                  <dd className="font-mono font-semibold text-[#e6c98a]">{absence.leaveDays}</dd>
                </div>
                <div>
                  <dt className="text-[#8d8275]">{t("dashboard.analytics.daysAbsent")}</dt>
                  <dd className="font-mono font-semibold text-[#e9a094]">{absence.absentDays}</dd>
                </div>
                <div>
                  <dt className="text-[#8d8275]">{t("dashboard.analytics.daysExpected")}</dt>
                  <dd className="font-mono font-semibold text-slate-300">{absence.expectedDays}</dd>
                </div>
              </dl>
              <p className="text-[0.64rem] leading-relaxed text-[#8d8275]" data-testid="absence-basis">
                {t("dashboard.analytics.absenceBasis", {
                  days: absence.workingDays,
                  employees: absence.activeEmployees,
                  expected: absence.expectedDays
                })}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
