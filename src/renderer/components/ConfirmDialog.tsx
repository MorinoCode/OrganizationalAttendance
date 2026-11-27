import React, { useEffect, useRef } from "react"
import { createPortal } from "react-dom"
import { useTranslation } from "react-i18next"
import { AlertTriangle, X } from "lucide-react"

interface ConfirmDialogProps {
  isOpen: boolean
  title: string
  message: string
  confirmLabel: string
  cancelLabel: string
  tone?: "danger" | "primary"
  busy?: boolean
  onConfirm: () => void
  onCancel: () => void
}

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  isOpen,
  title,
  message,
  confirmLabel,
  cancelLabel,
  tone = "danger",
  busy = false,
  onConfirm,
  onCancel
}) => {
  const { t } = useTranslation()
  const confirmRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!isOpen) return
    confirmRef.current?.focus()
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onCancel()
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [isOpen, onCancel])

  if (!isOpen) return null

  const dialog = (
    <div
      role="presentation"
      onClick={event => {
        if (event.target === event.currentTarget && !busy) onCancel()
      }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(6,5,4,0.72)] p-4 backdrop-blur-sm"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-title"
        className="panel w-full max-w-sm overflow-hidden"
      >
        <div
          className="h-px w-full"
          style={{
            background:
              tone === "danger"
                ? "linear-gradient(90deg, rgba(200,95,78,0), rgba(200,95,78,0.85), rgba(200,95,78,0))"
                : "linear-gradient(90deg, rgba(214,171,91,0), rgba(214,171,91,0.85), rgba(214,171,91,0))"
          }}
        />
        <div className="p-6">
          <div className="mb-4 flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <span
                className={`grid h-10 w-10 place-items-center rounded-xl border ${
                  tone === "danger"
                    ? "border-[rgba(200,95,78,0.32)] bg-[rgba(173,72,57,0.16)] text-[#e9a094]"
                    : "border-[rgba(214,171,91,0.32)] bg-[rgba(214,171,91,0.14)] text-[#e6c98a]"
                }`}
              >
                <AlertTriangle className="h-4 w-4" aria-hidden />
              </span>
              <h3 id="confirm-title" className="text-[0.95rem] font-semibold text-[#f4ece0]">
                {title}
              </h3>
            </div>
            <button
              type="button"
              onClick={onCancel}
              className="rounded-md p-1 text-[#7b7063] transition-colors hover:bg-[rgba(255,246,230,0.06)] hover:text-[#f4ece0] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#c08f38]/50"
              aria-label={t("common.close")}
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <p className="mb-6 text-[0.8rem] leading-relaxed text-[#c0b4a3]">{message}</p>

          <div className="flex gap-2.5">
            <button type="button" onClick={onCancel} className="btn btn-ghost flex-1">
              {cancelLabel}
            </button>
            <button
              ref={confirmRef}
              type="button"
              onClick={onConfirm}
              disabled={busy}
              className={`btn flex-1 ${tone === "danger" ? "btn-danger" : "btn-primary"}`}
            >
              {confirmLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  )

  if (typeof document !== "undefined") {
    return createPortal(dialog, document.body)
  }
  return dialog
}
