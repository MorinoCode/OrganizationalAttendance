"use strict"

const crypto = require("node:crypto")

const SCRYPT_PARAMS = { N: 16384, r: 8, p: 1, keyLength: 64 }
const SESSION_TTL_MS = 30 * 60 * 1000
const MAX_SESSIONS = 8

const sessions = new Map()

function scryptOptions(params) {
  return {
    N: params.N,
    r: params.r,
    p: params.p,
    maxmem: 128 * params.N * params.r * 2
  }
}

function hashPassword(password) {
  const normalized = String(password ?? "").normalize("NFKC")
  const salt = crypto.randomBytes(16)
  const { N, r, p, keyLength } = SCRYPT_PARAMS
  const hash = crypto.scryptSync(normalized, salt, keyLength, scryptOptions(SCRYPT_PARAMS))
  return `scrypt$${N}$${r}$${p}$${salt.toString("base64")}$${hash.toString("base64")}`
}

function parseStoredHash(stored) {
  const parts = String(stored ?? "").split("$")
  if (parts.length !== 6 || parts[0] !== "scrypt") return null
  const [, n, r, p, salt, hash] = parts
  const params = { N: Number(n), r: Number(r), p: Number(p), keyLength: 64 }
  if (!Number.isFinite(params.N) || !Number.isFinite(params.r) || !Number.isFinite(params.p)) return null
  try {
    return { params, salt: Buffer.from(salt, "base64"), hash: Buffer.from(hash, "base64") }
  } catch {
    return null
  }
}

function verifyPassword(password, stored) {
  const parsed = parseStoredHash(stored)
  if (!parsed) return false
  const normalized = String(password ?? "").normalize("NFKC")
  let candidate
  try {
    candidate = crypto.scryptSync(normalized, parsed.salt, parsed.hash.length, scryptOptions(parsed.params))
  } catch {
    return false
  }
  if (candidate.length !== parsed.hash.length) return false
  return crypto.timingSafeEqual(candidate, parsed.hash)
}

function pruneSessions(now = Date.now()) {
  for (const [token, session] of sessions) {
    if (session.expiresAt <= now) sessions.delete(token)
  }
  if (sessions.size >= MAX_SESSIONS) {
    const oldest = [...sessions.entries()].sort((a, b) => a[1].expiresAt - b[1].expiresAt)[0]
    if (oldest) sessions.delete(oldest[0])
  }
}

function createSession(now = Date.now()) {
  pruneSessions(now)
  const token = crypto.randomBytes(32).toString("base64url")
  sessions.set(token, { expiresAt: now + SESSION_TTL_MS, createdAt: now })
  return { token, expiresAt: now + SESSION_TTL_MS }
}

function readSession(token, now = Date.now()) {
  if (typeof token !== "string" || token.length < 16) return null
  const session = sessions.get(token)
  if (!session) return null
  if (session.expiresAt <= now) {
    sessions.delete(token)
    return null
  }
  return session
}

function revokeSession(token) {
  if (typeof token === "string") sessions.delete(token)
}

function revokeAllSessions() {
  sessions.clear()
}

module.exports = {
  SCRYPT_PARAMS,
  SESSION_TTL_MS,
  MAX_SESSIONS,
  hashPassword,
  verifyPassword,
  parseStoredHash,
  createSession,
  readSession,
  revokeSession,
  revokeAllSessions
}
