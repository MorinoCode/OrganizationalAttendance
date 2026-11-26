import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { describe, expect, it } from "vitest"

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const preloadSource = fs.readFileSync(path.join(root, "src/main/preload.cjs"), "utf8")
const ipcSource = fs.readFileSync(path.join(root, "src/main/ipc.cjs"), "utf8")

function preloadChannels(): string[] {
  return [...preloadSource.matchAll(/invoke\("([^"]+)"/g)].map(match => match[1])
}

interface Registration {
  channel: string
  requiresAuth: boolean
}

function ipcRegistrations(): Registration[] {
  return ipcSource
    .split(/\n  handle\(/)
    .slice(1)
    .map(block => {
      const channel = /^"([^"]+)"/.exec(block)?.[1] ?? ""
      return { channel, requiresAuth: /requiresAuth:\s*true/.test(block) }
    })
}


const PUBLIC_CHANNELS = [
  "app:info",
  "attendance:end-break",
  "attendance:punch-in",
  "attendance:punch-out",
  "attendance:start-break",
  "attendance:today",
  "auth:emergency-reset",
  "auth:login",
  "auth:logout",
  "auth:status",
  "backup:restore",
  "employees:public",
  "settings:complete-setup",
  "settings:get"
]

describe("IPC surface", () => {
  const preload = preloadChannels()
  const registrations = ipcRegistrations()
  const channels = registrations.map(entry => entry.channel)

  it("parses a plausible surface from both files", () => {
    expect(preload.length).toBeGreaterThan(30)
    expect(channels.length).toBeGreaterThan(30)
    expect(channels.every(channel => /^[a-z]+:[a-z0-9-]+$/.test(channel))).toBe(true)
  })

  it("registers every channel exactly once (electron throws on duplicates)", () => {
    const duplicates = channels.filter((channel, index) => channels.indexOf(channel) !== index)
    expect(duplicates).toEqual([])
  })

  it("exposes every main handler in preload and every preload call in main", () => {
    const registered = new Set(channels)
    const exposed = new Set(preload)

    expect(preload.filter(channel => !registered.has(channel))).toEqual([])
    expect(channels.filter(channel => !exposed.has(channel))).toEqual([])
  })

  it("only leaves the reviewed channels open without an admin session", () => {
    const open = registrations
      .filter(entry => !entry.requiresAuth)
      .map(entry => entry.channel)
      .sort()

    expect(open).toEqual([...PUBLIC_CHANNELS].sort())
  })

  it("protects every data-reading and data-writing channel", () => {
    const open = new Set(
      registrations
        .filter(entry => !entry.requiresAuth)
        .map(entry => entry.channel)
    )

    for (const channel of [
      "attendance:list",
      "attendance:aggregate",
      "reports:month-close",
      "dashboard:insights",
      "employees:list",
      "employees:save",
      "leaves:save",
      "payslips:save",
      "audit:list",
      "backup:export",
      "export:attendance",
      "print:payslip"
    ]) {
      expect(open.has(channel), `${channel} must require an admin session`).toBe(false)
    }
  })
})
