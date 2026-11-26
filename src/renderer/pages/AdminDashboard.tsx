import React, { useEffect, useState } from "react"
import { useTranslation } from "react-i18next"
import {
  ArrowLeft,
  CheckCircle,
  Clock,
  Coffee,
  FileText,
  Gauge,
  LayoutDashboard,
  Settings,
  Users
} from "lucide-react"

import { api } from "../services/api"
import { isApiError, errorKey } from "../services/errors"
import { minutesToHours } from "../services/date"
import { CompanySettings } from "../types"
import { EmployeesPage } from "./EmployeesPage"
import { AttendanceReportsPage } from "./AttendanceReportsPage"
import { PayrollPage } from "./PayrollPage"
import { SettingsPage } from "./SettingsPage"
import { DashboardOverview } from "../components/DashboardOverview"
import { FeedbackBanner } from "../components/FeedbackBanner"

type AdminTab = "overview" | "employees" | "attendance" | "payroll" | "settings"

interface AdminDashboardProps {
  settings: CompanySettings
  onBackToKiosk: () => void
  onSessionEnded: (message: string) => void
}

interface Stats {
  totalEmployees: number
  working: number
  onBreak: number
  completed: number
  hours: number
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({ settings, onBackToKiosk, onSessionEnded }) => {
  const { t } = useTranslation()
  const [tab, setTab] = useState<AdminTab>("overview")
  const [stats, setStats] = useState<Stats>({ totalEmployees: 0, working: 0, onBreak: 0, completed: 0, hours: 0 })
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true

    const load = async () => {
      try {
        const [employees, records] = await Promise.all([api.employees.list(true), api.attendance.today()])
        if (!active) return
        setError(null)
        setStats({
          totalEmployees: employees.filter(employee => employee.isActive).length,
          working: records.filter(record => record.status === "present").length,
          onBreak: records.filter(record => record.status === "on_break").length,
          completed: records.filter(record => record.status === "completed").length,
          hours: minutesToHours(records.reduce((total, record) => total + record.netMinutes, 0))
        })
      } catch (caught) {
        if (!active) return
        if (isApiError(caught) && caught.code === "unauthorized") {
          onSessionEnded(t("admin.sessionExpired"))
          return
        }
        setError(t(errorKey(caught)))
      }
    }

    void load()
    return () => {
      active = false
    }
  }, [tab, onSessionEnded, t])

  const tabs: Array<{ id: AdminTab; label: string; icon: React.ReactNode }> = [
    { id: "overview", label: t("admin.overview"), icon: <LayoutDashboard className="h-4 w-4" aria-hidden /> },
    { id: "employees", label: t("admin.employees"), icon: <Users className="h-4 w-4" aria-hidden /> },
    { id: "attendance", label: t("admin.attendance"), icon: <Clock className="h-4 w-4" aria-hidden /> },
    { id: "payroll", label: t("admin.payroll"), icon: <FileText className="h-4 w-4" aria-hidden /> },
    { id: "settings", label: t("admin.settings"), icon: <Settings className="h-4 w-4" aria-hidden /> }
  ]

  const statCells = [
    {
      label: t("stats.totalEmployees"),
      value: stats.totalEmployees,
      tone: "text-[#f4ece0]",
      icon: <Users className="h-3.5 w-3.5" aria-hidden />,
      accent: "text-[#c0b4a3]"
    },
    {
      label: t("stats.activeToday"),
      value: stats.working,
      tone: "text-[#78dcbc]",
      icon: <Clock className="h-3.5 w-3.5" aria-hidden />,
      accent: "text-[#46c39f]"
    },
    {
      label: t("stats.onBreakNow"),
      value: stats.onBreak,
      tone: "text-[#e6b276]",
      icon: <Coffee className="h-3.5 w-3.5" aria-hidden />,
      accent: "text-[#d8954e]"
    },
    {
      label: t("stats.completedToday"),
      value: stats.completed,
      tone: "text-[#e6c98a]",
      icon: <CheckCircle className="h-3.5 w-3.5" aria-hidden />,
      accent: "text-[#d6ab5b]"
    },
    {
      label: t("stats.totalHoursWorked"),
      value: stats.hours,
      tone: "text-[#c2a3d8]",
      icon: <Gauge className="h-3.5 w-3.5" aria-hidden />,
      accent: "text-[#a883c2]"
    }
  ]

  return (
    <div className="mx-auto max-w-[88rem] space-y-6 px-4 py-7 sm:px-8">
      {error && (
        <div className="no-print">
          <FeedbackBanner tone="error" message={error} onClose={() => setError(null)} />
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
              <span className={`mt-2 block font-mono text-[1.75rem] font-semibold leading-none ${cell.tone}`}>
                {cell.value}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[color:var(--line)] pb-4 no-print">
        <div role="tablist" aria-label={t("admin.dashboard")} className="flex flex-wrap items-center gap-2 rounded-2xl bg-[rgba(20,17,13,0.85)] p-1.5 border border-[rgba(214,186,140,0.18)] shadow-inner">
          {tabs.map(item => {
            const isActive = tab === item.id
            return (
              <button
                key={item.id}
                type="button"
                role="tab"
                aria-selected={isActive}
                onClick={() => setTab(item.id)}
                className={`flex items-center gap-2 rounded-xl px-4 py-2 text-[0.82rem] font-bold transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(214,171,91,0.5)] ${
                  isActive
                    ? "bg-gradient-to-b from-[#d6ab5b] to-[#b8862f] text-[#1a1305] shadow-[0_12px_24px_-12px_rgba(214,171,91,0.85),inset_0_1px_0_rgba(255,255,255,0.35)] border border-[rgba(255,246,230,0.25)]"
                    : "text-[#c0b4a3] hover:text-[#f4ece0] hover:bg-[rgba(255,246,230,0.06)] border border-transparent"
                }`}
              >
                <span className={isActive ? "text-[#1a1305]" : "text-[#d6ab5b]"}>{item.icon}</span>
                <span>{item.label}</span>
              </button>
            )
          })}
        </div>

        <div className="flex items-center gap-2">
          <button type="button" onClick={onBackToKiosk} className="btn btn-ghost">
            <ArrowLeft className="h-4 w-4 text-[#d6ab5b] rtl:rotate-180" aria-hidden />
            <span>{t("kiosk.title")}</span>
          </button>
        </div>
      </div>

      <div>
        {tab === "overview" && (
          <DashboardOverview
            settings={settings}
            onNavigateTab={setTab}
            onSessionEnded={onSessionEnded}
          />
        )}
        {tab === "employees" && <EmployeesPage settings={settings} onSessionEnded={onSessionEnded} />}
        {tab === "attendance" && <AttendanceReportsPage settings={settings} onSessionEnded={onSessionEnded} />}
        {tab === "payroll" && <PayrollPage settings={settings} onSessionEnded={onSessionEnded} />}
        {tab === "settings" && <SettingsPage settings={settings} onSessionEnded={onSessionEnded} />}
      </div>
    </div>
  )
}
