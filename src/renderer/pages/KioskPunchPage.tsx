import React, { useEffect, useMemo, useState } from "react"
import { useTranslation } from "react-i18next"
import {
  CheckCircle2,
  Clock,
  Coffee,
  LogIn,
  Play,
  PlusCircle,
  Search,
  Timer,
  UserCheck
} from "lucide-react"

import { FeedbackBanner, FeedbackTone } from "../components/FeedbackBanner"
import { useAppStore } from "../store/useAppStore"
import { AttendanceRecord, Language, PublicEmployee } from "../types"
import { errorKey } from "../services/errors"
import { formatDuration, formatTime } from "../services/date"

interface KioskPunchPageProps {
  onOpenAdmin: () => void
}

function liveMinutes(record: AttendanceRecord, now: number): number {
  if (!record.punchInAt) return 0
  const end = record.punchOutAt ?? now
  const gross = Math.max(0, Math.floor((end - record.punchInAt) / 60000))
  return Math.max(0, gross - record.breakMinutes)
}

export const KioskPunchPage: React.FC<KioskPunchPageProps> = ({ onOpenAdmin }) => {
  const { t, i18n } = useTranslation()
  const lang = (i18n.language || "ar") as Language

  const employees = useAppStore(state => state.employees)
  const todayRecords = useAppStore(state => state.today)
  const settings = useAppStore(state => state.settings)
  const busyEmployeeId = useAppStore(state => state.busyEmployeeId)
  const punchIn = useAppStore(state => state.punchIn)
  const startBreak = useAppStore(state => state.startBreak)
  const endBreak = useAppStore(state => state.endBreak)
  const punchOut = useAppStore(state => state.punchOut)
  const reloadEmployees = useAppStore(state => state.reloadEmployees)
  const reloadToday = useAppStore(state => state.reloadToday)

  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [query, setQuery] = useState("")
  const [feedback, setFeedback] = useState<{ tone: FeedbackTone; message: string } | null>(null)
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 15000)
    return () => window.clearInterval(timer)
  }, [])

  useEffect(() => {
    void reloadEmployees()
    void reloadToday()
    const timer = window.setInterval(() => {
      void reloadEmployees()
      void reloadToday()
    }, 60_000)
    return () => window.clearInterval(timer)
  }, [reloadEmployees, reloadToday])

  useEffect(() => {
    if (!feedback) return
    const timer = window.setTimeout(() => setFeedback(null), 6000)
    return () => window.clearTimeout(timer)
  }, [feedback])

  const filtered: PublicEmployee[] = useMemo(() => {
    const term = query.trim().toLowerCase()
    if (!term) return employees
    return employees.filter(employee =>
      [employee.fullName, employee.employeeCode, employee.department]
        .join(" ")
        .toLowerCase()
        .includes(term)
    )
  }, [employees, query])

  const selected = employees.find(employee => employee.id === selectedId) ?? null
  const selectedRecords = useMemo(
    () => (selected ? todayRecords.filter(item => item.employeeId === selected.id) : []),
    [selected, todayRecords]
  )
  const activeRecord = selectedRecords.find(item => !item.punchOutAt)
  const latestRecord = selectedRecords[0]
  const record = activeRecord || latestRecord
  const totalNetToday = useMemo(
    () => selectedRecords.reduce((sum, r) => sum + r.netMinutes, 0),
    [selectedRecords]
  )
  const totalBreakToday = useMemo(
    () => selectedRecords.reduce((sum, r) => sum + r.breakMinutes, 0),
    [selectedRecords]
  )

  const hoursUnit = t("common.hours")
  const minutesUnit = t("common.minutes")

  const runAction = async (action: () => Promise<void>) => {
    try {
      await action()
    } catch (caught) {
      setFeedback({ tone: "error", message: t(errorKey(caught)) })
    }
  }

  const handlePunchIn = () =>
    selected &&
    runAction(async () => {
      const created = await punchIn(selected.id)
      setFeedback({
        tone: created.lateMinutes > 0 ? "info" : "success",
        message:
          created.lateMinutes > 0
            ? t("kiosk.lateSuccess", {
              time: formatTime(created.punchInAt, lang),
              minutes: created.lateMinutes
            })
            : t("kiosk.punchInSuccess", { time: formatTime(created.punchInAt, lang) })
      })
    })

  const handleToggleBreak = () =>
    selected &&
    runAction(async () => {
      if (record?.status === "on_break") {
        const updated = await endBreak(selected.id)
        const last = updated.breaks[updated.breaks.length - 1]
        setFeedback({
          tone: "info",
          message: t("kiosk.breakEndSuccess", { time: formatTime(last?.breakEndAt ?? Date.now(), lang) })
        })
      } else {
        const updated = await startBreak(selected.id)
        const last = updated.breaks[updated.breaks.length - 1]
        setFeedback({
          tone: "info",
          message: t("kiosk.breakStartSuccess", { time: formatTime(last?.breakStartAt ?? Date.now(), lang) })
        })
      }
    })

  const handlePunchOut = () =>
    selected &&
    runAction(async () => {
      const updated = await punchOut(selected.id)
      setFeedback({
        tone: "success",
        message: t("kiosk.punchOutSuccess", { hours: formatDuration(updated.netMinutes, t("common.hours"), t("common.minutes")) })
      })
    })

  const statusChip = (item?: AttendanceRecord) => {
    if (!item) {
      return <span className="chip bg-[rgba(255,246,230,0.02)] text-[#8d8275]">{t("kiosk.status.notStarted")}</span>
    }
    if (item.status === "on_break") {
      return (
        <span className="chip border-[rgba(216,149,78,0.4)] bg-[rgba(216,149,78,0.12)] text-[#e6b276]">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#d8954e]" />
          {t("kiosk.status.onBreak")}
        </span>
      )
    }
    if (item.status === "completed") {
      return (
        <span className="chip border-[rgba(214,171,91,0.35)] bg-[rgba(214,171,91,0.1)] text-[#e6c98a]">
          <CheckCircle2 className="h-3 w-3" aria-hidden />
          {t("kiosk.status.completed")}
        </span>
      )
    }
    return (
      <span className="chip border-[rgba(70,195,159,0.35)] bg-[rgba(70,195,159,0.12)] text-[#78dcbc]">
        <span className="h-1.5 w-1.5 rounded-full bg-[#46c39f]" />
        {t("kiosk.status.working")}
      </span>
    )
  }

  if (employees.length === 0) {
    return (
      <div className="mx-auto max-w-[88rem] px-4 py-20 sm:px-8">
        <div className="panel mx-auto flex max-w-md flex-col items-center p-10 text-center">
          <span className="mb-5 grid h-16 w-16 place-items-center rounded-2xl border border-[rgba(214,171,91,0.28)] bg-[rgba(214,171,91,0.08)] text-[#d6ab5b]">
            <UserCheck className="h-7 w-7" aria-hidden />
          </span>
          <h2 className="text-base font-semibold text-[#f4ece0]">{t("employees.noEmployees")}</h2>
          <p className="mb-6 mt-1.5 text-xs leading-relaxed text-[#9d9182]">{t("kiosk.noEmployeesYet")}</p>
          <button type="button" onClick={onOpenAdmin} className="btn btn-primary px-5">
            <PlusCircle className="h-4 w-4" aria-hidden />
            <span>{t("kiosk.addEmployees")}</span>
          </button>
        </div>
      </div>
    )
  }

  const isBusy = busyEmployeeId !== null
  const hasShift = Boolean(activeRecord)

  return (
    <div className="mx-auto max-w-[88rem] px-4 py-7 sm:px-8">
      {feedback && (
        <FeedbackBanner tone={feedback.tone} message={feedback.message} onClose={() => setFeedback(null)} />
      )}

      <div className="grid grid-cols-1 items-stretch gap-6 lg:grid-cols-[minmax(0,23rem)_minmax(0,1fr)]">
        {/* ---- roster ---------------------------------------------------- */}
        <section className="panel flex h-[calc(100vh-11rem)] min-h-[34rem] flex-col overflow-hidden">
          <div className="border-b border-[color:var(--line)] px-5 pb-4 pt-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="eyebrow">{t("kiosk.title")}</p>
                <h2 className="mt-1 text-lg font-semibold tracking-tight text-[#f4ece0]">
                  {t("kiosk.selectEmployee")}
                </h2>
              </div>
              <span className="rounded-lg border border-[color:var(--line)] bg-[rgba(255,246,230,0.03)] px-2 py-1 font-mono text-[0.7rem] font-semibold text-[#d6ab5b]">
                {employees.length}
              </span>
            </div>

            <div className="relative mt-3.5">
              <Search className="pointer-events-none absolute start-3 top-2.5 h-4 w-4 text-[#7b7063]" aria-hidden />
              <input
                type="search"
                value={query}
                onChange={event => setQuery(event.target.value)}
                placeholder={t("kiosk.searchEmployee")}
                aria-label={t("kiosk.searchEmployee")}
                className="w-full rounded-xl border border-[color:var(--line)] bg-[rgba(11,10,8,0.65)] py-2 pe-3 ps-9 text-[0.8rem] text-[#f4ece0] placeholder-[#7b7063] focus:border-[rgba(214,171,91,0.6)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(214,171,91,0.2)]"
              />
            </div>
          </div>

          <div className="custom-scrollbar flex-1 space-y-1.5 overflow-y-auto p-2.5">
            {filtered.length === 0 ? (
              <p className="py-16 text-center text-xs text-[#7b7063]">{t("common.noData")}</p>
            ) : (
              filtered.map(employee => {
                const employeeRecords = todayRecords.filter(item => item.employeeId === employee.id)
                const active = employeeRecords.find(item => !item.punchOutAt)
                const employeeRecord = active || employeeRecords[0]
                const isSelected = selected?.id === employee.id
                return (
                  <button
                    key={employee.id}
                    type="button"
                    onClick={() => setSelectedId(employee.id)}
                    aria-pressed={isSelected}
                    className={`group flex w-full items-center justify-between gap-2 rounded-xl border px-3 py-2.5 text-start transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(214,171,91,0.45)] ${
                      isSelected
                        ? "border-[rgba(214,171,91,0.45)] bg-[linear-gradient(90deg,rgba(214,171,91,0.14),rgba(214,171,91,0.02))] shadow-[inset_2px_0_0_0_#d6ab5b]"
                        : "border-transparent bg-transparent hover:border-[color:var(--line)] hover:bg-[rgba(255,246,230,0.03)]"
                    }`}
                  >
                    <span className="flex min-w-0 items-center gap-3">
                      <span
                        className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg border text-[0.8rem] font-bold ${
                          isSelected
                            ? "border-[rgba(214,171,91,0.5)] bg-[rgba(214,171,91,0.16)] text-[#f0dfb0]"
                            : "border-[color:var(--line)] bg-[rgba(255,246,230,0.03)] text-[#c0b4a3]"
                        }`}
                        aria-hidden
                      >
                        {employee.fullName.slice(0, 1)}
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate text-[0.82rem] font-semibold text-[#f0e9df]">
                          {employee.fullName}
                        </span>
                        <span className="mt-0.5 flex items-center gap-1.5 text-[0.66rem] font-medium text-[#8d8275]">
                          <span className="font-mono text-[#c08f38]">{employee.employeeCode}</span>
                          <span className="h-0.5 w-0.5 rounded-full bg-[#5c5349]" aria-hidden />
                          <span className="truncate">{employee.department || "-"}</span>
                        </span>
                      </span>
                    </span>
                    {statusChip(employeeRecord)}
                  </button>
                )
              })
            )}
          </div>

          <p className="border-t border-[color:var(--line)] px-5 py-2.5 text-[0.63rem] text-[#6b6054]">
            {settings?.companyName} · {settings?.currency}
          </p>
        </section>

        {/* ---- shift console --------------------------------------------- */}
        <section className="panel flex min-h-[34rem] flex-col overflow-hidden">
          {selected ? (
            <>
              <div className="flex flex-wrap items-start justify-between gap-4 border-b border-[color:var(--line)] px-7 py-6">
                <div className="flex items-center gap-4">
                  <span
                    className="grid h-14 w-14 place-items-center rounded-2xl border border-[rgba(214,171,91,0.4)] bg-[linear-gradient(150deg,rgba(214,171,91,0.28),rgba(214,171,91,0.04))] text-xl font-bold text-[#f8efd8] shadow-[inset_0_1px_0_rgba(255,246,230,0.25)]"
                    aria-hidden
                  >
                    {selected.fullName.slice(0, 1)}
                  </span>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2.5">
                      <h2 className="truncate text-[1.4rem] font-semibold leading-tight tracking-tight text-[#fbf7f0]">
                        {selected.fullName}
                      </h2>
                      {statusChip(record)}
                      {selectedRecords.length > 1 && (
                        <span className="chip border-[rgba(214,171,91,0.35)] bg-[rgba(214,171,91,0.1)] text-[#e6c98a]">
                          {selectedRecords.length} {t("kiosk.shiftsCount")}
                        </span>
                      )}
                    </div>
                    <p className="mt-1.5 flex items-center gap-2 text-[0.72rem] font-medium text-[#9d9182]">
                      <span className="rounded-md border border-[color:var(--line)] bg-[rgba(255,246,230,0.04)] px-2 py-0.5 font-mono text-[#e6c98a]">
                        {selected.employeeCode}
                      </span>
                      <span className="h-0.5 w-0.5 rounded-full bg-[#5c5349]" aria-hidden />
                      <span className="text-[#c0b4a3]">{selected.department || "-"}</span>
                    </p>
                  </div>
                </div>
                <p className="eyebrow hidden sm:flex">
                  <Timer className="h-3.5 w-3.5" aria-hidden />
                  {record && !record.punchOutAt ? t("kiosk.liveTimer") : t("attendance.netHours")}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-px bg-[rgba(214,186,140,0.1)] sm:grid-cols-4">
                {[
                  {
                    label: t("attendance.inTime"),
                    value: formatTime(record?.punchInAt, lang),
                    icon: <Clock className="h-3.5 w-3.5" aria-hidden />,
                    tone: "text-[#78dcbc]"
                  },
                  {
                    label: t("attendance.breakMinutes"),
                    value: String(totalBreakToday),
                    icon: <Coffee className="h-3.5 w-3.5" aria-hidden />,
                    tone: "text-[#e6b276]"
                  },
                  {
                    label: t("attendance.outTime"),
                    value: formatTime(record?.punchOutAt, lang),
                    icon: <CheckCircle2 className="h-3.5 w-3.5" aria-hidden />,
                    tone: "text-[#e6c98a]"
                  },
                  {
                    label: activeRecord ? t("kiosk.liveTimer") : t("attendance.netHours"),
                    value: selectedRecords.length > 0
                      ? formatDuration(
                          activeRecord
                            ? (totalNetToday + liveMinutes(activeRecord, now))
                            : totalNetToday,
                          hoursUnit,
                          minutesUnit
                        )
                      : "-",
                    icon: <Timer className="h-3.5 w-3.5" aria-hidden />,
                    tone: "text-[#c2a3d8]"
                  }
                ].map(metric => (
                  <div key={metric.label} className="bg-[rgba(20,17,13,0.92)] px-5 py-4">
                    <span className="flex items-center gap-1.5 text-[0.62rem] font-semibold uppercase tracking-[0.12em] text-[#8d8275]">
                      {metric.icon}
                      {metric.label}
                    </span>
                    <span className={`mt-1.5 block font-mono text-[1.15rem] font-semibold ${metric.tone}`}>
                      {metric.value}
                    </span>
                  </div>
                ))}
              </div>

              <div className="flex flex-1 flex-col justify-end gap-4 px-7 py-7">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                  <button
                    type="button"
                    onClick={handlePunchIn}
                    disabled={hasShift || isBusy}
                    className={`group relative flex h-40 flex-col items-center justify-center gap-3 overflow-hidden rounded-2xl border p-5 text-center transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-[#46c39f]/50 ${
                      hasShift || isBusy
                        ? "cursor-not-allowed border-[color:var(--line)] bg-[rgba(255,246,230,0.015)] text-[#5c5349]"
                        : "border-[rgba(70,195,159,0.4)] bg-[linear-gradient(160deg,rgba(43,166,136,0.2),rgba(43,166,136,0.04))] text-[#d8f8ec] hover:-translate-y-1 hover:border-[rgba(70,195,159,0.75)] hover:shadow-[0_18px_36px_-26px_rgba(43,166,136,0.9)] active:translate-y-0"
                    }`}
                  >
                    <span className="grid h-16 w-16 place-items-center rounded-2xl border border-[rgba(255,246,230,0.16)] bg-[rgba(11,10,8,0.45)] shadow-inner transition-transform group-hover:scale-110">
                      <Play className="h-8 w-8 ms-1 fill-current" aria-hidden />
                    </span>
                    <span className="text-[1.05rem] font-bold tracking-tight">{t("kiosk.startShift")}</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleToggleBreak}
                    disabled={!hasShift || isBusy}
                    className={`group relative flex h-40 flex-col items-center justify-center gap-3 overflow-hidden rounded-2xl border p-5 text-center transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-[#d8954e]/50 ${
                      !hasShift || isBusy
                        ? "cursor-not-allowed border-[color:var(--line)] bg-[rgba(255,246,230,0.015)] text-[#5c5349]"
                        : record?.status === "on_break"
                          ? "border-[rgba(216,149,78,0.75)] bg-[linear-gradient(160deg,rgba(216,149,78,0.34),rgba(216,149,78,0.08))] text-[#f9ead3] hover:-translate-y-1 active:translate-y-0"
                          : "border-[rgba(216,149,78,0.4)] bg-[linear-gradient(160deg,rgba(192,120,52,0.2),rgba(192,120,52,0.04))] text-[#f1d1a5] hover:-translate-y-1 hover:border-[rgba(216,149,78,0.75)] hover:shadow-[0_18px_36px_-26px_rgba(192,120,52,0.9)] active:translate-y-0"
                    }`}
                  >
                    <span className="grid h-16 w-16 place-items-center rounded-2xl border border-[rgba(255,246,230,0.16)] bg-[rgba(11,10,8,0.45)] shadow-inner transition-transform group-hover:scale-110">
                      <Coffee className="h-8 w-8" aria-hidden />
                    </span>
                    <span className="text-[1.05rem] font-bold tracking-tight">
                      {record?.status === "on_break" ? t("kiosk.endBreak") : t("kiosk.takeBreak")}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={handlePunchOut}
                    disabled={!hasShift || isBusy}
                    className={`group relative flex h-40 flex-col items-center justify-center gap-3 overflow-hidden rounded-2xl border p-5 text-center transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-[#c85f4e]/50 ${
                      !hasShift || isBusy
                        ? "cursor-not-allowed border-[color:var(--line)] bg-[rgba(255,246,230,0.015)] text-[#5c5349]"
                        : "border-[rgba(200,95,78,0.4)] bg-[linear-gradient(160deg,rgba(173,72,57,0.22),rgba(173,72,57,0.04))] text-[#f4c6bd] hover:-translate-y-1 hover:border-[rgba(200,95,78,0.75)] hover:shadow-[0_18px_36px_-26px_rgba(173,72,57,0.9)] active:translate-y-0"
                    }`}
                  >
                    <span className="grid h-16 w-16 place-items-center rounded-2xl border border-[rgba(255,246,230,0.16)] bg-[rgba(11,10,8,0.45)] shadow-inner transition-transform group-hover:scale-110">
                      <CheckCircle2 className="h-8 w-8" aria-hidden />
                    </span>
                    <span className="text-[1.05rem] font-bold tracking-tight">{t("kiosk.finishShift")}</span>
                  </button>
                </div>
              </div>
            </>
          ) : (
            <div className="relative flex flex-1 flex-col items-center justify-center overflow-hidden px-8 py-16 text-center">
              <span
                className="pointer-events-none absolute -top-24 h-72 w-72 rounded-full bg-[radial-gradient(circle,rgba(201,162,75,0.16),transparent_65%)]"
                aria-hidden
              />
              <span className="relative mb-6 grid h-20 w-20 place-items-center rounded-3xl border border-[rgba(214,171,91,0.3)] bg-[linear-gradient(160deg,rgba(214,171,91,0.16),rgba(214,171,91,0.02))] text-[#d6ab5b] shadow-[inset_0_1px_0_rgba(255,246,230,0.18)]">
                <UserCheck className="h-8 w-8" aria-hidden />
              </span>
              <h3 className="relative text-xl font-semibold tracking-tight text-[#fbf7f0]">
                {t("kiosk.selectEmployee")}
              </h3>
              <p className="relative mb-7 mt-2 max-w-sm text-[0.78rem] leading-relaxed text-[#9d9182]">
                {t("kiosk.selectPrompt")}
              </p>
              <button type="button" onClick={onOpenAdmin} className="btn btn-ghost relative">
                <LogIn className="h-4 w-4 text-[#46c39f]" aria-hidden />
                <span>{t("admin.login")}</span>
              </button>
              <span className="relative mt-10 flex items-center gap-2 text-[0.62rem] font-semibold uppercase tracking-[0.16em] text-[#5c5349]">
                <span className="h-px w-6 bg-[rgba(214,171,91,0.35)]" aria-hidden />
                {settings?.companyName}
                <span className="h-px w-6 bg-[rgba(214,171,91,0.35)]" aria-hidden />
              </span>
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
