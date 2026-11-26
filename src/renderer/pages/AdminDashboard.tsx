import React, { useState } from "react"
import { useTranslation } from "react-i18next"
import {
  ArrowLeft,
  Clock,
  FileText,
  LayoutDashboard,
  Settings,
  Users
} from "lucide-react"

import { CompanySettings } from "../types"
import { EmployeesPage } from "./EmployeesPage"
import { AttendanceReportsPage } from "./AttendanceReportsPage"
import { PayrollPage } from "./PayrollPage"
import { SettingsPage } from "./SettingsPage"
import { DashboardOverview } from "../components/DashboardOverview"

type AdminTab = "overview" | "employees" | "attendance" | "payroll" | "settings"

interface AdminDashboardProps {
  settings: CompanySettings
  onBackToKiosk: () => void
  onSessionEnded: (message: string) => void
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({ settings, onBackToKiosk, onSessionEnded }) => {
  const { t } = useTranslation()
  const [tab, setTab] = useState<AdminTab>("overview")

  const tabs: Array<{ id: AdminTab; label: string; icon: React.ReactNode }> = [
    { id: "overview", label: t("admin.overview"), icon: <LayoutDashboard className="h-4 w-4" aria-hidden /> },
    { id: "employees", label: t("admin.employees"), icon: <Users className="h-4 w-4" aria-hidden /> },
    { id: "attendance", label: t("admin.attendance"), icon: <Clock className="h-4 w-4" aria-hidden /> },
    { id: "payroll", label: t("admin.payroll"), icon: <FileText className="h-4 w-4" aria-hidden /> },
    { id: "settings", label: t("admin.settings"), icon: <Settings className="h-4 w-4" aria-hidden /> }
  ]

  return (
    <div className="mx-auto max-w-[88rem] space-y-6 px-4 py-7 sm:px-8">
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
