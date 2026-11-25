import React, { useEffect, useState } from "react"
import { useTranslation } from "react-i18next"
import { Building2, Calendar, Clock, Globe, LogIn, LogOut, ShieldCheck } from "lucide-react"

import { setAppLanguage } from "../i18n/config"
import { CompanySettings, Language } from "../types"
import { LOCALES } from "../services/date"

interface HeaderProps {
  settings: CompanySettings
  isAdmin: boolean
  onOpenAdminAuth: () => void
  onExitAdmin: () => void
  currentView: string
  onNavigate: (view: string) => void
}

const LANGS: Array<{ id: Language; label: string }> = [
  { id: "ar", label: "العربية" },
  { id: "en", label: "EN" },
  { id: "fa", label: "فارسی" }
]

export const Header: React.FC<HeaderProps> = ({
  settings,
  isAdmin,
  onOpenAdminAuth,
  onExitAdmin,
  currentView,
  onNavigate
}) => {
  const { t, i18n } = useTranslation()
  const [now, setNow] = useState(() => new Date())

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1000)
    return () => window.clearInterval(timer)
  }, [])

  const currentLang = (i18n.language || "ar") as Language
  const locale = LOCALES[currentLang] ?? LOCALES.ar

  const formattedDate = now.toLocaleDateString(locale, {
    year: "numeric",
    month: "short",
    day: "numeric",
    weekday: "short"
  })

  const formattedTime = now.toLocaleTimeString(locale, {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false
  })

  return (
    <header className="sticky top-0 z-40 border-b border-[color:var(--line)] bg-[rgba(11,10,8,0.82)] backdrop-blur-xl no-print">
      <div className="h-px w-full bg-gradient-to-r from-transparent via-[rgba(201,162,75,0.55)] to-transparent" />
      <div className="mx-auto flex min-h-[4.5rem] max-w-[88rem] flex-wrap items-center justify-between gap-4 px-4 py-3 sm:px-8">
        <button
          type="button"
          onClick={() => onNavigate("kiosk")}
          className="group flex items-center gap-3.5 rounded-xl text-start focus:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--brass)]/50"
        >
          <span className="relative grid h-11 w-11 place-items-center rounded-xl border border-[rgba(214,171,91,0.4)] bg-[linear-gradient(150deg,rgba(214,171,91,0.22),rgba(214,171,91,0.02))] shadow-[inset_0_1px_0_rgba(255,246,230,0.18)]">
            <Building2 className="h-[1.15rem] w-[1.15rem] text-[#e6c98a]" aria-hidden />
            <span className="absolute -bottom-0.5 -end-0.5 h-2.5 w-2.5 rounded-full border-2 border-[#0b0a08] bg-[#46c39f]" />
          </span>
          <span className="min-w-0">
            <span className="block truncate text-[0.98rem] font-semibold tracking-tight text-[#f4ece0] transition-colors group-hover:text-[#e6c98a]">
              {settings.companyName || t("appTitle")}
            </span>
            <span className="mt-0.5 flex items-center gap-2 text-[0.7rem] font-medium text-[#9d9182]">
              <span className="truncate">{settings.ownerName}</span>
              <span className="h-1 w-1 rounded-full bg-[rgba(214,171,91,0.45)]" aria-hidden />
              <span className="truncate opacity-80">{settings.ownerRole}</span>
            </span>
          </span>
        </button>

        <div className="flex items-center gap-2.5">
          <div className="hidden items-center gap-4 rounded-xl border border-[color:var(--line)] bg-[rgba(20,17,13,0.75)] px-4 py-2 sm:flex">
            <span className="flex items-center gap-2">
              <Clock className="h-3.5 w-3.5 text-[#c08f38]" aria-hidden />
              <span className="font-mono text-[0.95rem] font-semibold tracking-[0.08em] text-[#f0e6d6]">
                {formattedTime}
              </span>
            </span>
            <span className="h-4 w-px bg-[color:var(--line)]" aria-hidden />
            <span className="flex items-center gap-2 text-[0.72rem] font-medium text-[#c0b4a3]">
              <Calendar className="h-3.5 w-3.5 text-[#46c39f]/80" aria-hidden />
              {formattedDate}
            </span>
          </div>

          <div className="flex items-center gap-0.5 rounded-xl border border-[color:var(--line)] bg-[rgba(20,17,13,0.75)] p-1">
            <Globe className="mx-1 hidden h-3.5 w-3.5 text-[#7b7063] sm:block" aria-hidden />
            {LANGS.map(lang => (
              <button
                key={lang.id}
                type="button"
                onClick={() => setAppLanguage(lang.id)}
                aria-pressed={currentLang === lang.id}
                className={`rounded-lg px-2.5 py-1 text-[0.7rem] font-bold transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-[#c08f38]/50 ${
                  currentLang === lang.id
                    ? "bg-[linear-gradient(180deg,#d6ab5b,#b8862f)] text-[#1a1305] shadow-sm"
                    : "text-[#9d9182] hover:text-[#f4ece0]"
                }`}
              >
                {lang.label}
              </button>
            ))}
          </div>

          {isAdmin ? (
            <div className="flex items-center gap-2">
              {currentView === "kiosk" && (
                <button
                  type="button"
                  onClick={() => onNavigate("admin")}
                  className="btn btn-primary h-9 px-3.5"
                >
                  <ShieldCheck className="h-4 w-4" aria-hidden />
                  <span>{t("admin.dashboard")}</span>
                </button>
              )}
              <button type="button" onClick={onExitAdmin} className="btn btn-danger h-9 px-3.5">
                <LogOut className="h-4 w-4" aria-hidden />
                <span>{t("admin.logout")}</span>
              </button>
            </div>
          ) : (
            <button type="button" onClick={onOpenAdminAuth} className="btn btn-ghost h-9 px-3.5">
              <LogIn className="h-4 w-4 text-[#46c39f]" aria-hidden />
              <span>{t("admin.login")}</span>
            </button>
          )}
        </div>
      </div>
    </header>
  )
}
