"use strict"


const { contextBridge, ipcRenderer } = require("electron")

const invoke = (channel, data, token) => ipcRenderer.invoke(channel, { data, token })

contextBridge.exposeInMainWorld("api", {
  app: {
    info: () => invoke("app:info")
  },
  auth: {
    status: () => invoke("auth:status"),
    login: password => invoke("auth:login", { password }),
    logout: token => invoke("auth:logout", {}, token),
    changePassword: (payload, token) => invoke("auth:change-password", payload, token),
    emergencyReset: data => invoke("auth:emergency-reset", data)
  },
  settings: {
    get: () => invoke("settings:get"),
    update: (data, token) => invoke("settings:update", data, token),
    completeSetup: data => invoke("settings:complete-setup", data)
  },
  employees: {
    list: (data, token) => invoke("employees:list", data, token),
    publicList: () => invoke("employees:public"),
    save: (data, token) => invoke("employees:save", data, token),
    setActive: (data, token) => invoke("employees:set-active", data, token),
    remove: (data, token) => invoke("employees:delete", data, token)
  },
  attendance: {
    today: data => invoke("attendance:today", data),
    list: (data, token) => invoke("attendance:list", data, token),
    page: (data, token) => invoke("attendance:page", data, token),
    punchIn: data => invoke("attendance:punch-in", data),
    startBreak: data => invoke("attendance:start-break", data),
    endBreak: data => invoke("attendance:end-break", data),
    punchOut: data => invoke("attendance:punch-out", data),
    aggregate: (data, token) => invoke("attendance:aggregate", data, token),
    recalculate: (data, token) => invoke("attendance:recalculate", data, token),
    markAbsences: (data, token) => invoke("attendance:mark-absences", data, token),
    clearAbsences: (data, token) => invoke("attendance:clear-absences", data, token),
    correct: (data, token) => invoke("attendance:correct", data, token),
    remove: (data, token) => invoke("attendance:delete", data, token)
  },
  reports: {
    monthClose: (data, token) => invoke("reports:month-close", data, token),
    dashboardInsights: (data, token) => invoke("dashboard:insights", data, token)
  },
  leaves: {
    list: (data, token) => invoke("leaves:list", data, token),
    save: (data, token) => invoke("leaves:save", data, token),
    remove: (data, token) => invoke("leaves:delete", data, token),
    unpaidDays: (data, token) => invoke("leaves:unpaid-days", data, token)
  },
  payslips: {
    list: (data, token) => invoke("payslips:list", data, token),
    page: (data, token) => invoke("payslips:page", data, token),
    save: (data, token) => invoke("payslips:save", data, token),
    setSigned: (data, token) => invoke("payslips:set-signed", data, token),
    remove: (data, token) => invoke("payslips:delete", data, token)
  },
  audit: {
    list: (data, token) => invoke("audit:list", data, token)
  },
  backup: {
    export: token => invoke("backup:export", {}, token),
    status: token => invoke("backup:status", {}, token),
    now: token => invoke("backup:auto-now", {}, token),
    choose: token => invoke("backup:choose", {}, token),
    restore: (selectionId, token) => invoke("backup:restore", { selectionId }, token),
    restoreAuto: (fileName, token) => invoke("backup:restore-auto", { fileName }, token)
  },
  print: {
    payslip: (data, token) => invoke("print:payslip", data, token),
    payslipPdf: token => invoke("print:payslip-pdf", {}, token)
  },
  exporter: {
    attendance: (data, token) => invoke("export:attendance", data, token),
    payslips: (data, token) => invoke("export:payslips", data, token),
    cancel: (id, token) => invoke("export:cancel", { id }, token),
    onProgress: callback => {
      const listener = (_event, payload) => callback(payload)
      ipcRenderer.on("export:progress", listener)
      return () => ipcRenderer.removeListener("export:progress", listener)
    }
  },
  updater: {
    check: token => invoke("updater:check", {}, token),
    download: token => invoke("updater:download", {}, token),
    install: token => invoke("updater:install", {}, token),
    status: token => invoke("updater:status", {}, token),
    onEvent: callback => {
      const listener = (_event, payload) => callback(payload)
      ipcRenderer.on("updater:event", listener)
      return () => ipcRenderer.removeListener("updater:event", listener)
    }
  }
})
