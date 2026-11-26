"use strict"

const DEFAULT_INITIAL_DELAY_MS = 20 * 1000
const DEFAULT_CHECK_INTERVAL_MS = 6 * 60 * 60 * 1000
const DEFAULT_GITHUB_PUBLISH = Object.freeze({
  provider: "github",
  owner: "MorinoCode",
  repo: "OrganizationalAttendance"
})

function normalizeFeedUrl(value) {
  const raw = typeof value === "string" ? value.trim() : ""
  if (!raw) return null
  try {
    const url = new URL(raw)
    const isLocal = url.hostname === "localhost" || url.hostname === "127.0.0.1"
    if (url.protocol !== "https:" && !(isLocal && url.protocol === "http:")) return null
    return url.toString().endsWith("/") ? url.toString() : `${url.toString()}/`
  } catch {
    return null
  }
}

function createUpdaterService({
  app,
  loadAutoUpdater,
  getMainWindow = () => null,
  feedUrl = null,
  publishConfig = null,
  initialDelayMs = DEFAULT_INITIAL_DELAY_MS,
  checkIntervalMs = DEFAULT_CHECK_INTERVAL_MS,
  logger = console
}) {
  const hasConfig = Boolean(feedUrl || publishConfig)
  let updater = null
  let listenersBound = false
  let initialized = false
  let checkInFlight = false
  let checkTimer = null
  let intervalTimer = null
  let state = { status: "idle", version: null, percent: 0, error: null, lastCheckedAt: null }

  function snapshot() {
    return {
      ...state,
      currentVersion: app.getVersion(),
      isPackaged: Boolean(app.isPackaged),
      feedConfigured: hasConfig
    }
  }

  function notifyRenderer() {
    try {
      const win = getMainWindow()
      if (win && !win.isDestroyed()) win.webContents.send("updater:event", snapshot())
    } catch {
    }
  }

  function setState(patch) {
    state = { ...state, ...patch }
    notifyRenderer()
    return snapshot()
  }

  function resolveUpdater() {
    if (updater) return updater
    let module = null
    try {
      module = loadAutoUpdater()
    } catch (error) {
      logger.error("[updater] electron-updater is not available:", error?.message ?? error)
      return null
    }
    updater = module && module.autoUpdater ? module.autoUpdater : null
    if (!updater) return null
    updater.autoDownload = false
    updater.autoInstallOnAppQuit = true
    updater.allowPrerelease = false
    updater.logger = logger
    if (feedUrl && typeof updater.setFeedURL === "function") {
      updater.setFeedURL({ provider: "generic", url: feedUrl })
    } else if (publishConfig && typeof updater.setFeedURL === "function") {
      updater.setFeedURL(publishConfig)
    }
    bindEvents(updater)
    return updater
  }

  function bindEvents(instance) {
    if (listenersBound) return
    listenersBound = true

    instance.on("checking-for-update", () => {
      setState({ status: "checking", version: null, percent: 0, error: null })
    })
    instance.on("update-available", info => {
      logger.info(`[updater] update available: ${info?.version ?? "unknown"}`)
      setState({ status: "available", version: info?.version ?? null, percent: 0, error: null })
    })
    instance.on("update-not-available", () => {
      setState({ status: "not-available", version: null, percent: 0, error: null, lastCheckedAt: new Date().toISOString() })
    })
    instance.on("download-progress", progress => {
      setState({ status: "downloading", percent: Math.round(Number(progress?.percent) || 0) })
    })
    instance.on("update-downloaded", info => {
      setState({ status: "downloaded", version: info?.version ?? state.version, percent: 100, error: null })
    })
    instance.on("error", error => {
      logger.error("[updater] update error:", error?.message ?? error)
      setState({ status: "error", percent: 0, error: error?.message ? String(error.message) : "update_failed" })
    })
  }

  async function runCheck() {
    if (checkInFlight) return snapshot()
    const instance = resolveUpdater()
    if (!instance) return setState({ status: "error", error: "updater_unavailable" })

    checkInFlight = true
    setState({ status: "checking", version: null, percent: 0, error: null })
    try {
      const result = await instance.checkForUpdates()
      const version = result && result.updateInfo ? result.updateInfo.version : state.version
      setState({ version: version ?? state.version, lastCheckedAt: new Date().toISOString() })
      return snapshot()
    } catch (error) {
      logger.error("[updater] check failed:", error?.message ?? error)
      return setState({ status: "error", percent: 0, error: error?.message ? String(error.message) : "check_failed" })
    } finally {
      checkInFlight = false
    }
  }

  async function checkForUpdates() {
    if (!app.isPackaged) {
      return { status: "development", currentVersion: app.getVersion(), version: null, percent: 0, error: null, feedConfigured: hasConfig }
    }
    if (!hasConfig) {
      return { status: "not-configured", currentVersion: app.getVersion(), version: null, percent: 0, error: null, feedConfigured: false }
    }
    return runCheck()
  }

  function initUpdater() {
    if (initialized) return
    if (!app.isPackaged) {
      logger.info("[updater] automatic updates are disabled in development")
      return
    }
    if (!hasConfig) {
      logger.warn("[updater] update feed is not configured; automatic update checks are disabled")
      state = { ...state, status: "not-configured" }
      return
    }
    initialized = true
    if (!resolveUpdater()) return
    logger.info(`[updater] automatic checks enabled against ${feedUrl || publishConfig?.provider}`)

    checkTimer = setTimeout(() => {
      void checkForUpdates()
      intervalTimer = setInterval(() => {
        void checkForUpdates()
      }, checkIntervalMs)
      if (typeof intervalTimer.unref === "function") intervalTimer.unref()
    }, initialDelayMs)
    if (typeof checkTimer.unref === "function") checkTimer.unref()
  }

  async function downloadUpdate() {
    if (!app.isPackaged) return { ok: false, reason: "development" }
    if (!hasConfig) return { ok: false, reason: "not-configured" }
    const instance = resolveUpdater()
    if (!instance) return { ok: false, reason: "unavailable" }
    if (state.status === "downloaded") return { ok: true, alreadyDownloaded: true }
    if (state.status === "downloading") return { ok: true, alreadyDownloading: true }

    setState({ status: "downloading", percent: 0, error: null })
    try {
      await instance.downloadUpdate()
      return { ok: true }
    } catch (error) {
      logger.error("[updater] download failed:", error?.message ?? error)
      setState({ status: "error", percent: 0, error: error?.message ? String(error.message) : "download_failed" })
      return { ok: false, error: error?.message ? String(error.message) : "download_failed" }
    }
  }

  function installUpdate() {
    if (!app.isPackaged) return { ok: false, reason: "development" }
    if (!hasConfig) return { ok: false, reason: "not-configured" }
    if (state.status !== "downloaded") return { ok: false, reason: "not-downloaded" }
    const instance = resolveUpdater()
    if (!instance) return { ok: false, reason: "unavailable" }
    logger.info(`[updater] installing version ${state.version ?? "unknown"}`)
    instance.quitAndInstall()
    return { ok: true }
  }

  function dispose() {
    if (checkTimer) clearTimeout(checkTimer)
    if (intervalTimer) clearInterval(intervalTimer)
    checkTimer = null
    intervalTimer = null
  }

  return {
    initUpdater,
    checkForUpdates,
    downloadUpdate,
    installUpdate,
          getStatus: () => (app.isPackaged ? snapshot() : { ...snapshot(), status: state.status === "idle" ? "development" : state.status }),
      dispose
  }
}

let windowGetter = () => null
let service = null

function resolveDefaultFeedUrl(env = process.env) {
  return normalizeFeedUrl(env.HOZOR_UPDATE_URL)
}

function getService() {
  if (!service) {
    const { app } = require("electron")
    const customFeed = resolveDefaultFeedUrl()
    service = createUpdaterService({
      app,
      loadAutoUpdater: () => require("electron-updater"),
      getMainWindow: () => windowGetter(),
      feedUrl: customFeed,
      publishConfig: customFeed ? null : DEFAULT_GITHUB_PUBLISH
    })
  }
  return service
}

function initUpdater(getMainWindow) {
  windowGetter = typeof getMainWindow === "function" ? getMainWindow : () => null
  return getService().initUpdater()
}

module.exports = {
  initUpdater,
  checkForUpdates: () => getService().checkForUpdates(),
  downloadUpdate: () => getService().downloadUpdate(),
  installUpdate: () => getService().installUpdate(),
  getStatus: () => getService().getStatus(),
  createUpdaterService,
  normalizeFeedUrl
}
