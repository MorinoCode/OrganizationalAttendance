import { create } from "zustand"
import { api, setSessionToken } from "../services/api"
import { errorKey } from "../services/errors"
import { AttendanceRecord, CompanySettings, PublicEmployee } from "../types"


export type AppStatus = "loading" | "setup" | "ready" | "error"

interface AppState {
  status: AppStatus
  errorCode: string | null
  settings: CompanySettings | null
  employees: PublicEmployee[]
  today: AttendanceRecord[]
  token: string | null
  tokenExpiresAt: number | null
  busyEmployeeId: string | null

  initialize: () => Promise<void>
  reloadSettings: () => Promise<void>
  reloadEmployees: () => Promise<void>
  reloadToday: () => Promise<void>
  completeSetup: (values: Record<string, unknown>) => Promise<void>
  login: (password: string) => Promise<void>
  emergencyReset: (verification: string, newPassword: string) => Promise<void>
  logout: () => Promise<void>
  punchIn: (employeeId: string) => Promise<AttendanceRecord>
  startBreak: (employeeId: string) => Promise<AttendanceRecord>
  endBreak: (employeeId: string) => Promise<AttendanceRecord>
  punchOut: (employeeId: string) => Promise<AttendanceRecord>
}

export const useAppStore = create<AppState>((set, get) => ({
  status: "loading",
  errorCode: null,
  settings: null,
  employees: [],
  today: [],
  token: null,
  tokenExpiresAt: null,
  busyEmployeeId: null,

  initialize: async () => {
    set({ status: "loading", errorCode: null })
    try {
      const [settings, employees] = await Promise.all([api.settings.get(), api.employees.publicList()])
      const configured = settings.isConfigured && settings.hasPassword
      set({
        settings,
        employees,
        today: configured ? await api.attendance.today() : [],
        status: configured ? "ready" : "setup"
      })
    } catch (error) {
      set({ status: "error", errorCode: errorKey(error) })
    }
  },

  reloadSettings: async () => {
    set({ settings: await api.settings.get() })
  },

  reloadEmployees: async () => {
    set({ employees: await api.employees.publicList() })
  },

  reloadToday: async () => {
    set({ today: await api.attendance.today() })
  },

  completeSetup: async values => {
    const result = await api.settings.completeSetup(values)
    setSessionToken(result.token)
    set({
      settings: result.settings,
      token: result.token,
      tokenExpiresAt: result.expiresAt,
      status: "ready",
      employees: await api.employees.publicList(),
      today: []
    })
  },

  login: async password => {
    const session = await api.auth.login(password)
    setSessionToken(session.token)
    set({ token: session.token, tokenExpiresAt: session.expiresAt, settings: session.settings })
  },

  emergencyReset: async (verification, newPassword) => {
    const session = await api.auth.emergencyReset(verification, newPassword)
    setSessionToken(session.token)
    set({ token: session.token, tokenExpiresAt: session.expiresAt, settings: session.settings })
  },

  logout: async () => {
    try {
      if (get().token) await api.auth.logout()
    } catch {
    }
    setSessionToken(null)
    set({ token: null, tokenExpiresAt: null })
  },

  punchIn: async employeeId => {
    set({ busyEmployeeId: employeeId })
    try {
      const record = await api.attendance.punchIn(employeeId)
      set({ today: await api.attendance.today() })
      return record
    } finally {
      set({ busyEmployeeId: null })
    }
  },

  startBreak: async employeeId => {
    set({ busyEmployeeId: employeeId })
    try {
      const record = await api.attendance.startBreak(employeeId)
      set({ today: await api.attendance.today() })
      return record
    } finally {
      set({ busyEmployeeId: null })
    }
  },

  endBreak: async employeeId => {
    set({ busyEmployeeId: employeeId })
    try {
      const record = await api.attendance.endBreak(employeeId)
      set({ today: await api.attendance.today() })
      return record
    } finally {
      set({ busyEmployeeId: null })
    }
  },

  punchOut: async employeeId => {
    set({ busyEmployeeId: employeeId })
    try {
      const record = await api.attendance.punchOut(employeeId)
      set({ today: await api.attendance.today() })
      return record
    } finally {
      set({ busyEmployeeId: null })
    }
  }
}))
