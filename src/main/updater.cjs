"use strict"

const { app } = require("electron")

let autoUpdater = null

function getAutoUpdater() {
  if (!autoUpdater) {
    try {
      const updaterModule = require("electron-updater")
      autoUpdater = updaterModule.autoUpdater
      autoUpdater.autoDownload = false
      autoUpdater.autoInstallOnAppQuit = true
    } catch {
      autoUpdater = null
    }
  }
  return autoUpdater
}

let updaterState = {
  status: "idle",
  version: null,
  percent: 0,
  error: null
}

function notifyRenderer(getMainWindow) {
  try {
    const win = getMainWindow ? getMainWindow() : null
    if (win && !win.isDestroyed()) {
      win.webContents.send("updater:event", getStatus())
    }
  } catch {
  }
}

function initUpdater(getMainWindow) {
  if (!app.isPackaged) return
  const updater = getAutoUpdater()
  if (!updater) return

  updater.on("checking-for-update", () => {
    updaterState = { status: "checking", version: null, percent: 0, error: null }
    notifyRenderer(getMainWindow)
  })

  updater.on("update-available", info => {
    updaterState = { status: "available", version: info.version, percent: 0, error: null }
    notifyRenderer(getMainWindow)
  })

  updater.on("update-not-available", () => {
    updaterState = { status: "not-available", version: null, percent: 0, error: null }
    notifyRenderer(getMainWindow)
  })

  updater.on("download-progress", progress => {
    updaterState = {
      status: "downloading",
      version: updaterState.version,
      percent: Math.round(progress.percent || 0),
      error: null
    }
    notifyRenderer(getMainWindow)
  })

  updater.on("update-downloaded", info => {
    updaterState = {
      status: "downloaded",
      version: info.version,
      percent: 100,
      error: null
    }
    notifyRenderer(getMainWindow)
  })

  updater.on("error", err => {
    updaterState = {
      status: "error",
      version: null,
      percent: 0,
      error: err ? err.message : "Update failed"
    }
    notifyRenderer(getMainWindow)
  })
}

async function checkForUpdates() {
  if (!app.isPackaged) {
    return {
      status: "development",
      currentVersion: app.getVersion(),
      version: null,
      percent: 0,
      error: null
    }
  }
  const updater = getAutoUpdater()
  if (!updater) {
    return {
      status: "error",
      currentVersion: app.getVersion(),
      version: null,
      percent: 0,
      error: "updater_unavailable"
    }
  }
  try {
    const result = await updater.checkForUpdates()
    return {
      status: updaterState.status,
      version: result && result.updateInfo ? result.updateInfo.version : null,
      currentVersion: app.getVersion(),
      percent: 0,
      error: null
    }
  } catch (err) {
    updaterState = {
      status: "error",
      version: null,
      percent: 0,
      error: err ? err.message : "check_failed"
    }
    return {
      status: "error",
      error: err ? err.message : "check_failed",
      currentVersion: app.getVersion(),
      version: null,
      percent: 0
    }
  }
}

async function downloadUpdate() {
  if (!app.isPackaged) return { ok: false, reason: "development" }
  const updater = getAutoUpdater()
  if (!updater) return { ok: false, reason: "unavailable" }
  try {
    await updater.downloadUpdate()
    return { ok: true }
  } catch (err) {
    return { ok: false, error: err ? err.message : "download_failed" }
  }
}

function installUpdate() {
  if (!app.isPackaged) return { ok: false, reason: "development" }
  const updater = getAutoUpdater()
  if (!updater) return { ok: false, reason: "unavailable" }
  updater.quitAndInstall()
  return { ok: true }
}

function getStatus() {
  return {
    ...updaterState,
    currentVersion: app.getVersion(),
    isPackaged: app.isPackaged
  }
}

module.exports = {
  initUpdater,
  checkForUpdates,
  downloadUpdate,
  installUpdate,
  getStatus
}
