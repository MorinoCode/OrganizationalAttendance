import React, { useEffect } from "react"
import { useTranslation } from "react-i18next"
import { AlertCircle, CheckCircle2, Info, X } from "lucide-react"

export type FeedbackTone = "success" | "error" | "info"

export interface FeedbackBannerProps {
  tone: FeedbackTone
  message: string
  onClose?: () => void
  duration?: number
}

const TONES: Record<
  FeedbackTone,
  {
    wrapper: string
    iconWrap: string
    icon: React.ReactNode
    line: string
    btn: string
    titleKey: string
  }
> = {
  success: {
    wrapper:
      "border-[rgba(70,195,159,0.45)] bg-[rgba(14,24,19,0.96)] text-[#d8f8ec] shadow-[0_24px_60px_rgba(0,0,0,0.88),0_0_24px_rgba(43,166,136,0.18)]",
    iconWrap: "border-[rgba(70,195,159,0.4)] bg-[rgba(43,166,136,0.22)] text-[#78dcbc]",
    icon: <CheckCircle2 className="h-5 w-5" aria-hidden />,
    line: "bg-[linear-gradient(90deg,transparent,rgba(70,195,159,0.85),transparent)]",
    btn: "border-[rgba(70,195,159,0.35)] bg-[rgba(43,166,136,0.16)] text-[#78dcbc] hover:bg-[rgba(43,166,136,0.28)]",
    titleKey: "common.success"
  },
  error: {
    wrapper:
      "border-[rgba(200,95,78,0.45)] bg-[rgba(28,14,13,0.96)] text-[#fae2dd] shadow-[0_24px_60px_rgba(0,0,0,0.88),0_0_24px_rgba(173,72,57,0.22)]",
    iconWrap: "border-[rgba(200,95,78,0.4)] bg-[rgba(173,72,57,0.24)] text-[#e9a094]",
    icon: <AlertCircle className="h-5 w-5" aria-hidden />,
    line: "bg-[linear-gradient(90deg,transparent,rgba(200,95,78,0.85),transparent)]",
    btn: "border-[rgba(200,95,78,0.35)] bg-[rgba(173,72,57,0.18)] text-[#e9a094] hover:bg-[rgba(173,72,57,0.3)]",
    titleKey: "common.error"
  },
  info: {
    wrapper:
      "border-[rgba(214,171,91,0.45)] bg-[rgba(24,20,15,0.96)] text-[#f0dfb0] shadow-[0_24px_60px_rgba(0,0,0,0.88),0_0_24px_rgba(214,171,91,0.18)]",
    iconWrap: "border-[rgba(214,171,91,0.4)] bg-[rgba(214,171,91,0.22)] text-[#e6c98a]",
    icon: <Info className="h-5 w-5" aria-hidden />,
    line: "bg-[linear-gradient(90deg,transparent,rgba(214,171,91,0.85),transparent)]",
    btn: "border-[rgba(214,171,91,0.35)] bg-[rgba(214,171,91,0.16)] text-[#e6c98a] hover:bg-[rgba(214,171,91,0.28)]",
    titleKey: "common.notice"
  }
}

export const FeedbackBanner: React.FC<FeedbackBannerProps> = ({ tone, message, onClose, duration }) => {
  const { t } = useTranslation()
  const styles = TONES[tone]

  useEffect(() => {
    if (!onClose) return
    const ms = duration ?? (tone === "error" ? 8000 : 5000)
    if (ms <= 0) return
    const timer = setTimeout(onClose, ms)
    return () => clearTimeout(timer)
  }, [onClose, tone, message, duration])

  useEffect(() => {
    if (!onClose) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose()
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [onClose])

  return (
    <div
      role="status"
      className="fixed top-6 left-1/2 -translate-x-1/2 z-[9999] w-[94vw] max-w-xl pointer-events-auto transition-all duration-300 animate-in fade-in slide-in-from-top-4"
    >
      <div className={`relative overflow-hidden rounded-2xl border backdrop-blur-xl p-4 sm:p-4.5 ${styles.wrapper}`}>
        <div className={`absolute top-0 inset-x-0 h-[2px] ${styles.line}`} />
        <div className="flex items-start gap-3.5">
          <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl border ${styles.iconWrap}`}>
            {styles.icon}
          </span>
          <div className="flex-1 min-w-0 pt-0.5">
            <h4 className="text-xs font-bold uppercase tracking-wider text-[#f4ece0]">
              {t(styles.titleKey)}
            </h4>
            <p className="mt-1 text-xs sm:text-sm font-medium leading-relaxed break-words opacity-95">
              {message}
            </p>
          </div>
          {onClose && (
            <div className="flex items-center gap-1.5 shrink-0 self-center">
              <button
                type="button"
                onClick={onClose}
                className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition-all ${styles.btn}`}
              >
                {t("common.close")}
              </button>
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg p-1.5 opacity-60 transition-opacity hover:opacity-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
                aria-label={t("common.close")}
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export const FeedbackPopup = FeedbackBanner
