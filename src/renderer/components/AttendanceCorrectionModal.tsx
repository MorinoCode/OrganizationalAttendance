import React, { useEffect, useState } from "react"
import { createPortal } from "react-dom"
import { useTranslation } from "react-i18next"
import { AlertTriangle, X } from "lucide-react"

import { api } from "../services/api"
import { errorKey, isApiError } from "../services/errors"
import { fromDateTimeLocalValue, toDateTimeLocalValue } from "../services/date"
import { AttendanceRecord } from "../types"
import { FeedbackBanner } from "./FeedbackBanner"

interface AttendanceCorrectionModalProps {
  record: AttendanceRecord | null
  onClose: () => void
  onSaved: () => void
  onSessionEnded?: (message: string) => void
}

export const AttendanceCorrectionModal: React.FC<AttendanceCorrectionModalProps> = ({
  record,
  onClose,
  onSaved,
  onSessionEnded
}) => {
  const { t } = useTranslation()
  const [punchIn, setPunchIn] = useState("")
  const [punchOut, setPunchOut] = useState("")
  const [breakMinutes, setBreakMinutes] = useState("0")
  const [notes, setNotes] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!record) return
    setPunchIn(toDateTimeLocalValue(record.punchInAt))
    setPunchOut(toDateTimeLocalValue(record.punchOutAt))
    setBreakMinutes(String(record.breakMinutes))
    setNotes(record.notes)
    setError(null)
  }, [record])

  useEffect(() => {
    if (!record) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose()
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [record, onClose])

  if (!record) return null

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await api.attendance.correct(record.id, {
        punchInAt: fromDateTimeLocalValue(punchIn),
        punchOutAt: fromDateTimeLocalValue(punchOut),
        breakMinutes: Number(breakMinutes) || 0,
        notes
      })
      onSaved()
      onClose()
    } catch (caught) {
      if (isApiError(caught) && caught.code === "unauthorized" && onSessionEnded) {
        onSessionEnded(t("admin.sessionExpired"))
        return
      }
      setError(t(errorKey(caught)))
    } finally {
      setBusy(false)
    }
  }

  const modal = (
    <div
      role="presentation"
      onClick={event => {
        if (event.target === event.currentTarget && !busy) onClose()
      }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(6,5,4,0.74)] p-4 backdrop-blur-sm"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="correction-title"
        className="panel w-full max-w-lg p-6"
      >
        <div className="flex items-start justify-between gap-4 border-b border-[color:var(--line)] pb-4">
          <div className="flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-xl border border-[rgba(216,149,78,0.32)] bg-[rgba(216,149,78,0.14)] text-[#e6b276]">
              <AlertTriangle className="h-5 w-5" aria-hidden />
            </span>
            <div>
              <h3 id="correction-title" className="text-base font-bold text-slate-100">
                {t("attendance.correctTitle")}
              </h3>
              <p className="text-xs text-slate-400">
                {record.employeeName} • {record.recordDate}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-slate-400 transition-colors hover:bg-[rgba(255,246,230,0.06)] hover:text-[#f4ece0] focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
            aria-label={t("common.close")}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-slate-400" htmlFor="correction-in">
                {t("attendance.punchInTime")}
              </label>
              <input
                id="correction-in"
                type="datetime-local"
                value={punchIn}
                onChange={event => setPunchIn(event.target.value)}
                className="w-full rounded-xl border border-[color:var(--line)] bg-[rgba(255,246,230,0.045)] px-3 py-2 text-sm text-[#f4ece0] focus:border-[rgba(214,171,91,0.6)] focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-slate-400" htmlFor="correction-out">
                {t("attendance.punchOutTime")}
              </label>
              <input
                id="correction-out"
                type="datetime-local"
                value={punchOut}
                onChange={event => setPunchOut(event.target.value)}
                className="w-full rounded-xl border border-[color:var(--line)] bg-[rgba(255,246,230,0.045)] px-3 py-2 text-sm text-[#f4ece0] focus:border-[rgba(214,171,91,0.6)] focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium text-slate-400" htmlFor="correction-break">
              {t("attendance.breakMinutesLabel")}
            </label>
            <input
              id="correction-break"
              type="number"
              min={0}
              max={1440}
              step={1}
              value={breakMinutes}
              onChange={event => setBreakMinutes(event.target.value)}
              dir="ltr"
              className="w-full rounded-xl border border-[color:var(--line)] bg-[rgba(255,246,230,0.045)] px-3 py-2 font-mono text-sm text-[#f4ece0] focus:border-[rgba(214,171,91,0.6)] focus:outline-none"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium text-slate-400" htmlFor="correction-notes">
              {t("attendance.notes")}
            </label>
            <textarea
              id="correction-notes"
              value={notes}
              onChange={event => setNotes(event.target.value)}
              rows={2}
              maxLength={500}
              className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 focus:border-blue-500 focus:outline-none"
            />
          </div>

          <p className="rounded-xl border border-[color:var(--line)] bg-[rgba(255,246,230,0.02)] p-3 text-[0.68rem] leading-relaxed text-[#9d9182]">
            {t("attendance.correctHint")}
          </p>

          {error && <FeedbackBanner tone="error" message={error} onClose={() => setError(null)} />}

          <div className="flex gap-2.5 border-t border-[color:var(--line)] pt-4">
            <button type="button" onClick={onClose} className="btn btn-ghost flex-1">
              {t("common.cancel")}
            </button>
            <button type="submit" disabled={busy} className="btn btn-primary flex-1">
              {t("common.save")}
            </button>
          </div>
        </form>
      </div>
    </div>
  )

  if (typeof document !== "undefined") {
    return createPortal(modal, document.body)
  }
  return modal
}
