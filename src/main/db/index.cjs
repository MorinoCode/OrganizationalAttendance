"use strict"

const fs = require("node:fs")
const path = require("node:path")
const { DatabaseSync } = require("node:sqlite")
const { runMigrations, SCHEMA_VERSION } = require("./schema.cjs")
const { appError } = require("../lib/errors.cjs")

const DATABASE_FILENAME = "hozor_ghiab.db"

let database = null
let databasePath = null

function openDatabase(filePath) {
  const inMemory = filePath === ":memory:"
  if (!inMemory) {
    fs.mkdirSync(path.dirname(filePath), { recursive: true })
  }

  const db = new DatabaseSync(filePath)
  if (!inMemory) db.exec("PRAGMA journal_mode = WAL")
  db.exec("PRAGMA foreign_keys = ON")
  db.exec("PRAGMA busy_timeout = 5000")
  db.exec("PRAGMA synchronous = NORMAL")

  runMigrations(db)
  return db
}

function initDatabaseFromFile(filePath) {
  if (database) return database
  databasePath = filePath
  database = openDatabase(filePath)
  return database
}

function initDatabase(userDataPath) {
  return initDatabaseFromFile(path.join(userDataPath, DATABASE_FILENAME))
}

function getDb() {
  if (!database) throw appError("database_not_ready", "Database is not initialised yet.")
  return database
}

function getDatabasePath() {
  return databasePath
}

function getTotalChanges() {
  if (!database) return 0
  const row = database.prepare("SELECT total_changes() AS changes").get()
  return Number(row?.changes ?? 0)
}

function replaceDatabaseFrom(sourcePath) {
  if (!databasePath || databasePath === ":memory:") {
    throw appError("database_not_ready", "Database is not initialised yet.")
  }

  closeDatabase()

  const target = databasePath
  const staging = `${target}.restore.tmp`
  const previous = `${target}.restore.old`
  fs.copyFileSync(sourcePath, staging)
  for (const suffix of ["-wal", "-shm"]) {
    try {
      fs.unlinkSync(`${target}${suffix}`)
    } catch {
    }
  }
  fs.rmSync(previous, { force: true })
  fs.renameSync(target, previous)
  try {
    fs.renameSync(staging, target)
  } catch (error) {
    fs.renameSync(previous, target)
    throw error
  }
  fs.rmSync(previous, { force: true })

  database = openDatabase(target)
  return database
}

function closeDatabase() {
  if (!database) return
  try {
    database.exec("PRAGMA wal_checkpoint(TRUNCATE)")
  } catch {
  }
  database.close()
  database = null
}

function withTransaction(fn) {
  const db = getDb()
  db.exec("BEGIN IMMEDIATE")
  try {
    const result = fn(db)
    db.exec("COMMIT")
    return result
  } catch (error) {
    try {
      db.exec("ROLLBACK")
    } catch {
    }
    throw error
  }
}

module.exports = {
  SCHEMA_VERSION,
  DATABASE_FILENAME,
  openDatabase,
  initDatabase,
  initDatabaseFromFile,
  getDb,
  getDatabasePath,
  getTotalChanges,
  replaceDatabaseFrom,
  closeDatabase,
  withTransaction
}
