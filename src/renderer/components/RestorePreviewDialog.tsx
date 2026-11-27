import React, { useEffect, useRef } from "react"
import { createPortal } from "react-dom"
import { useTranslation } from "react-i18next"
import { AlertTriangle, CheckCircle2, DatabaseZap, Loader2, X } from "lucide-react"

import { BackupPreview, Language } from "../types"
import { LOCALES, formatDateTime } from "../services/date"
import { formatFileSize } from "../services/format"

interface RestorePreviewDialogProps {
  isOpen: boolean
  source: "file" | "auto" | null
  preview: BackupPreview | null
  sizeBytes?: number | null
  verified?: boolean | null
  busy?: boolean
  onConfirm: () => void
  onCancel: () => void
}

export const RestorePreviewDialog: React.FC<RestorePreviewDialogProps> = ({
  isOpen,
  source,
  preview,
  sizeBytes,
  verified,
  busy = false,
  onConfirm,
  onCancel
}) => {
  const { t, i18n } = useTranslation()
  const lang = (i18n.language || "ar") as Language
  const confirmRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!isOpen) return
    confirmRef.current?.focus()
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !busy) onCancel()
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [busy, isOpen, onCancel])

  if (!isOpen || !preview) return null

  const counts = [
    { label: t("settings.backupCountEmployees"), value: preview.counts.employees },
    { label: t("settings.backupCountAttendance"), value: preview.counts.attendance },
    { label: t("settings.backupCountLeaves"), value: preview.counts.leaves },
    { label: t("settings.backupCountPayslips"), value: preview.counts.payslips }
  ]

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
        aria-labelledby="restore-preview-title"
        className="panel max-h-[92vh] w-full max-w-lg overflow-y-auto"
      >
        <div
          className="h-px w-full"
          style={{
            background: "linear-gradient(90deg, rgba(214,171,91,0), rgba(214,171,91,0.85), rgba(214,171,91,0))"
          }}
        />
        <div className="p-6">
          <div className="mb-4 flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <span className="grid h-10 w-10 place-items-center rounded-xl border border-[rgba(214,171,91,0.32)] bg-[rgba(214,171,91,0.14)] text-[#e6c98a]">
                <DatabaseZap className="h-4 w-4" aria-hidden />
              </span>
              <h3 id="restore-preview-title" className="text-[0.95rem] font-semibold text-[#f4ece0]">
                {t("settings.backupPreviewTitle")}
              </h3>
            </div>
            <button
              type="button"
              onClick={onCancel}
              disabled={busy}
              className="rounded-md p-1 text-[#7b7063] transition-colors hover:bg-[rgba(255,246,230,0.06)] hover:text-[#f4ece0] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#c08f38]/50"
              aria-label={t("common.close")}
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="space-y-3 rounded-xl border border-[color:var(--line)] bg-[rgba(11,10,8,0.55)] p-4 text-xs">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-slate-500">{t("settings.backupFileName")}</span>
              <span className="break-all font-mono text-[11px] text-slate-200" dir="ltr">
                {preview.fileName}
              </span>
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="text-slate-500">{t("settings.backupPreviewCreatedAt")}</span>
              <span className="font-mono text-[11px] text-slate-200">
                {preview.exportedAt ? formatDateTime(Date.parse(preview.exportedAt), lang) : "-"}
              </span>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-slate-500">{t("settings.backupPreviewSource")}</span>
              <span className="flex items-center gap-2">
                <span className="chip">
                  {source === "auto" ? t("settings.backupPreviewSourceAuto") : t("settings.backupPreviewSourceFile")}
                </span>
                {sizeBytes ? <span className="text-[11px] text-slate-500">{formatFileSize(sizeBytes)}</span> : null}
                {verified ? (
                  <span className="flex items-center gap-1 text-[11px] text-[#78dcbc]">
                    <CheckCircle2 className="h-3 w-3" aria-hidden />
                    {t("settings.backupVerified")}
                  </span>
                ) : null}
              </span>
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="text-slate-500">{t("settings.backupPreviewSchema")}</span>
              <span className="font-mono text-[11px] text-slate-200">{preview.schemaVersion}</span>
            </div>

            <div>
              <span className="text-slate-500">{t("settings.backupPreviewContent")}</span>
              <div className="mt-2 grid grid-cols-2 gap-2">
                {counts.map(item => (
                  <div
                    key={item.label}
                    className="rounded-lg border border-[rgba(214,186,140,0.12)] bg-[rgba(255,246,230,0.03)] px-2.5 py-2"
                  >
                    <div className="text-[10px] text-slate-500">{item.label}</div>
                    <div className="font-mono text-sm font-semibold text-[#e6c98a]">{item.value}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="mt-4 space-y-2 text-[11px] leading-relaxed">
            <p className="flex items-start gap-1.5 text-[#e9a094]">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
              {t("settings.backupPreviewReplaceWarning")}
            </p>
            <p className="flex items-start gap-1.5 text-[#78dcbc]">
              <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
              {t("settings.backupPreviewSnapshotNote")}
            </p>
          </div>

          <div className="mt-6 flex gap-2.5">
            <button type="button" onClick={onCancel} disabled={busy} className="btn btn-ghost flex-1">
              {t("common.cancel")}
            </button>
            <button ref={confirmRef} type="button" onClick={onConfirm} disabled={busy} className="btn btn-primary flex-1">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
              {t("settings.backupRestoreAction")}
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
