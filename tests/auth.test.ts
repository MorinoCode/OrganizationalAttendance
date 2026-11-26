import { createRequire } from "node:module"
import { beforeEach, describe, expect, it } from "vitest"

const require = createRequire(import.meta.url)
const auth = require("../src/main/lib/auth.cjs") as {
  SESSION_TTL_MS: number
  MAX_SESSIONS: number
  hashPassword: (password: unknown) => string
  verifyPassword: (password: unknown, stored: unknown) => boolean
  parseStoredHash: (stored: unknown) => unknown
  createSession: (now?: number) => { token: string; expiresAt: number }
  readSession: (token: unknown, now?: number) => { expiresAt: number; createdAt: number } | null
  revokeSession: (token: unknown) => void
  revokeAllSessions: () => void
}

beforeEach(() => {
  auth.revokeAllSessions()
})

describe("password hashing", () => {
  it("stores a self-describing scrypt hash with a random salt", () => {
    const first = auth.hashPassword("Smoke#2026pass")
    const second = auth.hashPassword("Smoke#2026pass")

    expect(first.startsWith("scrypt$16384$8$1$")).toBe(true)
    expect(first.split("$")).toHaveLength(6)
    expect(first).not.toBe(second) // salted per password
    expect(auth.parseStoredHash(first)).toBeTruthy()
  })

  it("verifies the right password and rejects the wrong one", () => {
    const stored = auth.hashPassword("Smoke#2026pass")
    expect(auth.verifyPassword("Smoke#2026pass", stored)).toBe(true)
    expect(auth.verifyPassword("smoke#2026pass", stored)).toBe(false)
    expect(auth.verifyPassword("", stored)).toBe(false)
  })

  it("normalises unicode so the same typed password always matches", () => {
    const stored = auth.hashPassword("caf\u00e9-2026")
    expect(auth.verifyPassword("cafe\u0301-2026", stored)).toBe(true)
  })

  it("refuses malformed stored hashes instead of throwing", () => {
    for (const stored of ["", "plain-text", "scrypt$1$2$3", "scrypt$x$8$1$c2FsdA==$aGFzaA==", null]) {
      expect(auth.verifyPassword("anything", stored)).toBe(false)
      expect(auth.parseStoredHash(stored)).toBeNull()
    }
  })
})

describe("admin sessions", () => {
  it("issues an opaque token that expires after the ttl", () => {
    const now = 1_800_000_000_000
    const session = auth.createSession(now)

    expect(session.token.length).toBeGreaterThanOrEqual(32)
    expect(session.expiresAt).toBe(now + auth.SESSION_TTL_MS)
    expect(auth.readSession(session.token, now)).toMatchObject({ expiresAt: session.expiresAt })

    expect(auth.readSession(session.token, now + auth.SESSION_TTL_MS - 1)).not.toBeNull()
    expect(auth.readSession(session.token, now + auth.SESSION_TTL_MS)).toBeNull()
    expect(auth.readSession(session.token, now)).toBeNull()
  })

  it("rejects unknown, short and non-string tokens", () => {
    expect(auth.readSession("x".repeat(43))).toBeNull()
    expect(auth.readSession("short")).toBeNull()
    expect(auth.readSession(null)).toBeNull()
    expect(auth.readSession(undefined)).toBeNull()
  })

  it("revokes one session or every session", () => {
    const first = auth.createSession()
    const second = auth.createSession()

    auth.revokeSession(first.token)
    expect(auth.readSession(first.token)).toBeNull()
    expect(auth.readSession(second.token)).not.toBeNull()

    auth.revokeAllSessions()
    expect(auth.readSession(second.token)).toBeNull()
  })

  it("keeps the oldest sessions from piling up", () => {
    const tokens: string[] = []
    for (let index = 0; index < auth.MAX_SESSIONS + 4; index += 1) {
      tokens.push(auth.createSession(1_800_000_000_000 + index).token)
    }

    expect(auth.readSession(tokens[0])).toBeNull()
    expect(auth.readSession(tokens[tokens.length - 1])).not.toBeNull()
    expect(tokens.filter(token => auth.readSession(token) !== null).length).toBe(auth.MAX_SESSIONS)
  })
})
