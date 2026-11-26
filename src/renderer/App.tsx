import React, { useEffect, useState } from "react"
import { useTranslation } from "react-i18next"
import { AlertCircle, Loader2, RefreshCw } from "lucide-react"

import { Header } from "./components/Header"
import { AdminPasscodeModal } from "./components/AdminPasscodeModal"
import { FirstTimeSetupModal } from "./components/FirstTimeSetupModal"
import { FeedbackBanner } from "./components/FeedbackBanner"
import { KioskPunchPage } from "./pages/KioskPunchPage"
import { AdminDashboard } from "./pages/AdminDashboard"
import { useAppStore } from "./store/useAppStore"

const IDLE_TIMEOUT_MS = 10 * 60 * 1000

export const App: React.FC = () => {
  const { t } = useTranslation()
  const status = useAppStore(state => state.status)
  const errorCode = useAppStore(state => state.errorCode)
  const settings = useAppStore(state => state.settings)
  const token = useAppStore(state => state.token)
  const tokenExpiresAt = useAppStore(state => state.tokenExpiresAt)
  const initialize = useAppStore(state => state.initialize)
  const logout = useAppStore(state => state.logout)

  const [view, setView] = useState<"kiosk" | "admin">("kiosk")
  const [authOpen, setAuthOpen] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)

  useEffect(() => {
    document.title = t("appTitle")
  }, [t])

  useEffect(() => {
    void initialize()
  }, [initialize])

  const isAdmin = Boolean(token)

  useEffect(() => {
    if (!isAdmin) setView("kiosk")
  }, [isAdmin])

  useEffect(() => {
    if (!isAdmin) return

    let timer = 0
    const lock = () => {
      void logout()
      setView("kiosk")
      setNotice(t("admin.idleLocked"))
    }
    const reset = () => {
      window.clearTimeout(timer)
      timer = window.setTimeout(lock, IDLE_TIMEOUT_MS)
    }

    const events: Array<keyof WindowEventMap> = ["pointerdown", "keydown", "wheel"]
    events.forEach(eventName => window.addEventListener(eventName, reset, { passive: true }))
    reset()

    return () => {
      window.clearTimeout(timer)
      events.forEach(eventName => window.removeEventListener(eventName, reset))
    }
  }, [isAdmin, logout, t])

  useEffect(() => {
    if (!isAdmin || !tokenExpiresAt) return
    const delay = Math.max(0, tokenExpiresAt - Date.now())
    const timer = window.setTimeout(() => {
      void logout()
      setView("kiosk")
      setNotice(t("admin.sessionExpired"))
    }, delay)
    return () => window.clearTimeout(timer)
  }, [isAdmin, tokenExpiresAt, logout, t])

  if (status === "loading" || !settings) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-5 px-6">
        <span className="relative grid h-14 w-14 place-items-center rounded-2xl border border-[rgba(214,171,91,0.28)] bg-[rgba(214,171,91,0.07)]">
          <Loader2 className="h-6 w-6 animate-spin text-[#d6ab5b]" aria-hidden />
        </span>
        <p className="eyebrow">{t("startup.loading")}</p>
      </div>
    )
  }

  if (status === "error") {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center px-6">
        <div className="panel w-full max-w-md px-8 py-10 text-center">
          <span className="mx-auto mb-5 grid h-14 w-14 place-items-center rounded-2xl border border-[rgba(200,95,78,0.35)] bg-[rgba(173,72,57,0.14)] text-[#e9a094]">
            <AlertCircle className="h-6 w-6" aria-hidden />
          </span>
          <h1 className="text-base font-semibold text-[#f4ece0]">{t("startup.failedTitle")}</h1>
          <p className="mx-auto mt-2 max-w-sm text-xs leading-relaxed text-[#9d9182]">
            {t(errorCode ?? "errors.internal_error", { defaultValue: t("errors.internal_error") })}
          </p>
          <button
            type="button"
            onClick={() => void initialize()}
            className="btn btn-primary mx-auto mt-6"
          >
            <RefreshCw className="h-4 w-4" aria-hidden />
            {t("common.retry")}
          </button>
        </div>
      </div>
    )
  }

  if (status === "setup") {
    return (
      <div className="min-h-screen">
        <FirstTimeSetupModal isOpen onComplete={() => setView("kiosk")} />
      </div>
    )
  }

  return (
    <div className="flex min-h-screen flex-col">
      <Header
        settings={settings}
        isAdmin={isAdmin}
        onOpenAdminAuth={() => (isAdmin ? setView("admin") : setAuthOpen(true))}
        onExitAdmin={() => {
          void logout()
          setView("kiosk")
        }}
        currentView={view}
        onNavigate={next => setView(next === "admin" ? "admin" : "kiosk")}
      />

      {notice && (
        <div className="mx-auto w-full max-w-[88rem] px-4 pt-4 sm:px-8 no-print">
          <FeedbackBanner tone="info" message={notice} onClose={() => setNotice(null)} />
        </div>
      )}

      <main className="flex-1">
        {view === "admin" && isAdmin ? (
          <AdminDashboard
            settings={settings}
            onBackToKiosk={() => setView("kiosk")}
            onSessionEnded={message => {
              setView("kiosk")
              setNotice(message)
            }}
          />
        ) : (
          <KioskPunchPage onOpenAdmin={() => (isAdmin ? setView("admin") : setAuthOpen(true))} />
        )}
      </main>

      <AdminPasscodeModal
        isOpen={authOpen}
        onClose={() => setAuthOpen(false)}
        onSuccess={() => {
          setAuthOpen(false)
          setView("admin")
        }}
      />
    </div>
  )
}

export default App
