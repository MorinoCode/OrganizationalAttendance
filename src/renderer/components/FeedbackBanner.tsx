import React from "react"
import { useTranslation } from "react-i18next"
import { AlertCircle, CheckCircle2, Info, X } from "lucide-react"

export type FeedbackTone = "success" | "error" | "info"

interface FeedbackBannerProps {
  tone: FeedbackTone
  message: string
  onClose?: () => void
}

const TONES: Record<FeedbackTone, { wrapper: string; iconWrap: string; icon: React.ReactNode }> = {
  success: {
    wrapper: "border-[rgba(70,195,159,0.35)] bg-[linear-gradient(90deg,rgba(43,166,136,0.16),rgba(43,166,136,0.04))] text-[#d8f8ec]",
    iconWrap: "border-[rgba(70,195,159,0.3)] bg-[rgba(43,166,136,0.18)] text-[#78dcbc]",
    icon: <CheckCircle2 className="h-4 w-4" aria-hidden />
  },
  error: {
    wrapper: "border-[rgba(200,95,78,0.35)] bg-[linear-gradient(90deg,rgba(173,72,57,0.18),rgba(173,72,57,0.04))] text-[#fae2dd]",
    iconWrap: "border-[rgba(200,95,78,0.3)] bg-[rgba(173,72,57,0.2)] text-[#e9a094]",
    icon: <AlertCircle className="h-4 w-4" aria-hidden />
  },
  info: {
    wrapper: "border-[rgba(214,171,91,0.3)] bg-[linear-gradient(90deg,rgba(214,171,91,0.14),rgba(214,171,91,0.03))] text-[#f0dfb0]",
    iconWrap: "border-[rgba(214,171,91,0.3)] bg-[rgba(214,171,91,0.16)] text-[#e6c98a]",
    icon: <Info className="h-4 w-4" aria-hidden />
  }
}

export const FeedbackBanner: React.FC<FeedbackBannerProps> = ({ tone, message, onClose }) => {
  const { t } = useTranslation()
  const styles = TONES[tone]
  return (
    <div role="status" className={`flex items-start gap-3 rounded-xl border px-4 py-3 ${styles.wrapper}`}>
      <span className={`mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-lg border ${styles.iconWrap}`}>
        {styles.icon}
      </span>
      <p className="flex-1 text-[0.8rem] font-medium leading-relaxed">{message}</p>
      {onClose && (
        <button
          type="button"
          onClick={onClose}
          className="shrink-0 rounded-md p-1 opacity-60 transition-opacity hover:opacity-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
          aria-label={t("common.close")}
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  )
}
