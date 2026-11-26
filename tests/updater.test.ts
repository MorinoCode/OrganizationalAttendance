import { EventEmitter } from "node:events"
import { afterEach, describe, expect, it, vi } from "vitest"

import { createUpdaterService, normalizeFeedUrl } from "../src/main/updater.cjs"

const FEED = "https://updates.example.com/app/"

function createFakeUpdater(overrides: Record<string, unknown> = {}) {
  const emitter = new EventEmitter() as EventEmitter & Record<string, any>
  emitter.setFeedURL = vi.fn()
  emitter.checkForUpdates = vi.fn(async () => {
    emitter.emit("checking-for-update")
    emitter.emit("update-not-available", { version: "1.1.0" })
    return { updateInfo: { version: "1.1.0" } }
  })
  emitter.downloadUpdate = vi.fn(async () => {
    emitter.emit("download-progress", { percent: 41.6 })
    emitter.emit("update-downloaded", { version: "1.2.0" })
  })
  emitter.quitAndInstall = vi.fn()
  Object.assign(emitter, overrides)
  return emitter
}

function createService({ isPackaged = true, feedUrl = FEED, updater = createFakeUpdater() } = {}) {
  const app = { isPackaged, getVersion: () => "1.1.0" }
  const logger = { info: vi.fn(), warn: vi.fn(), error: vi.fn() }
  const service = createUpdaterService({
    app,
    loadAutoUpdater: () => ({ autoUpdater: updater }),
    feedUrl,
    initialDelayMs: 20_000,
    checkIntervalMs: 6 * 60 * 60 * 1000,
    logger
  })
  return { service, updater, logger }
}

afterEach(() => {
  vi.useRealTimers()
})

describe("updater feed configuration", () => {
  it("accepts https feeds and appends a trailing slash", () => {
    expect(normalizeFeedUrl("https://updates.example.com/app")).toBe("https://updates.example.com/app/")
    expect(normalizeFeedUrl(" https://updates.example.com/app/ ")).toBe("https://updates.example.com/app/")
  })

  it("rejects plain http feeds except on loopback and rejects garbage", () => {
    expect(normalizeFeedUrl("http://updates.example.com/app")).toBeNull()
    expect(normalizeFeedUrl("http://localhost:8787/app")).toBe("http://localhost:8787/app/")
    expect(normalizeFeedUrl("not a url")).toBeNull()
    expect(normalizeFeedUrl("")).toBeNull()
  })
})

describe("updater service", () => {
  it("never touches electron-updater in development", async () => {
    const { service, updater } = createService({ isPackaged: false })

    await expect(service.checkForUpdates()).resolves.toMatchObject({ status: "development", currentVersion: "1.1.0" })
    await expect(service.downloadUpdate()).resolves.toMatchObject({ ok: false, reason: "development" })
    expect(service.installUpdate()).toMatchObject({ ok: false, reason: "development" })
    expect(updater.checkForUpdates).not.toHaveBeenCalled()
  })

  it("reports not-configured when no feed url is set and does not schedule checks", async () => {
    vi.useFakeTimers()
    const { service, updater, logger } = createService({ feedUrl: null })

    await expect(service.checkForUpdates()).resolves.toMatchObject({ status: "not-configured", feedConfigured: false })
    service.initUpdater()
    await vi.advanceTimersByTimeAsync(60 * 60 * 1000)

    expect(updater.checkForUpdates).not.toHaveBeenCalled()
    expect(logger.warn).toHaveBeenCalled()
    service.dispose()
  })

  it("checks a packaged build and reports an available update", async () => {
    const updater = createFakeUpdater({
      checkForUpdates: vi.fn(async () => {
        updater.emit("checking-for-update")
        updater.emit("update-available", { version: "1.2.0" })
        return { updateInfo: { version: "1.2.0" } }
      })
    })
    const { service } = createService({ updater })

    const result = await service.checkForUpdates()

    expect(result).toMatchObject({ status: "available", version: "1.2.0", currentVersion: "1.1.0", isPackaged: true })
    expect(updater.checkForUpdates).toHaveBeenCalledTimes(1)
    expect(updater.setFeedURL).toHaveBeenCalledWith({ provider: "generic", url: FEED })
  })

  it("downloads, tracks progress and only then installs", async () => {
    const updater = createFakeUpdater({
      checkForUpdates: vi.fn(async () => {
        updater.emit("update-available", { version: "1.2.0" })
        return { updateInfo: { version: "1.2.0" } }
      })
    })
    const { service } = createService({ updater })

    expect(service.installUpdate()).toMatchObject({ ok: false, reason: "not-downloaded" })

    await service.checkForUpdates()
    await expect(service.downloadUpdate()).resolves.toMatchObject({ ok: true })
    expect(service.getStatus()).toMatchObject({ status: "downloaded", version: "1.2.0", percent: 100 })

    expect(service.installUpdate()).toMatchObject({ ok: true })
    expect(updater.quitAndInstall).toHaveBeenCalledTimes(1)
  })

  it("surfaces updater errors with their message", async () => {
    const updater = createFakeUpdater({
      checkForUpdates: vi.fn(async () => {
        updater.emit("error", new Error("network down"))
        throw new Error("network down")
      })
    })
    const { service } = createService({ updater })

    const result = await service.checkForUpdates()

    expect(result).toMatchObject({ status: "error", error: "network down" })
  })

  it("checks shortly after startup and then on an interval", async () => {
    vi.useFakeTimers()
    const { service, updater } = createService()

    service.initUpdater()
    expect(updater.checkForUpdates).not.toHaveBeenCalled()

    await vi.advanceTimersByTimeAsync(20_000)
    expect(updater.checkForUpdates).toHaveBeenCalledTimes(1)

    await vi.advanceTimersByTimeAsync(6 * 60 * 60 * 1000)
    expect(updater.checkForUpdates).toHaveBeenCalledTimes(2)

    service.dispose()
    await vi.advanceTimersByTimeAsync(12 * 60 * 60 * 1000)
    expect(updater.checkForUpdates).toHaveBeenCalledTimes(2)
  })
})
