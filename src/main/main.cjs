"use strict"

const path = require("node:path")
const fs = require("node:fs")
const { app, BrowserWindow, dialog, nativeTheme, session, shell } = require("electron")

nativeTheme.themeSource = "dark"

const { initDatabase, closeDatabase, getDatabasePath } = require("./db/index.cjs")
const { registerIpcHandlers, cancelActiveExports, discardActiveExports } = require("./ipc.cjs")
const exportJournal = require("./exportJournal.cjs")
const { initUpdater } = require("./updater.cjs")
const backupScheduler = require("./backupScheduler.cjs")
const { toErrorPayload } = require("./lib/errors.cjs")

const isDev = !app.isPackaged
const devServerUrl = process.env.VITE_DEV_SERVER_URL || "http://127.0.0.1:5173"
const RENDERER_ENTRY = path.join(__dirname, "..", "..", "dist", "index.html")

let mainWindow = null

function applySecurityPolicies() {
  app.on("web-contents-created", (_event, contents) => {
    contents.setWindowOpenHandler(({ url }) => {
      if (url.startsWith("https://wa.me/") || url.startsWith("https://api.whatsapp.com/")) {
        shell.openExternal(url)
      }
      return { action: "deny" }
    })
    contents.on("will-navigate", (event, url) => {
      const allowed = isDev ? url.startsWith(devServerUrl) : url.startsWith("file://")
      if (!allowed) event.preventDefault()
    })
    contents.on("will-attach-webview", event => event.preventDefault())
  })

  if (!isDev) {
    app.on("browser-window-created", (_event, window) => {
      window.webContents.on("before-input-event", (event, input) => {
        const key = String(input.key || "").toLowerCase()
        const devToolsShortcut = key === "f12" || (input.control && input.shift && key === "i") || (input.meta && input.alt && key === "i")
        if (devToolsShortcut) event.preventDefault()
      })
    })
  }
}

function createWindow() {
  const iconPath = path.resolve(__dirname, "../../build/icon.ico")
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 850,
    minWidth: 1024,
    minHeight: 700,
    title: "Attendance & Payroll System",
    icon: fs.existsSync(iconPath) ? iconPath : undefined,
    backgroundColor: "#020617",
    show: false,
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      webSecurity: true,
      devTools: isDev
    }
  })

  mainWindow.setMenuBarVisibility(false)

  if (isDev) {
    mainWindow.loadURL(devServerUrl)
  } else {
    mainWindow.loadFile(RENDERER_ENTRY)
  }

  mainWindow.once("ready-to-show", () => mainWindow?.show())
  mainWindow.on("closed", () => {
    mainWindow = null
  })
}

const gotSingleInstanceLock = app.requestSingleInstanceLock()

if (!gotSingleInstanceLock) {
  console.warn("[app] Another instance is already running. Please close the active instance first.")
  app.quit()
} else {
  app.on("second-instance", () => {
    if (!mainWindow) return
    if (mainWindow.isMinimized()) mainWindow.restore()
    mainWindow.focus()
  })

  applySecurityPolicies()

  const legacyUserData = path.join(app.getPath("appData"), "Hozor Ghiab")
  if (fs.existsSync(legacyUserData)) {
    app.setPath("userData", legacyUserData)
  }

  app.whenReady().then(() => {
    try {
      initDatabase(app.getPath("userData"))
      console.log(`[db] ${getDatabasePath()}`)
    } catch (error) {
      const detail = toErrorPayload(error)
      console.error("[db] failed to open database:", detail)
      const isNewerSchema = String(detail.message || "").includes("is newer than this application")
      if (isNewerSchema) {
        dialog.showErrorBox(
          "نیاز به به‌روزرسانی برنامه / Update Required",
          "پایگاه‌داده این سیستم به نسخه جدیدتری ارتقا یافته است و این نسخه قدیمی برنامه امکان اجرای آن را ندارد.\nلطفاً آخرین نسخه برنامه را نصب یا اجرا کنید.\n\nDatabase schema is newer than this application. Please run or install the updated version."
        )
      } else {
        dialog.showErrorBox("Database error", `${detail.code}: ${detail.message}`)
      }
      app.quit()
      return
    }

    session.defaultSession.setPermissionRequestHandler((_webContents, _permission, callback) => callback(false))

    try {
      exportJournal.sweep(app.getPath("userData"))
    } catch (error) {
      console.error("[export] startup sweep failed:", error?.message ?? error)
    }

    registerIpcHandlers({ getMainWindow: () => mainWindow })
    initUpdater(() => mainWindow)
    createWindow()
    backupScheduler.start()

    app.on("activate", () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow()
    })
  })

  app.on("before-quit", () => {
    cancelActiveExports()
    backupScheduler.onQuit()
  })

  app.on("will-quit", () => {
    discardActiveExports()
    backupScheduler.stop()
    closeDatabase()
  })

  app.on("window-all-closed", () => {
    if (process.platform !== "darwin") app.quit()
  })
}

