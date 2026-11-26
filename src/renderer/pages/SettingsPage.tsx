import React, { useCallback, useEffect, useMemo, useState } from "react"
import { useTranslation } from "react-i18next"
import {
  AlertCircle,
  CheckCircle2,
  Download,
  History,
  KeyRound,
  Loader2,
  RefreshCw,
  RotateCcw,
  ShieldCheck,
  Sparkles,
  Upload
} from "lucide-react"

import { api } from "../services/api"
import { errorKey, isApiError } from "../services/errors"
import { LOCALES, formatDateTime, minutesToTime, timeToMinutes } from "../services/date"
import { useAppStore } from "../store/useAppStore"
import { AppInfo, BackupEntry, BackupPreview, BackupStatus, CompanySettings, Language, UpdaterStatus } from "../types"
import { FeedbackBanner, FeedbackTone } from "../components/FeedbackBanner"
import { RestorePreviewDialog } from "../components/RestorePreviewDialog"
import { formatFileSize } from "../services/format"

interface SettingsPageProps {
  settings: CompanySettings
  onSessionEnded: (message: string) => void
}

export const SettingsPage: React.FC<SettingsPageProps> = ({ settings, onSessionEnded }) => {
  const { t, i18n } = useTranslation()
  const lang = (i18n.language || "ar") as Language
  const reloadSettings = useAppStore(state => state.reloadSettings)

  const [companyName, setCompanyName] = useState(settings.companyName)
  const [ownerName, setOwnerName] = useState(settings.ownerName)
  const [ownerRole, setOwnerRole] = useState(settings.ownerRole)
  const [currency, setCurrency] = useState(settings.currency)
  const [currencyDecimals, setCurrencyDecimals] = useState(String(settings.currencyDecimals))
  const [defaultDailyHours, setDefaultDailyHours] = useState(String(settings.defaultDailyHours))
  const [standardWorkDays, setStandardWorkDays] = useState(String(settings.standardWorkDays))
  const [overtimeMultiplier, setOvertimeMultiplier] = useState(String(settings.overtimeMultiplier))
  const [shiftStart, setShiftStart] = useState(() => minutesToTime(settings.shiftStartMinutes))
  const [shiftEnd, setShiftEnd] = useState(() => minutesToTime(settings.shiftEndMinutes))
  const [graceMinutes, setGraceMinutes] = useState(String(settings.graceMinutes))
  const [workDays, setWorkDays] = useState<number[]>(settings.workDays)

  const [currentPassword, setCurrentPassword] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")

  const [info, setInfo] = useState<AppInfo | null>(null)
  const [backupStatus, setBackupStatus] = useState<BackupStatus | null>(null)
  const [pendingRestore, setPendingRestore] = useState<
    { source: "file"; selectionId: string; preview: BackupPreview } | { source: "auto"; entry: BackupEntry } | null
  >(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [feedback, setFeedback] = useState<{ tone: FeedbackTone; message: string } | null>(null)
  const [checkingUpdate, setCheckingUpdate] = useState(false)
  const [updaterState, setUpdaterState] = useState<UpdaterStatus>({ status: "idle", version: null, percent: 0, error: null })

  const handleError = useCallback(
    (caught: unknown) => {
      if (isApiError(caught) && caught.code === "unauthorized") {
        onSessionEnded(t("admin.sessionExpired"))
        return
      }
      setFeedback({ tone: "error", message: t(errorKey(caught)) })
    },
    [onSessionEnded, t]
  )

  const loadSideData = useCallback(async () => {
    try {
      const [appInfo, backupInfo] = await Promise.all([api.app.info(), api.backup.status()])
      setInfo(appInfo)
      setBackupStatus(backupInfo)
    } catch (caught) {
      handleError(caught)
    }
  }, [handleError])

  useEffect(() => {
    void loadSideData()
  }, [loadSideData])

  useEffect(() => {
    let active = true
    const unsubscribe = api.updater.onEvent(status => {
      if (active) setUpdaterState(status)
    })
    void api.updater
      .status()
      .then(status => {
        if (active) setUpdaterState(status)
      })
      .catch(() => {
      })
    return () => {
      active = false
      unsubscribe()
    }
  }, [])

  const shiftStartValue = timeToMinutes(shiftStart)
  const shiftEndValue = timeToMinutes(shiftEnd)
  const shiftInvalid = shiftStartValue === null || shiftEndValue === null || shiftEndValue <= shiftStartValue
  const workDaysInvalid = workDays.length === 0

  const weekDayNames = useMemo(() => {
    const formatter = new Intl.DateTimeFormat(LOCALES[lang], { weekday: "short" })
    return [0, 1, 2, 3, 4, 5, 6].map(offset => formatter.format(new Date(2024, 0, 7 + offset)))
  }, [lang])

  const handleSaveSettings = async (event: React.FormEvent) => {
    event.preventDefault()
    if (shiftInvalid || workDaysInvalid) {
      setFeedback({ tone: "error", message: t(shiftInvalid ? "settings.shiftInvalid" : "settings.workDaysInvalid") })
      return
    }
    setBusy("settings")
    try {
      await api.settings.update({
        companyName,
        ownerName,
        ownerRole,
        currency,
        currencyDecimals: Number(currencyDecimals),
        defaultDailyHours: Number(defaultDailyHours),
        standardWorkDays: Number(standardWorkDays),
        overtimeMultiplier: Number(overtimeMultiplier),
        shiftStartMinutes: shiftStartValue ?? settings.shiftStartMinutes,
        shiftEndMinutes: shiftEndValue ?? settings.shiftEndMinutes,
        graceMinutes: Number(graceMinutes),
        workDays
      })
      await reloadSettings()
      setFeedback({ tone: "success", message: t("settings.savedSuccess") })
    } catch (caught) {
      handleError(caught)
    } finally {
      setBusy(null)
    }
  }

  const handleChangePassword = async (event: React.FormEvent) => {
    event.preventDefault()
    if (newPassword.length < 4) {
      setFeedback({ tone: "error", message: t("errors.password_too_short") })
      return
    }
    if (newPassword !== confirmPassword) {
      setFeedback({ tone: "error", message: t("settings.passwordMismatch") })
      return
    }
    setBusy("password")
    try {
      const session = await api.auth.changePassword(currentPassword, newPassword)
      useAppStore.setState({ token: session.token, tokenExpiresAt: session.expiresAt })
      setCurrentPassword("")
      setNewPassword("")
      setConfirmPassword("")
      setFeedback({ tone: "success", message: t("settings.passwordChanged") })
    } catch (caught) {
      handleError(caught)
    } finally {
      setBusy(null)
    }
  }

  const handleCheckUpdate = async () => {
    setCheckingUpdate(true)
    try {
      setUpdaterState(await api.updater.check())
    } catch (caught) {
      setUpdaterState({
        status: "error",
        version: null,
        error: caught instanceof Error ? caught.message : String(caught)
      })
    } finally {
      setCheckingUpdate(false)
    }
  }

  const handleDownloadUpdate = async () => {
    setUpdaterState(prev => ({ ...prev, status: "downloading", percent: 0 }))
    try {
      const result = await api.updater.download()
      if (!result.ok) {
        setUpdaterState({ status: "error", version: null, percent: 0, error: result.reason ?? result.error ?? "download_failed" })
        return
      }
    } catch (caught) {
      setUpdaterState(prev => ({ ...prev, status: "error", error: String(caught) }))
    } finally {
      try {
        setUpdaterState(await api.updater.status())
      } catch {
      }
    }
  }

  const handleInstallUpdate = async () => {
    try {
      const result = await api.updater.install()
      if (!result.ok) setFeedback({ tone: "error", message: t("settings.updater.installFailed") })
    } catch (caught) {
      handleError(caught)
    }
  }

  const handleBackup = async () => {
    setBusy("backup")
    try {
      const result = await api.backup.export()
      if (!result.canceled && result.filePath) {
        setFeedback({ tone: "success", message: t("settings.savedBackupTo", { path: result.filePath }) })
      }
    } catch (caught) {
      handleError(caught)
    } finally {
      setBusy(null)
    }
  }

  const refreshBackupStatus = useCallback(async () => {
    try {
      setBackupStatus(await api.backup.status())
    } catch (caught) {
      handleError(caught)
    }
  }, [handleError])

  const handleBackupNow = async () => {
    setBusy("backup-now")
    try {
      await api.backup.now()
      setFeedback({ tone: "success", message: t("settings.backupNowDone") })
      await refreshBackupStatus()
    } catch (caught) {
      handleError(caught)
    } finally {
      setBusy(null)
    }
  }

  const handleChooseBackupFile = async () => {
    setBusy("choose-backup")
    try {
      const result = await api.backup.choose()
      if (result.canceled || !result.selectionId || !result.preview) return
      setPendingRestore({ source: "file", selectionId: result.selectionId, preview: result.preview })
    } catch (caught) {
      handleError(caught)
    } finally {
      setBusy(null)
    }
  }

  const handleConfirmRestore = async () => {
    if (!pendingRestore) return
    setBusy("restore")
    try {
      const result =
        pendingRestore.source === "file"
          ? await api.backup.restore(pendingRestore.selectionId)
          : await api.backup.restoreAuto(pendingRestore.entry.fileName)
      setPendingRestore(null)
      if (!result.restored) {
        setFeedback({ tone: "info", message: t("settings.restoreCanceled") })
        return
      }
      setFeedback({ tone: "success", message: t("settings.restoreDone") })
      window.setTimeout(() => window.location.reload(), 1200)
    } catch (caught) {
      setPendingRestore(null)
      handleError(caught)
    } finally {
      setBusy(null)
    }
  }

  const restorePreview: BackupPreview | null = pendingRestore
    ? pendingRestore.source === "file"
      ? pendingRestore.preview
      : {
          fileName: pendingRestore.entry.fileName,
          exportedAt: pendingRestore.entry.createdAt,
          schemaVersion: pendingRestore.entry.schemaVersion ?? 0,
          formatVersion: 1,
          counts: pendingRestore.entry.counts ?? { employees: 0, attendance: 0, leaves: 0, payslips: 0 },
          attendanceFrom: null,
          attendanceTo: null
        }
    : null

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      {feedback && <FeedbackBanner tone={feedback.tone} message={feedback.message} onClose={() => setFeedback(null)} />}

      <div className="panel p-7">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[color:var(--line)] pb-4">
          <h2 className="text-lg font-semibold tracking-tight text-[#f4ece0]">{t("settings.companyInfo")}</h2>
          <span className="eyebrow">{t("admin.dashboard")}</span>
        </div>

        <form onSubmit={handleSaveSettings} className="mt-6 space-y-6">
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <div>
              <label className="mb-2 block text-xs font-medium text-slate-400" htmlFor="settings-company">
                {t("settings.companyName")}
              </label>
              <input
                id="settings-company"
                type="text"
                required
                value={companyName}
                onChange={event => setCompanyName(event.target.value)}
                className="w-full rounded-xl border border-[color:var(--line)] bg-[rgba(255,246,230,0.045)] px-4 py-2.5 text-sm text-[#f4ece0] focus:border-[rgba(214,171,91,0.6)] focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-2 block text-xs font-medium text-slate-400" htmlFor="settings-role">
                {t("settings.ownerRole")}
              </label>
              <input
                id="settings-role"
                type="text"
                value={ownerRole}
                onChange={event => setOwnerRole(event.target.value)}
                className="w-full rounded-xl border border-[color:var(--line)] bg-[rgba(255,246,230,0.045)] px-4 py-2.5 text-sm text-[#f4ece0] focus:border-[rgba(214,171,91,0.6)] focus:outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <div>
              <label className="mb-2 block text-xs font-medium text-slate-400" htmlFor="settings-owner">
                {t("settings.ownerName")}
              </label>
              <input
                id="settings-owner"
                type="text"
                required
                value={ownerName}
                onChange={event => setOwnerName(event.target.value)}
                className="w-full rounded-xl border border-[color:var(--line)] bg-[rgba(255,246,230,0.045)] px-4 py-2.5 text-sm text-[#f4ece0] focus:border-[rgba(214,171,91,0.6)] focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-2 block text-xs font-medium text-slate-400" htmlFor="settings-currency">
                {t("settings.currencyCode")}
              </label>
              <input
                id="settings-currency"
                type="text"
                required
                maxLength={12}
                dir="ltr"
                value={currency}
                onChange={event => setCurrency(event.target.value.toUpperCase())}
                className="w-full rounded-xl border border-[color:var(--line)] bg-[rgba(255,246,230,0.045)] px-4 py-2.5 font-mono text-sm text-[#f4ece0] focus:border-[rgba(214,171,91,0.6)] focus:outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            <div>
              <label className="mb-2 block text-xs font-medium text-slate-400" htmlFor="settings-decimals">
                {t("settings.currencyDecimals")}
              </label>
              <input
                id="settings-decimals"
                type="number"
                min={0}
                max={4}
                step={1}
                dir="ltr"
                value={currencyDecimals}
                onChange={event => setCurrencyDecimals(event.target.value)}
                className="w-full rounded-xl border border-[color:var(--line)] bg-[rgba(255,246,230,0.045)] px-3 py-2.5 font-mono text-sm text-[#f4ece0] focus:border-[rgba(214,171,91,0.6)] focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-2 block text-xs font-medium text-slate-400" htmlFor="settings-hours">
                {t("settings.defaultDailyHours")}
              </label>
              <input
                id="settings-hours"
                type="number"
                min={1}
                max={24}
                step={0.5}
                dir="ltr"
                value={defaultDailyHours}
                onChange={event => setDefaultDailyHours(event.target.value)}
                className="w-full rounded-xl border border-[color:var(--line)] bg-[rgba(255,246,230,0.045)] px-3 py-2.5 font-mono text-sm text-[#f4ece0] focus:border-[rgba(214,171,91,0.6)] focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-2 block text-xs font-medium text-slate-400" htmlFor="settings-days">
                {t("settings.standardWorkDays")}
              </label>
              <input
                id="settings-days"
                type="number"
                min={1}
                max={31}
                step={1}
                dir="ltr"
                value={standardWorkDays}
                onChange={event => setStandardWorkDays(event.target.value)}
                className="w-full rounded-xl border border-[color:var(--line)] bg-[rgba(255,246,230,0.045)] px-3 py-2.5 font-mono text-sm text-[#f4ece0] focus:border-[rgba(214,171,91,0.6)] focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-2 block text-xs font-medium text-slate-400" htmlFor="settings-multiplier">
                {t("settings.overtimeMultiplier")}
              </label>
              <input
                id="settings-multiplier"
                type="number"
                min={0}
                max={10}
                step={0.05}
                dir="ltr"
                value={overtimeMultiplier}
                onChange={event => setOvertimeMultiplier(event.target.value)}
                className="w-full rounded-xl border border-[color:var(--line)] bg-[rgba(255,246,230,0.045)] px-3 py-2.5 font-mono text-sm text-[#f4ece0] focus:border-[rgba(214,171,91,0.6)] focus:outline-none"
              />
            </div>
          </div>

          <div className="border-t border-[color:var(--line)] pt-6">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h3 className="text-sm font-semibold text-[#f4ece0]">{t("settings.shiftSection")}</h3>
              <span className="text-[0.68rem] text-[#8d8275]">{t("settings.graceHint")}</span>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-4 md:grid-cols-3">
              <div>
                <label className="mb-2 block text-xs font-medium text-slate-400" htmlFor="settings-shift-start">
                  {t("settings.shiftStartTime")}
                </label>
                <input
                  id="settings-shift-start"
                  type="time"
                  required
                  dir="ltr"
                  value={shiftStart}
                  onChange={event => setShiftStart(event.target.value)}
                  className="w-full rounded-xl border border-[color:var(--line)] bg-[rgba(255,246,230,0.045)] px-3 py-2.5 font-mono text-sm text-[#f4ece0] focus:border-[rgba(214,171,91,0.6)] focus:outline-none"
                />
              </div>
              <div>
                <label className="mb-2 block text-xs font-medium text-slate-400" htmlFor="settings-shift-end">
                  {t("settings.shiftEndTime")}
                </label>
                <input
                  id="settings-shift-end"
                  type="time"
                  required
                  dir="ltr"
                  value={shiftEnd}
                  onChange={event => setShiftEnd(event.target.value)}
                  className="w-full rounded-xl border border-[color:var(--line)] bg-[rgba(255,246,230,0.045)] px-3 py-2.5 font-mono text-sm text-[#f4ece0] focus:border-[rgba(214,171,91,0.6)] focus:outline-none"
                />
              </div>
              <div>
                <label className="mb-2 block text-xs font-medium text-slate-400" htmlFor="settings-grace">
                  {t("settings.graceMinutes")}
                </label>
                <input
                  id="settings-grace"
                  type="number"
                  min={0}
                  max={120}
                  step={5}
                  dir="ltr"
                  value={graceMinutes}
                  onChange={event => setGraceMinutes(event.target.value)}
                  className="w-full rounded-xl border border-[color:var(--line)] bg-[rgba(255,246,230,0.045)] px-3 py-2.5 font-mono text-sm text-[#f4ece0] focus:border-[rgba(214,171,91,0.6)] focus:outline-none"
                />
              </div>
            </div>

            <div className="mt-5">
              <span className="mb-2 block text-xs font-medium text-slate-400">{t("settings.workDays")}</span>
              <div className="flex flex-wrap gap-1.5">
                {[0, 1, 2, 3, 4, 5, 6].map(day => {
                  const active = workDays.includes(day)
                  return (
                    <button
                      key={day}
                      type="button"
                      role="switch"
                      aria-checked={active}
                      aria-label={weekDayNames[day]}
                      onClick={() =>
                        setWorkDays(current =>
                          current.includes(day)
                            ? current.filter(item => item !== day)
                            : [...current, day].sort((a, b) => a - b)
                        )
                      }
                      className={`min-w-[3.4rem] rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(214,171,91,0.45)] ${
                        active
                          ? "border-[rgba(214,171,91,0.45)] bg-[rgba(214,171,91,0.14)] text-[#f0dfb0]"
                          : "border-[color:var(--line)] bg-[rgba(255,246,230,0.03)] text-[#8d8275] hover:text-[#ded4c6]"
                      }`}
                    >
                      {weekDayNames[day]}
                    </button>
                  )
                })}
              </div>
            </div>

            {shiftInvalid && <p className="mt-3 text-xs text-[#e9a094]">{t("settings.shiftInvalid")}</p>}
            {workDaysInvalid && <p className="mt-1 text-xs text-[#e9a094]">{t("settings.workDaysInvalid")}</p>}
          </div>

          <button
            type="submit"
            disabled={busy === "settings" || shiftInvalid || workDaysInvalid}
            className="btn btn-primary w-full py-3"
          >
            {busy === "settings" ? t("common.loading") : t("settings.saveSettings")}
          </button>
        </form>
      </div>

      <div className="panel p-7">
        <div className="flex items-center gap-2 border-b border-[color:var(--line)] pb-4">
          <ShieldCheck className="h-4 w-4 text-[#46c39f]" aria-hidden />
          <h2 className="text-lg font-semibold tracking-tight text-[#f4ece0]">{t("settings.changePassword")}</h2>
        </div>

        <form onSubmit={handleChangePassword} className="mt-6 space-y-4">
          <div>
            <label className="mb-2 block text-xs font-medium text-slate-400" htmlFor="settings-current-password">
              {t("settings.currentPassword")}
            </label>
            <input
              id="settings-current-password"
              type="password"
              autoComplete="current-password"
              required
              value={currentPassword}
              onChange={event => setCurrentPassword(event.target.value)}
              className="w-full rounded-xl border border-[color:var(--line)] bg-[rgba(255,246,230,0.045)] px-4 py-2.5 text-sm text-[#f4ece0] focus:border-[rgba(214,171,91,0.6)] focus:outline-none"
            />
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <label className="mb-2 block text-xs font-medium text-slate-400" htmlFor="settings-new-password">
                {t("settings.newPassword")}
              </label>
              <input
                id="settings-new-password"
                type="password"
                autoComplete="new-password"
                required
                value={newPassword}
                onChange={event => setNewPassword(event.target.value)}
                className="w-full rounded-xl border border-[color:var(--line)] bg-[rgba(255,246,230,0.045)] px-4 py-2.5 text-sm text-[#f4ece0] focus:border-[rgba(214,171,91,0.6)] focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-2 block text-xs font-medium text-slate-400" htmlFor="settings-confirm-password">
                {t("settings.confirmPassword")}
              </label>
              <input
                id="settings-confirm-password"
                type="password"
                autoComplete="new-password"
                required
                value={confirmPassword}
                onChange={event => setConfirmPassword(event.target.value)}
                className="w-full rounded-xl border border-[color:var(--line)] bg-[rgba(255,246,230,0.045)] px-4 py-2.5 text-sm text-[#f4ece0] focus:border-[rgba(214,171,91,0.6)] focus:outline-none"
              />
            </div>
          </div>
          <p className="text-[11px] text-slate-500">{t("settings.passwordHint")}</p>

          <button
            type="submit"
            disabled={busy === "password"}
            className="btn w-full justify-center border border-[rgba(70,195,159,0.4)] bg-[rgba(43,166,136,0.2)] py-3 text-[#d8f8ec] hover:bg-[rgba(43,166,136,0.32)]"
          >
            {busy === "password" ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <KeyRound className="h-4 w-4" aria-hidden />}
            <span>{t("settings.changePassword")}</span>
          </button>
        </form>
      </div>

      <div className="panel p-7">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[color:var(--line)] pb-4">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-[#78dcbc]" aria-hidden />
            <h2 className="text-lg font-semibold tracking-tight text-[#f4ece0]">{t("settings.backupTitle")}</h2>
          </div>
          <button
            type="button"
            onClick={() => void handleBackupNow()}
            disabled={busy === "backup-now"}
            className="btn btn-ghost"
          >
            {busy === "backup-now" ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> : <RefreshCw className="h-3.5 w-3.5 text-[#78dcbc]" aria-hidden />}
            <span>{t("settings.backupNow")}</span>
          </button>
        </div>

        <p className="mt-4 text-xs leading-relaxed text-slate-400">
          {t("settings.backupAutoHint", {
            interval: backupStatus?.intervalMinutes ?? 60,
            changes: backupStatus?.changeThreshold ?? 25,
            keep: backupStatus?.keep ?? 30
          })}
        </p>

        <div className="mt-4 rounded-xl border border-[color:var(--line)] bg-[rgba(11,10,8,0.5)] p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <span className="text-[11px] font-medium uppercase tracking-wide text-slate-500">
                {t("settings.backupLastHealthy")}
              </span>
              <div className="mt-1.5 flex flex-wrap items-center gap-2">
                {backupStatus?.last ? (
                  <>
                    <span className="text-sm font-semibold text-slate-100">
                      {formatDateTime(Date.parse(backupStatus.last.createdAt), lang)}
                    </span>
                    <span className="chip">{t(`settings.backupReason_${backupStatus.last.reason}`)}</span>
                    <span className="text-[11px] text-slate-500">{formatFileSize(backupStatus.last.sizeBytes)}</span>
                    {backupStatus.last.verified ? (
                      <span className="chip flex items-center gap-1 border-[rgba(70,195,159,0.4)] text-[#78dcbc]">
                        <CheckCircle2 className="h-3 w-3" aria-hidden />
                        {t("settings.backupVerified")}
                      </span>
                    ) : (
                      <span className="text-[11px] text-[#e6b276]">{t("settings.backupUnverified")}</span>
                    )}
                  </>
                ) : (
                  <span className="text-sm text-slate-400">{t("settings.backupNever")}</span>
                )}
              </div>
            </div>
            <span className="text-[11px] text-slate-500">
              {t("settings.backupKeepCount", { count: backupStatus?.keep ?? 30 })}
            </span>
          </div>
          {backupStatus?.directory && (
            <p className="mt-3 break-all font-mono text-[10px] text-slate-600" dir="ltr">
              {backupStatus.directory}
            </p>
          )}
        </div>

        {backupStatus && backupStatus.backups.length > 0 && (
          <div className="mt-5">
            <h4 className="mb-2 text-xs font-semibold text-slate-300">{t("settings.backupListTitle")}</h4>
            <ul className="divide-y divide-[rgba(214,186,140,0.08)]">
              {backupStatus.backups.slice(0, 6).map(entry => (
                <li key={entry.fileName} className="flex flex-wrap items-center justify-between gap-2 py-2 text-xs">
                  <span className="break-all font-mono text-[11px] text-slate-300" dir="ltr">
                    {entry.fileName}
                  </span>
                  <span className="flex items-center gap-3">
                    <span className="text-[11px] text-slate-500">
                      {formatDateTime(Date.parse(entry.createdAt), lang)} · {formatFileSize(entry.sizeBytes)}
                    </span>
                    <button
                      type="button"
                      onClick={() => setPendingRestore({ source: "auto", entry })}
                      className="btn btn-ghost px-2.5 py-1 text-[11px]"
                    >
                      <RotateCcw className="h-3 w-3" aria-hidden />
                      <span>{t("settings.backupRestoreThis")}</span>
                    </button>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="flex flex-col justify-between rounded-xl border border-[color:var(--line)] bg-[rgba(11,10,8,0.5)] p-6">
            <div>
              <h4 className="mb-1 text-base font-bold text-slate-200">{t("settings.downloadBackup")}</h4>
              <p className="text-xs text-slate-400">{t("settings.backupHint")}</p>
            </div>
            <button
              type="button"
              onClick={() => void handleBackup()}
              disabled={busy === "backup"}
              className="btn btn-ghost mt-6 w-full"
            >
              {busy === "backup" ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Download className="h-4 w-4 text-emerald-400" aria-hidden />}
              <span>{t("settings.downloadBackup")}</span>
            </button>
          </div>

          <div className="flex flex-col justify-between rounded-xl border border-[color:var(--line)] bg-[rgba(11,10,8,0.5)] p-6">
            <div>
              <h4 className="mb-1 text-base font-bold text-slate-200">{t("settings.restoreBackup")}</h4>
              <p className="flex items-start gap-1.5 text-xs text-slate-400">
                <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-400" aria-hidden />
                {t("settings.backupPreviewHint")}
              </p>
            </div>
            <button
              type="button"
              onClick={() => void handleChooseBackupFile()}
              disabled={busy === "choose-backup" || busy === "restore"}
              className="btn btn-ghost mt-6 w-full"
            >
              {busy === "choose-backup" ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Upload className="h-4 w-4 text-blue-400" aria-hidden />}
              <span>{t("settings.restoreBackup")}</span>
            </button>
          </div>
        </div>
      </div>

      <div className="panel p-7">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[color:var(--line)] pb-4">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-[#d6ab5b]" aria-hidden />
            <h2 className="text-lg font-semibold tracking-tight text-[#f4ece0]">{t("settings.updater.title")}</h2>
          </div>
          <span className="rounded-md border border-[color:var(--line)] bg-[rgba(255,246,230,0.04)] px-2.5 py-1 font-mono text-xs font-semibold text-[#e6c98a]">
            v{info?.version ?? "1.1.0"}
          </span>
        </div>

        <div className="mt-5 space-y-4">
          <p className="text-xs text-slate-400">{t("settings.updater.subtitle")}</p>

          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[color:var(--line)] bg-[rgba(11,10,8,0.5)] p-4 text-xs">
            <div className="space-y-1">
              <span className="font-semibold text-slate-200">
                {updaterState.status === "checking" && t("settings.updater.checking")}
                {updaterState.status === "available" && t("settings.updater.available", { version: updaterState.version })}
                {updaterState.status === "downloading" && t("settings.updater.downloading", { percent: updaterState.percent ?? 0 })}
                {updaterState.status === "downloaded" && t("settings.updater.ready")}
                {updaterState.status === "not-available" && t("settings.updater.upToDate")}
                {updaterState.status === "development" && t("settings.updater.devMode")}
                {updaterState.status === "not-configured" && t("settings.updater.notConfigured")}
                {updaterState.status === "error" && (updaterState.error || t("settings.updater.failed"))}
                {updaterState.status === "idle" && t("settings.updater.idle")}
              </span>
              {updaterState.status === "downloading" && (
                <div className="h-2 w-48 overflow-hidden rounded-full bg-[rgba(255,246,230,0.08)]">
                  <div
                    className="h-full rounded-full bg-[#78dcbc] transition-all duration-300"
                    style={{ width: `${updaterState.percent ?? 0}%` }}
                  />
                </div>
              )}
            </div>

            <div className="flex items-center gap-2">
              {updaterState.status === "available" && (
                <button
                  type="button"
                  onClick={() => void handleDownloadUpdate()}
                  className="btn border border-[rgba(70,195,159,0.4)] bg-[rgba(43,166,136,0.2)] text-[#78dcbc] hover:bg-[rgba(43,166,136,0.3)]"
                >
                  <Download className="h-3.5 w-3.5" aria-hidden />
                  <span>{t("settings.updater.downloadButton")}</span>
                </button>
              )}
              {updaterState.status === "downloaded" && (
                <button
                  type="button"
                  onClick={() => void handleInstallUpdate()}
                  className="btn btn-primary"
                >
                  <RefreshCw className="h-3.5 w-3.5" aria-hidden />
                  <span>{t("settings.updater.installButton")}</span>
                </button>
              )}
              <button
                type="button"
                onClick={() => void handleCheckUpdate()}
                disabled={checkingUpdate || updaterState.status === "downloading" || updaterState.status === "not-configured"}
                className="btn btn-ghost"
              >
                {checkingUpdate ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                ) : (
                  <RefreshCw className="h-3.5 w-3.5 text-[#d6ab5b]" aria-hidden />
                )}
                <span>{t("settings.updater.checkButton")}</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      <RestorePreviewDialog
        isOpen={Boolean(pendingRestore)}
        source={pendingRestore?.source ?? null}
        preview={restorePreview}
        sizeBytes={pendingRestore?.source === "auto" ? pendingRestore.entry.sizeBytes : null}
        verified={pendingRestore?.source === "auto" ? pendingRestore.entry.verified : null}
        busy={busy === "restore"}
        onConfirm={() => void handleConfirmRestore()}
        onCancel={() => setPendingRestore(null)}
      />
    </div>
  )
}
