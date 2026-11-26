import React, { useState } from "react"
import { useTranslation } from "react-i18next"
import { AlertCircle, Globe, ShieldCheck, UploadCloud } from "lucide-react"
import { BrandLogo } from "./BrandLogo"
import { useAppStore } from "../store/useAppStore"
import { errorKey } from "../services/errors"
import { setAppLanguage } from "../i18n/config"
import { Language } from "../types"
import { api } from "../services/api"

interface FirstTimeSetupModalProps {
  isOpen: boolean
  onComplete: () => void
}

const LANG_OPTIONS: Array<{ id: Language; label: string }> = [
  { id: "ar", label: "العربية" },
  { id: "en", label: "EN" },
  { id: "fa", label: "فارسی" }
]

export const FirstTimeSetupModal: React.FC<FirstTimeSetupModalProps> = ({ isOpen, onComplete }) => {
  const { t, i18n } = useTranslation()
  const completeSetup = useAppStore(state => state.completeSetup)
  const currentLang = (i18n.language || "ar") as Language

  const [companyName, setCompanyName] = useState("")
  const [ownerName, setOwnerName] = useState("")
  const [ownerRole, setOwnerRole] = useState("")
  const [currency, setCurrency] = useState("KWD")
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  if (!isOpen) return null

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    setError(null)

    if (password.length < 4) {
      setError("errors.password_too_short")
      return
    }
    if (password !== confirmPassword) {
      setError("settings.passwordMismatch")
      return
    }

    setBusy(true)
    try {
      await completeSetup({
        companyName: companyName.trim(),
        ownerName: ownerName.trim(),
        ownerRole: ownerRole.trim() || t("settings.ownerRole"),
        currency: currency.trim() || "KWD",
        currencyDecimals: 3,
        defaultDailyHours: 8,
        standardWorkDays: 26,
        overtimeMultiplier: 1.25,
        password
      })
      onComplete()
    } catch (caught) {
      setError(errorKey(caught))
    } finally {
      setBusy(false)
    }
  }

  const handleRestore = async () => {
    try {
      setBusy(true)
      const res = await api.backup.restore()
      if (!res.canceled) {
        window.location.reload()
      }
    } catch (caught) {
      setError(errorKey(caught))
    } finally {
      setBusy(false)
    }
  }

  const fieldClass =
    "w-full rounded-xl border border-[color:var(--line)] bg-[rgba(255,246,230,0.045)] px-4 py-2.5 text-sm text-[#f4ece0] placeholder-[#6b6054] focus:border-[rgba(214,171,91,0.6)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(214,171,91,0.18)]"

  return (
    <div className="flex min-h-screen items-center justify-center bg-[rgba(6,5,4,0.55)] px-4 py-10">
      <div className="panel grid w-full max-w-4xl overflow-hidden md:grid-cols-[minmax(0,17rem)_minmax(0,1fr)]">
        {/* brand rail */}
        <aside className="relative hidden flex-col justify-between border-e border-[color:var(--line)] bg-[linear-gradient(165deg,rgba(214,171,91,0.16),rgba(214,171,91,0.02)_45%,rgba(11,10,8,0.9))] p-7 md:flex">
          <div>
            <BrandLogo className="h-12 w-12 shrink-0 drop-shadow-[0_2px_8px_rgba(214,171,91,0.25)]" size={48} />
            <h1 className="mt-6 text-lg font-semibold leading-snug tracking-tight text-[#f8efd8]">
              {t("appTitle")}
            </h1>
            <p className="mt-2 text-[0.72rem] leading-relaxed text-[#b0a394]">{t("settings.initialSetupHint")}</p>
          </div>

          <div className="space-y-3">
            <span className="rule-brass block" />
            <p className="text-[0.62rem] font-semibold uppercase tracking-[0.16em] text-[#8d8275]">
              {t("settings.initialSetupBadge")}
            </p>
          </div>
        </aside>

        {/* form */}
        <div className="custom-scrollbar max-h-[90vh] overflow-y-auto p-6 sm:p-8">
          <div className="flex items-center justify-between gap-4">
            <span className="eyebrow">
              <Globe className="h-3.5 w-3.5" aria-hidden />
              {t("common.language")}
            </span>
            <div className="flex items-center gap-0.5 rounded-xl border border-[color:var(--line)] bg-[rgba(11,10,8,0.6)] p-1">
              {LANG_OPTIONS.map(option => (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => setAppLanguage(option.id)}
                  aria-pressed={currentLang === option.id}
                  className={`rounded-lg px-2.5 py-1 text-[0.7rem] font-bold transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-[#c08f38]/50 ${
                    currentLang === option.id
                      ? "bg-[linear-gradient(180deg,#d6ab5b,#b8862f)] text-[#1a1305]"
                      : "text-[#9d9182] hover:text-[#f4ece0]"
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          <h2 id="setup-title" className="mt-6 text-[1.35rem] font-semibold tracking-tight text-[#fbf7f0]">
            {t("settings.companyInfo")}
          </h2>

          <form onSubmit={handleSubmit} className="mt-5 space-y-4">
            <div>
              <label className="mb-1.5 block text-[0.7rem] font-semibold text-[#9d9182]" htmlFor="setup-company">
                {t("settings.companyName")} *
              </label>
              <input
                id="setup-company"
                type="text"
                required
                value={companyName}
                onChange={event => setCompanyName(event.target.value)}
                className={fieldClass}
              />
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-[0.7rem] font-semibold text-[#9d9182]" htmlFor="setup-owner">
                  {t("settings.ownerName")} *
                </label>
                <input
                  id="setup-owner"
                  type="text"
                  required
                  value={ownerName}
                  onChange={event => setOwnerName(event.target.value)}
                  className={fieldClass}
                />
              </div>
              <div>
                <label className="mb-1.5 block text-[0.7rem] font-semibold text-[#9d9182]" htmlFor="setup-role">
                  {t("settings.ownerRole")}
                </label>
                <input
                  id="setup-role"
                  type="text"
                  value={ownerRole}
                  onChange={event => setOwnerRole(event.target.value)}
                  className={fieldClass}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-[minmax(0,8rem)_minmax(0,1fr)]">
              <div>
                <label className="mb-1.5 block text-[0.7rem] font-semibold text-[#9d9182]" htmlFor="setup-currency">
                  {t("settings.currencyCode")}
                </label>
                <input
                  id="setup-currency"
                  type="text"
                  value={currency}
                  onChange={event => setCurrency(event.target.value.toUpperCase())}
                  dir="ltr"
                  maxLength={12}
                  className={`${fieldClass} font-mono`}
                />
              </div>
              <div className="flex items-end">
                <p className="text-[0.66rem] leading-relaxed text-[#7b7063]">{t("settings.passwordHint")}</p>
              </div>
            </div>

            <div className="rounded-xl border border-[rgba(214,171,91,0.22)] bg-[rgba(214,171,91,0.06)] p-4">
              <div className="mb-3 flex items-center gap-2 text-[0.78rem] font-semibold text-[#f0dfb0]">
                <ShieldCheck className="h-4 w-4 text-[#d6ab5b]" aria-hidden />
                <span>{t("settings.adminPassword")}</span>
              </div>
              <div className="space-y-3">
                <input
                  type="password"
                  required
                  autoComplete="new-password"
                  value={password}
                  onChange={event => setPassword(event.target.value)}
                  placeholder={t("settings.newPassword")}
                  className={fieldClass}
                />
                <input
                  type="password"
                  required
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={event => setConfirmPassword(event.target.value)}
                  placeholder={t("settings.confirmPassword")}
                  className={fieldClass}
                />
              </div>
            </div>

            {error && (
              <div
                className="flex items-center gap-2 rounded-xl border border-[rgba(200,95,78,0.4)] bg-[rgba(173,72,57,0.16)] p-3 text-[0.72rem] font-medium text-[#fae2dd]"
                role="alert"
              >
                <AlertCircle className="h-4 w-4 shrink-0 text-[#e9a094]" aria-hidden />
                <span>{t(error)}</span>
              </div>
            )}

            <button type="submit" disabled={busy} className="btn btn-primary w-full py-3">
              {t("settings.saveSettings")}
            </button>

            <div className="relative my-2 flex items-center justify-center">
              <div className="w-full border-t border-[color:var(--line)]" />
              <span className="absolute bg-[#14110d] px-3 text-[0.66rem] text-[#6b6054]">{t("common.or")}</span>
            </div>

            <button type="button" onClick={handleRestore} disabled={busy} className="btn btn-ghost w-full">
              <UploadCloud className="h-4 w-4 text-[#d6ab5b]" aria-hidden />
              <span>{t("settings.restoreExistingBackup")}</span>
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
