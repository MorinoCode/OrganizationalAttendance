import React, { useEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { useTranslation } from "react-i18next"
import { AlertCircle, KeyRound, Lock, ShieldAlert, User, X } from "lucide-react"
import { useAppStore } from "../store/useAppStore"
import { errorKey } from "../services/errors"

interface AdminPasscodeModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
}

export const AdminPasscodeModal: React.FC<AdminPasscodeModalProps> = ({ isOpen, onClose, onSuccess }) => {
  const { t } = useTranslation()
  const login = useAppStore(state => state.login)
  const emergencyReset = useAppStore(state => state.emergencyReset)
  const [mode, setMode] = useState<"login" | "recovery">("login")
  const [password, setPassword] = useState("")
  const [verification, setVerification] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [lockClicks, setLockClicks] = useState(0)
  const lastLockClickRef = useRef<number>(0)
  const loginInputRef = useRef<HTMLInputElement>(null)
  const recoveryInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (isOpen) {
      setMode("login")
      setPassword("")
      setVerification("")
      setNewPassword("")
      setConfirmPassword("")
      setError(null)
      setLockClicks(0)
      window.setTimeout(() => loginInputRef.current?.focus(), 50)
    }
  }, [isOpen])

  useEffect(() => {
    if (mode === "recovery") {
      window.setTimeout(() => recoveryInputRef.current?.focus(), 50)
    } else {
      window.setTimeout(() => loginInputRef.current?.focus(), 50)
    }
  }, [mode])

  useEffect(() => {
    if (!isOpen) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        if (mode === "recovery") {
          setMode("login")
          setError(null)
        } else {
          onClose()
        }
      }
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [isOpen, mode, onClose])

  if (!isOpen) return null

  const handleLockClick = () => {
    const now = Date.now()
    if (now - lastLockClickRef.current > 3000) {
      setLockClicks(1)
    } else {
      const next = lockClicks + 1
      if (next >= 5) {
        setMode("recovery")
        setError(null)
        setLockClicks(0)
      } else {
        setLockClicks(next)
      }
    }
    lastLockClickRef.current = now
  }

  const handleLoginSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!password || busy) return
    setBusy(true)
    setError(null)
    try {
      await login(password)
      setPassword("")
      onSuccess()
    } catch (caught) {
      setError(errorKey(caught))
    } finally {
      setBusy(false)
    }
  }

  const handleRecoverySubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!verification || !newPassword || busy) return
    if (newPassword.length < 4) {
      setError("errors.password_too_short")
      return
    }
    if (newPassword !== confirmPassword) {
      setError("errors.password_mismatch")
      return
    }
    setBusy(true)
    setError(null)
    try {
      await emergencyReset(verification, newPassword)
      setMode("login")
      onSuccess()
    } catch (caught) {
      setError(errorKey(caught))
    } finally {
      setBusy(false)
    }
  }

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(6,5,4,0.74)] p-4 backdrop-blur-sm"
      onClick={e => {
        if (e.target === e.currentTarget && !busy) onClose()
      }}
    >
      <div role="dialog" aria-modal="true" aria-labelledby="admin-dialog-title" className="panel w-full max-w-sm overflow-hidden">
        <div className="h-px w-full bg-[linear-gradient(90deg,rgba(214,171,91,0),rgba(214,171,91,0.9),rgba(214,171,91,0))]" />
        <div className="p-6">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              {mode === "login" ? (
                <button
                  type="button"
                  onClick={handleLockClick}
                  className="grid h-10 w-10 place-items-center rounded-xl border border-[rgba(214,171,91,0.34)] bg-[rgba(214,171,91,0.14)] text-[#e6c98a] transition-transform active:scale-95"
                  title={t("admin.login")}
                >
                  <Lock className="h-4 w-4" aria-hidden />
                </button>
              ) : (
                <span className="grid h-10 w-10 place-items-center rounded-xl border border-[rgba(214,171,91,0.34)] bg-[rgba(214,171,91,0.14)] text-[#e6c98a]">
                  <ShieldAlert className="h-4 w-4" aria-hidden />
                </span>
              )}
              <div>
                <h3 id="admin-dialog-title" className="text-[0.95rem] font-semibold text-[#f4ece0]">
                  {mode === "login" ? t("admin.login") : t("admin.emergencyRecoveryTitle")}
                </h3>
                <p className="text-[0.68rem] text-[#8d8275]">
                  {mode === "login" ? t("settings.adminPassword") : t("admin.emergencyRecoveryHint")}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-md p-1 text-[#7b7063] transition-colors hover:bg-[rgba(255,246,230,0.06)] hover:text-[#f4ece0] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#c08f38]/50"
              aria-label={t("common.close")}
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {mode === "login" ? (
            <form onSubmit={handleLoginSubmit} className="mt-6 space-y-4">
              <div>
                <div className="relative">
                  <input
                    ref={loginInputRef}
                    type="password"
                    value={password}
                    onChange={event => {
                      setPassword(event.target.value)
                      setError(null)
                    }}
                    placeholder={t("admin.passwordPlaceholder")}
                    autoComplete="current-password"
                    dir="ltr"
                    className={`w-full rounded-xl border bg-[rgba(255,246,230,0.045)] px-10 py-3 text-center font-mono text-base tracking-[0.3em] text-[#f4ece0] transition-all focus:outline-none focus:ring-2 ${
                      error
                        ? "border-[rgba(200,95,78,0.7)] focus:ring-[rgba(200,95,78,0.25)]"
                        : "border-[color:var(--line-strong)] focus:border-[rgba(214,171,91,0.7)] focus:ring-[rgba(214,171,91,0.2)]"
                    }`}
                  />
                  <KeyRound className="pointer-events-none absolute start-3 top-3.5 h-4 w-4 text-[#6b6054]" />
                </div>
                {error && (
                  <div className="mt-2 flex items-center gap-1.5 text-[0.7rem] font-medium text-[#e9a094]" role="alert">
                    <AlertCircle className="h-3.5 w-3.5" aria-hidden />
                    <span>{t(error, { defaultValue: t("admin.invalidPassword") })}</span>
                  </div>
                )}
              </div>

              <div className="flex gap-2.5 pt-1">
                <button type="button" onClick={onClose} className="btn btn-ghost flex-1">
                  {t("admin.cancel")}
                </button>
                <button type="submit" disabled={busy || !password} className="btn btn-primary flex-1">
                  {t("admin.submit")}
                </button>
              </div>

              <div className="pt-2 text-center">
                <button
                  type="button"
                  onClick={() => {
                    setMode("recovery")
                    setError(null)
                  }}
                  className="text-[0.72rem] text-[#8d8275] transition-colors hover:text-[#d6ab5b] focus:outline-none"
                >
                  {t("admin.forgotPassword")}
                </button>
              </div>
            </form>
          ) : (
            <form onSubmit={handleRecoverySubmit} className="mt-5 space-y-3.5">
              <div>
                <label className="mb-1 block text-[0.72rem] font-medium text-[#c8beaf]">
                  {t("admin.recoveryVerification")}
                </label>
                <div className="relative">
                  <input
                    ref={recoveryInputRef}
                    type="text"
                    value={verification}
                    onChange={event => {
                      setVerification(event.target.value)
                      setError(null)
                    }}
                    placeholder={t("admin.recoveryVerificationPlaceholder")}
                    className="w-full rounded-xl border border-[color:var(--line-strong)] bg-[rgba(255,246,230,0.045)] px-3 py-2 text-sm text-[#f4ece0] placeholder:text-[#6b6054] focus:border-[rgba(214,171,91,0.7)] focus:outline-none focus:ring-2 focus:ring-[rgba(214,171,91,0.2)]"
                  />
                  <User className="pointer-events-none absolute end-3 top-2.5 h-4 w-4 text-[#6b6054]" />
                </div>
              </div>

              <div>
                <label className="mb-1 block text-[0.72rem] font-medium text-[#c8beaf]">
                  {t("admin.newPassword")}
                </label>
                <div className="relative">
                  <input
                    type="password"
                    value={newPassword}
                    onChange={event => {
                      setNewPassword(event.target.value)
                      setError(null)
                    }}
                    placeholder={t("admin.newPasswordPlaceholder")}
                    dir="ltr"
                    className="w-full rounded-xl border border-[color:var(--line-strong)] bg-[rgba(255,246,230,0.045)] px-3 py-2 font-mono text-sm tracking-[0.2em] text-[#f4ece0] placeholder:font-sans placeholder:tracking-normal placeholder:text-[#6b6054] focus:border-[rgba(214,171,91,0.7)] focus:outline-none focus:ring-2 focus:ring-[rgba(214,171,91,0.2)]"
                  />
                  <KeyRound className="pointer-events-none absolute end-3 top-2.5 h-4 w-4 text-[#6b6054]" />
                </div>
              </div>

              <div>
                <label className="mb-1 block text-[0.72rem] font-medium text-[#c8beaf]">
                  {t("admin.confirmNewPassword")}
                </label>
                <div className="relative">
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={event => {
                      setConfirmPassword(event.target.value)
                      setError(null)
                    }}
                    placeholder={t("admin.confirmNewPasswordPlaceholder")}
                    dir="ltr"
                    className="w-full rounded-xl border border-[color:var(--line-strong)] bg-[rgba(255,246,230,0.045)] px-3 py-2 font-mono text-sm tracking-[0.2em] text-[#f4ece0] placeholder:font-sans placeholder:tracking-normal placeholder:text-[#6b6054] focus:border-[rgba(214,171,91,0.7)] focus:outline-none focus:ring-2 focus:ring-[rgba(214,171,91,0.2)]"
                  />
                  <KeyRound className="pointer-events-none absolute end-3 top-2.5 h-4 w-4 text-[#6b6054]" />
                </div>
              </div>

              {error && (
                <div className="flex items-center gap-1.5 text-[0.7rem] font-medium text-[#e9a094]" role="alert">
                  <AlertCircle className="h-3.5 w-3.5 shrink-0" aria-hidden />
                  <span>{t(error, { defaultValue: error })}</span>
                </div>
              )}

              <div className="flex gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setMode("login")
                    setError(null)
                  }}
                  className="btn btn-ghost flex-1"
                >
                  {t("admin.back")}
                </button>
                <button
                  type="submit"
                  disabled={busy || !verification || !newPassword || newPassword.length < 4 || !confirmPassword}
                  className="btn btn-primary flex-1"
                >
                  {t("admin.resetAndLogin")}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>,
    document.body
  )
}
