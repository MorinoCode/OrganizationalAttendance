#!/usr/bin/env node

import fs from "node:fs"
import http from "node:http"
import net from "node:net"
import path from "node:path"
import { spawn, spawnSync } from "node:child_process"
import { createRequire } from "node:module"
import { fileURLToPath } from "node:url"

const require = createRequire(import.meta.url)
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const dataDir = path.join(root, ".smoke-data")
const printTraceFile = path.join(dataDir, "print-receipt.json")
const vitePort = Number(process.env.SMOKE_VITE_PORT || 5199)
const cdpPort = Number(process.env.SMOKE_CDP_PORT || 9450)
const PASSWORD = "Smoke#2026pass"
const viteBin = path.join(root, "node_modules", "vite", "bin", "vite.js")
const packaged = process.argv.includes("--packaged")

const children = []
const startedAt = Date.now()
const results = []

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms))

function log(message) {
  console.log(`[smoke] ${message}`)
}

function assertPortFree(port, label) {
  return new Promise((resolve, reject) => {
    const server = net.createServer()
    server.once("error", error =>
      reject(new Error(`${label} port ${port} is already in use (${error.code}); a previous app instance is still running`))
    )
    server.once("listening", () => server.close(() => resolve()))
    server.listen(port, "127.0.0.1")
  })
}

async function waitForPortRelease(port, timeoutMs = 8000) {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    try {
      await assertPortFree(port, "CDP")
      return true
    } catch {
      await sleep(300)
    }
  }
  return false
}

function pass(name, detail) {
  results.push({ name, ok: true, detail })
  console.log(`  PASS  ${name}${detail ? ` — ${detail}` : ""}`)
}

function fail(name, detail) {
  results.push({ name, ok: false, detail })
  console.log(`  FAIL  ${name}${detail ? ` — ${detail}` : ""}`)
  throw new Error(`${name}: ${detail}`)
}

function startProcess(label, command, args, options = {}) {
  const child = spawn(command, args, {
    cwd: root,
    env: { ...process.env, ...options.env },
    stdio: ["ignore", "pipe", "pipe"],
    shell: options.shell ?? process.platform === "win32"
  })
  const logFile = path.join(root, ".smoke-tmp", `${label}.log`)
  fs.mkdirSync(path.dirname(logFile), { recursive: true })
  const stream = fs.createWriteStream(logFile)
  child.stdout?.pipe(stream)
  child.stderr?.pipe(stream)
  children.push({ label, child, logFile })
  return child
}

function stopChildren() {
  for (const { child } of children.reverse()) {
    if (!child || child.exitCode !== null) continue
    try {
      if (process.platform === "win32") {
        spawnSync("taskkill", ["/pid", String(child.pid), "/T", "/F"], { stdio: "ignore" })
      } else {
        child.kill("SIGTERM")
      }
    } catch {
    }
  }
}

function request(url) {
  return new Promise((resolve, reject) => {
    http
      .get(url, res => {
        let body = ""
        res.on("data", chunk => (body += chunk))
        res.on("end", () => resolve({ status: res.statusCode ?? 0, body }))
      })
      .on("error", reject)
  })
}

async function waitFor(readiness, label, timeoutMs = 45_000) {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    try {
      const value = await readiness()
      if (value) return value
    } catch {
    }
    await new Promise(resolve => setTimeout(resolve, 250))
  }
  throw new Error(`Timed out waiting for ${label}`)
}

function prebundleViteDependencies() {
  const result = spawnSync(process.execPath, [viteBin, "optimize", "--force"], {
    cwd: root,
    encoding: "utf8",
    env: process.env
  })
  if (result.status !== 0) {
    const detail = `${result.stdout || ""}\n${result.stderr || ""}`.trim().split("\n").slice(-5).join(" ")
    throw new Error(`vite dependency pre-bundle failed (${result.status ?? result.signal}): ${detail}`)
  }
}

async function warmDevServer() {
  await request(`http://127.0.0.1:${vitePort}/@vite/client`)
  const html = await request(`http://127.0.0.1:${vitePort}/`)
  const entry = /<script[^>]+src="([^"]*\/src\/renderer\/main\.tsx)"/.exec(html.body)?.[1]
  await request(new URL(entry || "/src/renderer/main.tsx", `http://127.0.0.1:${vitePort}/`).toString())
}

function findPackagedExecutable() {
  const dir = path.join(root, "release", "win-unpacked")
  if (!fs.existsSync(dir)) {
    throw new Error("packaged build not found: run `npm run dist:dir` first")
  }
  const executable = fs
    .readdirSync(dir)
    .find(name => name.toLowerCase().endsWith(".exe") && name.toLowerCase() !== "elevate.exe")
  if (!executable) throw new Error(`no application executable in ${path.relative(root, dir)}`)
  return path.join(dir, executable)
}

const isAppPage = item => item.type === "page" && /^(http|file):/.test(String(item.url || ""))

async function connectToPage() {
  const targets = await waitFor(async () => {
    const { body } = await request(`http://127.0.0.1:${cdpPort}/json/list`)
    const list = JSON.parse(body)
    return list.find(isAppPage) ? list : null
  }, "renderer page")

  const target = targets.find(isAppPage)
  const socket = new WebSocket(target.webSocketDebuggerUrl)
  await new Promise((resolve, reject) => {
    socket.addEventListener("open", resolve)
    socket.addEventListener("error", reject)
  })

  let nextId = 1
  const pending = new Map()
  const consoleErrors = []
  socket.addEventListener("message", event => {
    const message = JSON.parse(event.data)
    if (!message.id) {
      if (message.method === "Runtime.exceptionThrown") {
        consoleErrors.push(message.params?.exceptionDetails?.exception?.description ?? "uncaught exception")
      }
      if (message.method === "Runtime.consoleAPICalled" && message.params?.type === "error") {
        consoleErrors.push((message.params.args ?? []).map(arg => arg.value ?? arg.description ?? "").join(" "))
      }
      return
    }
    const handler = pending.get(message.id)
    if (handler) {
      pending.delete(message.id)
      handler(message)
    }
  })

  const send = (method, params = {}) => {
    const id = nextId++
    socket.send(JSON.stringify({ id, method, params }))
    return new Promise((resolve, reject) =>
      pending.set(id, message => (message.error ? reject(new Error(message.error.message)) : resolve(message.result)))
    )
  }

  await send("Runtime.enable")
  return { send, close: () => socket.close(), consoleErrors }
}

async function evaluate(client, expression, timeoutMs = 60_000) {
  const deadline = Date.now() + 30_000
  for (;;) {
    try {
      const result = await client.send("Runtime.evaluate", {
        expression,
        awaitPromise: true,
        returnByValue: true,
        timeout: timeoutMs
      })
      if (result.exceptionDetails) {
        throw new Error(result.exceptionDetails.exception?.description ?? result.exceptionDetails.text)
      }
      return result.result.value ?? result.result.description
    } catch (error) {
      if (/execution context/i.test(error.message) && Date.now() < deadline) {
        await new Promise(resolve => setTimeout(resolve, 300))
        continue
      }
      throw error
    }
  }
}

function seedDatabase() {
  fs.rmSync(dataDir, { recursive: true, force: true })
  fs.mkdirSync(dataDir, { recursive: true })
  const database = require(path.join(root, "src/main/db/index.cjs"))
  const repositories = require(path.join(root, "src/main/db/repositories.cjs"))
  const auth = require(path.join(root, "src/main/lib/auth.cjs"))

  database.initDatabaseFromFile(path.join(dataDir, "hozor_ghiab.db"))
  repositories.updateSettings(
    {
      companyName: "Smoke Test Co",
      ownerName: "Smoke Owner",
      ownerRole: "Manager",
      currency: "KWD",
      currencyDecimals: 3,
      workDays: [0, 1, 2, 3, 4, 5, 6],
      isConfigured: true
    },
    "smoke"
  )
  repositories.setPasswordHash(auth.hashPassword(PASSWORD), "smoke")

  const first = repositories.saveEmployee(
    { fullName: "سمير التميمي", employeeCode: "SM-1", department: "Operations", salaryType: "hourly", baseRateMinor: 5000 },
    "smoke"
  )
  const second = repositories.saveEmployee(
    { fullName: "هند العلي", employeeCode: "SM-2", department: "Sales", salaryType: "hourly", baseRateMinor: 6000 },
    "smoke"
  )
  const third = repositories.saveEmployee(
    { fullName: "ريم السالم", employeeCode: "SM-3", department: "Operations", salaryType: "hourly", baseRateMinor: 5500 },
    "smoke"
  )

  const today = new Date()
  const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`
  const shiftStart = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 8, 0, 0).getTime()
  for (const employee of [first, second]) {
    repositories.punchIn(employee.id, { now: shiftStart })
    repositories.punchOut(employee.id, { now: shiftStart + 8 * 60 * 60 * 1000 })
  }

  const payslip = repositories.savePayslip(
    {
      employeeId: second.id,
      periodStart: todayKey,
      periodEnd: todayKey,
      workedDays: 1,
      workedMinutes: 8 * 60,
      overtimeMinutes: 180,
      overtimeAmountMinor: 3_600,
      baseSalaryMinor: 25_000,
      paymentMethod: "bank_transfer"
    },
    "smoke"
  )

  const previous = new Date(today.getFullYear(), today.getMonth() - 1, 1)
  const previousKey = `${previous.getFullYear()}-${String(previous.getMonth() + 1).padStart(2, "0")}`
  repositories.savePayslip(
    {
      employeeId: first.id,
      periodStart: `${previousKey}-01`,
      periodEnd: `${previousKey}-28`,
      workedDays: 20,
      workedMinutes: 20 * 8 * 60,
      overtimeMinutes: 60,
      overtimeAmountMinor: 1_200,
      baseSalaryMinor: 30_000,
      paymentMethod: "cash"
    },
    "smoke"
  )

  const db = database.getDb()
  const departmentRows = db
    .prepare(
      `SELECT COALESCE(NULLIF(TRIM(department), ''), '-') AS department,
              COUNT(DISTINCT employee_id) AS employees,
              COUNT(*) AS slips,
              SUM(net_amount_minor) AS net,
              SUM(overtime_minutes) AS overtime_minutes,
              SUM(overtime_amount_minor) AS overtime_amount_minor
       FROM payslips
       GROUP BY department
       ORDER BY net DESC, department ASC`
    )
    .all()
  const overtimeRows = db
    .prepare(
      `SELECT substr(period_start, 1, 7) AS month,
              SUM(overtime_minutes) AS minutes,
              SUM(overtime_amount_minor) AS amount
       FROM payslips
       GROUP BY month
       ORDER BY month`
    )
    .all()
  const monthStartKey = `${todayKey.slice(0, 7)}-01`
  const presentDays = Number(
    db
      .prepare(
        `SELECT COUNT(*) AS n FROM (
           SELECT a.employee_id, a.record_date
           FROM attendance_records a
           JOIN employees e ON e.id = a.employee_id
           WHERE a.record_date >= ? AND a.record_date <= ? AND a.punch_in_at IS NOT NULL AND e.is_active = 1
           GROUP BY a.employee_id, a.record_date
         )`
      )
      .get(monthStartKey, todayKey).n
  )
  const workingDays = today.getDate() // the smoke seed works every day of the week
  const activeEmployees = 3
  const expectedDays = workingDays * activeEmployees
  const absentDays = Math.max(0, expectedDays - presentDays)

  const expected = {
    departments: departmentRows.map(row => ({
      department: String(row.department),
      employees: Number(row.employees),
      slips: Number(row.slips),
      netAmountMinor: Number(row.net),
      overtimeMinutes: Number(row.overtime_minutes),
      overtimeAmountMinor: Number(row.overtime_amount_minor)
    })),
    totalNetMinor: departmentRows.reduce((total, row) => total + Number(row.net), 0),
    totalOvertimeMinutes: departmentRows.reduce((total, row) => total + Number(row.overtime_minutes), 0),
    totalOvertimeAmountMinor: departmentRows.reduce((total, row) => total + Number(row.overtime_amount_minor), 0),
    overtimeMonths: overtimeRows.map(row => ({
      month: String(row.month),
      minutes: Number(row.minutes),
      amountMinor: Number(row.amount)
    })),
    absence: {
      workingDays,
      expectedDays,
      presentDays,
      leaveDays: 0,
      absentDays,
      rate: expectedDays > 0 ? Math.round((absentDays / expectedDays) * 1000) / 1000 : 0,
      activeEmployees
    }
  }

  database.closeDatabase()
  return { first, second, third, payslip, todayKey, expected }
}

function openReadOnlyDatabase() {
  const { DatabaseSync } = require("node:sqlite")
  return new DatabaseSync(path.join(dataDir, "hozor_ghiab.db"), { readOnly: true })
}

function readOpenShift(seed) {
  const db = openReadOnlyDatabase()
  try {
    return (
      db
        .prepare(
          `SELECT record_date, punch_in_at, punch_out_at
           FROM attendance_records
           WHERE employee_id = ? AND record_date = ?
           LIMIT 1`
        )
        .get(seed.third.id, seed.todayKey) ?? null
    )
  } finally {
    db.close()
  }
}

function readAbsenceExpectation(seed) {
  const db = openReadOnlyDatabase()
  try {
    const monthStart = `${seed.todayKey.slice(0, 7)}-01`
    const presentDays = Number(
      db
        .prepare(
          `SELECT COUNT(*) AS n FROM (
             SELECT a.employee_id, a.record_date
             FROM attendance_records a
             JOIN employees e ON e.id = a.employee_id
             WHERE a.record_date >= ? AND a.record_date <= ? AND a.punch_in_at IS NOT NULL AND e.is_active = 1
             GROUP BY a.employee_id, a.record_date
           )`
        )
        .get(monthStart, seed.todayKey).n
    )
    const activeEmployees = Number(db.prepare("SELECT COUNT(*) AS n FROM employees WHERE is_active = 1").get().n)
    const workingDays = new Date().getDate()
    const expectedDays = workingDays * activeEmployees
    const absentDays = Math.max(0, expectedDays - presentDays)
    return {
      workingDays,
      expectedDays,
      presentDays,
      leaveDays: 0,
      absentDays,
      rate: expectedDays > 0 ? Math.round((absentDays / expectedDays) * 1000) / 1000 : 0,
      activeEmployees
    }
  } finally {
    db.close()
  }
}

function readPayslipExpectation(seed) {
  const db = openReadOnlyDatabase()
  try {
    const row = db
      .prepare(
        `SELECT id, number, period_start, period_end, base_salary_minor, net_amount_minor,
                overtime_minutes, overtime_amount_minor
         FROM payslips WHERE number = ?`
      )
      .get(seed.payslip.number)
    if (!row) throw new Error(`payslip ${seed.payslip.number} is missing from the smoke database`)
    return {
      id: String(row.id),
      number: String(row.number),
      periodStart: String(row.period_start),
      periodEnd: String(row.period_end),
      baseMinor: Number(row.base_salary_minor),
      netMinor: Number(row.net_amount_minor),
      overtimeMinutes: Number(row.overtime_minutes),
      overtimeMinor: Number(row.overtime_amount_minor)
    }
  } finally {
    db.close()
  }
}

async function main() {
  fs.rmSync(path.join(root, ".smoke-tmp"), { recursive: true, force: true })
  const seed = seedDatabase()
  log(`seeded throwaway database in ${path.relative(root, dataDir)}`)
  console.log(`  PASS  database seed — 2 completed shifts, 1 idle employee, 1 payslip (${seed.payslip.number})`)

  await assertPortFree(cdpPort, "CDP")

  if (packaged) {
    const executable = findPackagedExecutable()
    startProcess(
      "app",
      executable,
      [`--remote-debugging-port=${cdpPort}`, `--user-data-dir=${dataDir}`],
      {
        shell: false,
        env: { APPDATA: path.join(dataDir, "appdata"), SMOKE_PRINT_TRACE: printTraceFile }
      }
    )
    pass("packaged build", "release/win-unpacked")
  } else {
    prebundleViteDependencies()
    pass("vite dependency cache", "pre-bundled with the current lockfile before launch")

    startProcess("vite", "npx", ["vite", "--host", "127.0.0.1", "--port", String(vitePort), "--strictPort"])
    await waitFor(async () => (await request(`http://127.0.0.1:${vitePort}/`)).status === 200, "vite dev server")
    await warmDevServer()
    pass("vite dev server", `http://127.0.0.1:${vitePort} (entry module pre-compiled)`)

    startProcess("electron", "npx", ["electron", ".", `--remote-debugging-port=${cdpPort}`, `--user-data-dir=${dataDir}`], {
      env: { VITE_DEV_SERVER_URL: `http://127.0.0.1:${vitePort}/`, SMOKE_PRINT_TRACE: printTraceFile }
    })
  }

  const client = await connectToPage()
  const expectedOrigin = packaged ? "app.asar" : `:${vitePort}`
  let locationHref = ""
  const attached = await waitFor(
    async () => {
      locationHref = String(await evaluate(client, "location.href"))
      return locationHref.includes(expectedOrigin) ? locationHref : null
    },
    `renderer url containing ${expectedOrigin}`,
    20_000
  ).catch(() => null)
  if (!attached) {
    fail(packaged ? "packaged window" : "electron window", `attached to an unexpected window: ${locationHref || "unknown"}`)
  }
  pass(packaged ? "packaged window" : "electron window", "renderer attached over CDP")

  try {
    const boot = await evaluate(
      client,
      `(async () => {
        const sleep = ms => new Promise(resolve => setTimeout(resolve, ms))
        let origin = performance.timeOrigin
        let stable = 0
        for (let i = 0; i < 240; i += 1) {
          await sleep(250)
          if (performance.timeOrigin !== origin) {
            origin = performance.timeOrigin
            stable = 0
            continue
          }
          const text = document.body.innerText
          const painted = document.readyState === "complete" &&
            text.trim().length > 20 &&
            !/(جارٍ تحميل|در حال بارگذاری|Loading)/i.test(text)
          stable = painted ? stable + 1 : 0
          if (stable >= 4) return { origin, stable }
        }
        return { origin, stable }
      })()`
    )
    if (!boot || boot.stable < 4) fail("app boot", "window never rendered a stable document")
    pass("app boot", "kiosk/login screen rendered from a stable document")

    if (packaged) {
      const production = await evaluate(
        client,
        `({
          protocol: location.protocol,
          csp: document.querySelector('meta[http-equiv="Content-Security-Policy"]')?.getAttribute("content") ?? null,
          assets: [...document.querySelectorAll("script[src], link[rel=stylesheet]")].map(node =>
            new URL(node.getAttribute("src") || node.getAttribute("href"), location.href).href)
        })`
      )
      if (production.protocol !== "file:") {
        fail("packaged renderer", `expected a file:// document but loaded ${production.protocol}`)
      }
      if (
        !production.csp ||
        !/default-src 'self'/.test(production.csp) ||
        !/script-src 'self'/.test(production.csp) ||
        !/object-src 'none'/.test(production.csp)
      ) {
        fail("content security policy", `strict CSP meta missing (${production.csp ?? "none"})`)
      }
      if (production.assets.length === 0 || production.assets.some(asset => !asset.startsWith("file:"))) {
        fail("packaged renderer", `assets did not resolve inside the package: ${production.assets.slice(0, 3).join(", ")}`)
      }
      pass("packaged renderer", `file:// entry with ${production.assets.length} relative assets`)
      pass("content security policy", "strict CSP meta present and assets load from the package")
    }

    const kiosk = await evaluate(
      client,
      `(async () => {
        const sleep = ms => new Promise(resolve => setTimeout(resolve, ms))
        const text = () => document.body.innerText
        const card = () => [...document.querySelectorAll("button")].find(node => (node.textContent || "").includes("SM-3"))
        if (!card()) {
          const nav = [...document.querySelectorAll("button, a")].find(node =>
            /تسجيل الحضور اليومي|ثبت حضور روزانه|Daily attendance/i.test((node.textContent || "").trim())
          )
          if (nav) {
            nav.click()
            await sleep(1500)
          }
        }
        const employee = card()
        if (!employee) return { error: "no-employee-card", text: text().slice(0, 200) }
        employee.click()
        await sleep(1500)
        const startLabels = ["تسجيل دخول", "شروع شیفت", "Start shift"]
        const punchIn = [...document.querySelectorAll("button")].find(
          node => startLabels.includes((node.textContent || "").trim()) && !node.disabled
        )
        if (!punchIn) return { error: "no-punch-in", text: text().slice(0, 300) }
        punchIn.click()
        let afterIn = ""
        for (let i = 0; i < 40; i += 1) {
          await sleep(250)
          afterIn = text()
          if (/(على رأس العمل|در حال کار|Working)/i.test(afterIn)) break
        }
        return {
          punchedIn: /(على رأس العمل|در حال کار|Working)/i.test(afterIn),
          afterIn: afterIn.slice(0, 300)
        }
      })()`
    )
    if (kiosk?.error) fail("kiosk punch in", `${kiosk.error} :: ${kiosk.text ?? ""}`)
    if (!kiosk.punchedIn) fail("kiosk punch in", "no working/break state after punch")

    const persistedShift = readOpenShift(seed)
    if (!persistedShift) {
      const probe = openReadOnlyDatabase()
      let dump
      try {
        dump = probe.prepare("SELECT employee_id, record_date, punch_in_at, punch_out_at, status FROM attendance_records").all()
      } finally {
        probe.close()
      }
      fail(
        "kiosk punch in",
        `no attendance row for SM-3 :: afterIn=${kiosk.afterIn} :: rows=${JSON.stringify(dump)}`
      )
    }
    if (
      persistedShift.punch_in_at === null ||
      persistedShift.punch_in_at === undefined ||
      persistedShift.punch_out_at !== null
    ) {
      fail("kiosk punch in", `database row is not an open shift: ${JSON.stringify(persistedShift)}`)
    }
    seed.expected.absence = readAbsenceExpectation(seed)
    pass(
      "kiosk punch in",
      `SM-3 shift persisted to the smoke database on ${persistedShift.record_date} with punch_out_at null`
    )
    const login = await evaluate(
      client,
      `(async () => {
        const sleep = ms => new Promise(resolve => setTimeout(resolve, ms))
        const setValue = (element, value) => {
          const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set
          setter.call(element, value)
          element.dispatchEvent(new Event("input", { bubbles: true }))
        }
        const text = () => document.body.innerText
        let adminButton = null
        for (let i = 0; i < 60 && !document.querySelector('input[type="password"]'); i += 1) {
          adminButton = [...document.querySelectorAll("button")].find(node =>
            /ورود مدیر|تسجيل دخول الإدارة|Admin login/i.test((node.textContent || "").trim())
          )
          if (adminButton) break
          await sleep(250)
        }
        if (adminButton) {
          adminButton.click()
          await sleep(1000)
        }
        const input = document.querySelector('input[type="password"]')
        if (!input) {
          return "no-password-input: dialogs=" + document.querySelectorAll('[role="dialog"]').length +
            " inputs=" + document.querySelectorAll("input").length +
            " btn=" + Boolean(adminButton) + " :: " + text().slice(0, 300)
        }
        setValue(input, ${JSON.stringify(PASSWORD)})
        input.closest("form").requestSubmit()
        for (let i = 0; i < 60; i += 1) {
          await sleep(250)
          if (text().includes("خروج از حساب") || text().includes("تسجيل الخروج")) return "ok"
        }
        return "timeout"
      })()`
    )
    if (login !== "ok") fail("admin login", String(login))
    pass("admin login", "admin dashboard opened")

    const originAfterLogin = await evaluate(client, `performance.timeOrigin`)
    if (originAfterLogin !== boot.origin) {
      fail("renderer stability", "page reloaded while signing in (dependency optimization)")
    }
    pass("renderer stability", "no page reload between boot and the admin session")

    const version = await evaluate(client, `window.api.app.info().then(response => response.data?.version ?? null)`)
    if (!version) fail("app info", "version missing")
    pass("app info bridge", `version ${version}`)

    const dashboard = await evaluate(
      client,
      `(async () => {
        const sleep = ms => new Promise(resolve => setTimeout(resolve, ms))
        const panel = [...document.querySelectorAll("button, a")].find(node =>
          /لوحة التحكم|لوحة الإدارة|Admin dashboard|Dashboard/i.test((node.textContent || "").trim())
        )
        if (panel) {
          panel.click()
          await sleep(3000)
        }
        const text = document.body.innerText
        return {
          hasCostPanel: /تكلفة الرواتب حسب القسم|هزینه حقوق به تفکیک دپارتمان|Payroll cost by department/.test(text),
          hasOvertimePanel: /اتجاه العمل الإضافي|روند اضافه‌کار|Overtime trend/.test(text),
          hasAbsencePanel: /نسبة الغياب|نرخ غیبت|Absence rate/.test(text),
          hasDepartment: /Operations|Sales/.test(text),
          absenceSample: text.split("\\n").filter(line => line.includes("%")).slice(0, 3).join(" | "),
          hasAbsencePercent: text.includes("%"),
          showsEmptyState: /لا توجد بيانات مسجلة|هنوز اطلاعاتی|No data recorded/i.test(text)
        }
      })()`
    )
    const missingPanels = [
      dashboard.hasCostPanel ? null : "department costs",
      dashboard.hasOvertimePanel ? null : "overtime trend",
      dashboard.hasAbsencePanel ? null : "absence rate"
    ].filter(Boolean)
    if (missingPanels.length > 0) fail("dashboard analytics", `missing panels: ${missingPanels.join(", ")}`)
    if (!dashboard.hasDepartment) fail("dashboard analytics", "department cost rows are empty")
    if (!dashboard.hasAbsencePercent) fail("dashboard analytics", "absence rate percentage not rendered")
    if (dashboard.showsEmptyState) fail("dashboard analytics", "panels fell back to the empty state with data present")
    pass("dashboard analytics", `department costs, overtime trend and absence rate rendered (${dashboard.absenceSample})`)

    const reports = await evaluate(
      client,
      `(() => {
        const byId = id => document.querySelector('[data-testid="' + id + '"]')
        const attr = (element, name) => Number(element?.getAttribute(name))
        const departments = [...(byId("department-costs")?.querySelectorAll("[data-department]") ?? [])].map(node => ({
          department: node.getAttribute("data-department"),
          netAmountMinor: attr(node, "data-amount-minor"),
          overtimeMinutes: attr(node, "data-overtime-minutes")
        }))
        const absencePanel = byId("absence-rate")
        return {
          departments,
          totalNetMinor: attr(byId("department-costs-total"), "data-amount-minor"),
          overtimeTotalMinutes: attr(byId("overtime-total"), "data-minutes"),
          overtimeTotalAmountMinor: attr(byId("overtime-total"), "data-amount-minor"),
          overtimeMonths: [...(byId("overtime-trend")?.querySelectorAll("[data-month]") ?? [])].map(node => ({
            month: node.getAttribute("data-month"),
            minutes: attr(node, "data-minutes"),
            amountMinor: attr(node, "data-amount-minor")
          })),
          absence: {
            rate: attr(absencePanel?.querySelector("[data-rate]"), "data-rate"),
            expectedDays: attr(absencePanel?.querySelector("[data-expected-days]"), "data-expected-days"),
            presentDays: attr(absencePanel?.querySelector("[data-present-days]"), "data-present-days"),
            leaveDays: attr(absencePanel?.querySelector("[data-leave-days]"), "data-leave-days"),
            absentDays: attr(absencePanel?.querySelector("[data-absent-days]"), "data-absent-days"),
            workingDays: attr(absencePanel?.querySelector("[data-working-days]"), "data-working-days"),
            activeEmployees: attr(absencePanel?.querySelector("[data-active-employees]"), "data-active-employees")
          }
        }
      })()`
    )

    const shownDepartments = reports.departments
      .map(row => `${row.department}:${row.netAmountMinor}:${row.overtimeMinutes}`)
      .join("|")
    const expectedDepartments = seed.expected.departments
      .map(row => `${row.department}:${row.netAmountMinor}:${row.overtimeMinutes}`)
      .join("|")
    const rowTotal = reports.departments.reduce((total, row) => total + row.netAmountMinor, 0)
    if (shownDepartments !== expectedDepartments) {
      fail("department cost report", `rendered [${shownDepartments}] but SQL says [${expectedDepartments}]`)
    }
    if (reports.totalNetMinor !== seed.expected.totalNetMinor || rowTotal !== seed.expected.totalNetMinor) {
      fail(
        "department cost report",
        `total ${reports.totalNetMinor} vs rows ${rowTotal} vs SQL ${seed.expected.totalNetMinor}`
      )
    }
    if (reports.totalNetMinor <= 0) fail("department cost report", "total cost is zero for seeded payroll")
    pass(
      "department cost report",
      `${reports.departments.length} departments, total ${reports.totalNetMinor} minor units equals the SQL sum`
    )

    if (
      reports.overtimeTotalMinutes !== seed.expected.totalOvertimeMinutes ||
      reports.overtimeTotalAmountMinor !== seed.expected.totalOvertimeAmountMinor
    ) {
      fail(
        "overtime report",
        `range total ${reports.overtimeTotalMinutes} min / ${reports.overtimeTotalAmountMinor} vs SQL ${seed.expected.totalOvertimeMinutes} min / ${seed.expected.totalOvertimeAmountMinor}`
      )
    }
    const renderedMonths = new Map(reports.overtimeMonths.map(point => [point.month, point]))
    for (const point of seed.expected.overtimeMonths) {
      const shown = renderedMonths.get(point.month)
      if (!shown || shown.minutes !== point.minutes || shown.amountMinor !== point.amountMinor) {
        fail(
          "overtime report",
          `${point.month}: rendered ${shown?.minutes ?? "missing"} min / ${shown?.amountMinor ?? "-"} vs SQL ${point.minutes} min / ${point.amountMinor}`
        )
      }
    }
    const overtimeMonths = seed.expected.overtimeMonths.filter(point => point.minutes > 0).length
    if (overtimeMonths < 2 || reports.overtimeTotalMinutes <= 0) {
      fail("overtime report", `expected a non-zero multi-month overtime series, got ${overtimeMonths} months`)
    }
    pass(
      "overtime report",
      `${overtimeMonths} non-zero months, ${reports.overtimeTotalMinutes} minutes equals the SQL series`
    )

    const absence = reports.absence
    const expectedAbsence = seed.expected.absence
    if (
      absence.workingDays !== expectedAbsence.workingDays ||
      absence.activeEmployees !== expectedAbsence.activeEmployees ||
      absence.expectedDays !== expectedAbsence.expectedDays ||
      absence.presentDays !== expectedAbsence.presentDays ||
      absence.leaveDays !== expectedAbsence.leaveDays ||
      absence.absentDays !== expectedAbsence.absentDays ||
      absence.rate !== expectedAbsence.rate
    ) {
      fail("absence rate report", `rendered ${JSON.stringify(absence)} but SQL/formula gives ${JSON.stringify(expectedAbsence)}`)
    }
    if (absence.rate <= 0 || absence.absentDays <= 0) {
      fail("absence rate report", "seeded month should show a non-zero absence rate")
    }
    pass(
      "absence rate report",
      `${absence.absentDays}/${absence.expectedDays} absent days = ${absence.rate} (workingDays x activeEmployees)`
    )

    const payslip = await evaluate(
      client,
      `(async () => {
        const sleep = ms => new Promise(resolve => setTimeout(resolve, ms))
        const waitFor = async (finder, timeoutMs = 10000) => {
          const deadline = Date.now() + timeoutMs
          while (Date.now() < deadline) {
            const found = finder()
            if (found) return found
            await sleep(250)
          }
          return null
        }
        if (performance.timeOrigin !== ${boot.origin}) {
          return { error: "renderer-reloaded", text: "document replaced mid-scenario; the admin session was lost" }
        }
        const dashboardNav = [...document.querySelectorAll("button, a")].find(node =>
          /لوحة التحكم|لوحة الإدارة|Admin dashboard|Dashboard/i.test((node.textContent || "").trim())
        )
        if (dashboardNav) {
          dashboardNav.click()
          await sleep(2000)
        }
        const panel = await waitFor(() => document.querySelector('[data-testid="payroll-cost-trend"]'))
        if (!panel) return { error: "no-dashboard-panel", text: document.body.innerText.slice(0, 300) }
        const viewAll = [...panel.querySelectorAll("button, a")].find(node =>
          /عرض الكل|مشاهده همه|View all/i.test((node.textContent || "").trim())
        )
        if (!viewAll) return { error: "no-payroll-link", text: panel.innerText.slice(0, 200) }
        viewAll.click()
        const preview = await waitFor(() => [...document.querySelectorAll("button")].find(node => {
          const label = (node.getAttribute("title") || "") + (node.getAttribute("aria-label") || "")
          if (!/(معاينة|پیش‌نمایش|Preview)/i.test(label)) return false
          let card = node.parentElement
          for (let depth = 0; depth < 4 && card; depth += 1, card = card.parentElement) {
            if ((card.textContent || "").includes(${JSON.stringify(seed.payslip.number)})) return true
          }
          return false
        }))
        if (!preview) return { error: "no-payslip-row", text: document.body.innerText.slice(0, 300) }
        preview.click()
        const dialog = await waitFor(() => document.querySelector('[data-testid="payslip-preview"]'))
        if (!dialog) return { error: "no-preview-dialog", text: document.body.innerText.slice(0, 300) }
        const attr = name => dialog.getAttribute("data-" + name)
        const printButton = [...dialog.querySelectorAll("button")].find(node =>
          /(طباعة|چاپ|Print)/i.test((node.textContent || "").trim())
        )
        return {
          fromDashboard: Boolean(panel && viewAll),
          dialogOpen: true,
          attrs: {
            id: attr("payslip-id"),
            number: attr("payslip-number"),
            periodStart: attr("period-start"),
            periodEnd: attr("period-end"),
            baseMinor: Number(attr("base-minor")),
            netMinor: Number(attr("net-minor")),
            overtimeMinutes: Number(attr("overtime-minutes")),
            overtimeMinor: Number(attr("overtime-minor"))
          },
          printButtonEnabled: Boolean(printButton && !printButton.disabled)
        }
      })()`
    )
    if (payslip?.error) fail("payslip preview", `${payslip.error} :: ${payslip.text ?? ""}`)
    if (!payslip.fromDashboard) fail("payslip preview", "payroll was not opened from the dashboard panel")
    if (!payslip.dialogOpen) fail("payslip preview", "preview dialog did not open")
    if (!payslip.printButtonEnabled) fail("payslip preview", "print button missing or disabled")

    const expectedSlip = readPayslipExpectation(seed)
    const slipFields = ["id", "number", "periodStart", "periodEnd", "baseMinor", "netMinor", "overtimeMinutes", "overtimeMinor"]
    for (const field of slipFields) {
      if (payslip.attrs[field] !== expectedSlip[field]) {
        fail(
          "payslip preview",
          `${field}: dialog shows ${JSON.stringify(payslip.attrs[field])} but the SQL payslip says ${JSON.stringify(expectedSlip[field])}`
        )
      }
    }
    pass(
      "payslip preview",
      `${expectedSlip.number} ${expectedSlip.periodStart} -> ${expectedSlip.periodEnd} net ${expectedSlip.netMinor} equals the SQL payslip`
    )

    const printAction = await evaluate(
      client,
      `(() => {
        const dialog = document.querySelector('[data-testid="payslip-preview"]')
        if (!dialog) return { clicked: false, reason: "no-dialog" }
        const button = [...dialog.querySelectorAll("button")].find(node =>
          /(طباعة|چاپ|Print)/i.test((node.textContent || "").trim())
        )
        if (!button) return { clicked: false, reason: "no-print-button" }
        button.click()
        return { clicked: true }
      })()`
    )
    if (!printAction?.clicked) fail("print request", `print button could not be clicked (${printAction?.reason ?? "unknown"})`)

    const receipt = await waitFor(
      () => {
        if (!fs.existsSync(printTraceFile)) return null
        try {
          return JSON.parse(fs.readFileSync(printTraceFile, "utf8"))
        } catch {
          return null
        }
      },
      "print receipt from the main process",
      20_000
    )
    if (receipt.payslipId !== expectedSlip.id || receipt.payslipNumber !== expectedSlip.number) {
      fail("print request", `main received ${JSON.stringify(receipt)} but expected ${expectedSlip.number}`)
    }
    if (receipt.success !== true || !(receipt.bytes > 1000)) {
      fail("print request", `handler did not produce a printable document: ${JSON.stringify(receipt)}`)
    }
    const printPdfPath = `${printTraceFile}.pdf`
    if (!fs.existsSync(printPdfPath) || fs.statSync(printPdfPath).size !== receipt.bytes) {
      fail("print request", "the PDF bytes recorded by the handler are missing on disk")
    }
    pass(
      "print request",
      `main handler received print:payslip for ${receipt.payslipNumber} and produced ${receipt.bytes} bytes`
    )

    await sleep(1200)
    const printFeedback = await evaluate(
      client,
      `(() => {
        const dialog = document.querySelector('[data-testid="payslip-preview"]')
        const errorBanner = [...document.querySelectorAll('[role="status"]')].some(node =>
          /خطأ|خطا|error|failed|تعذر|ناموفق/i.test(node.innerText || "")
        )
        return { dialogOpen: Boolean(dialog), errorBanner }
      })()`
    )
    if (!printFeedback.dialogOpen) fail("print response", "preview dialog closed unexpectedly after printing")
    if (printFeedback.errorBanner) fail("print response", "renderer surfaced an error after the print request")
    pass("print response", "renderer kept the preview open with no error feedback")
    const report = await evaluate(
      client,
      `(async () => {
        const sleep = ms => new Promise(resolve => setTimeout(resolve, ms))
        const back = [...document.querySelectorAll("button, a")].find(node =>
          /لوحة التحكم|لوحة الإدارة|تسجيل دخول الإدارة|ورود مدیر|Admin (login|panel|dashboard)|Dashboard/i.test((node.textContent || "").trim())
        )
        if (back) {
          back.click()
          await sleep(1800)
        }
        const nav = [...document.querySelectorAll("button, a")].find(node =>
          /حضور و گزارش|الدوام والتقارير|Attendance/i.test((node.textContent || "").trim())
        )
        if (!nav) return { error: "no-reports-nav", text: document.body.innerText.slice(0, 300) }
        nav.click()
        await sleep(2500)
        const text = document.body.innerText
        const rows = [...document.querySelectorAll("tbody tr")]
        const rowText = rows.map(row => row.innerText.replace(/\\s+/g, " "))
        return {
          hasEmployee: text.includes("SM-1") && text.includes("SM-2"),
          tableRows: rows.length,
          tableHasBothEmployees: rowText.some(row => row.includes("سمير")) && rowText.some(row => row.includes("هند")),
          completedRows: rowText.filter(row => row.includes("سمير") || row.includes("هند")).length,
          showsWorkedHours: rowText.some(row =>
            row.includes("8") && ["ساعة", "ساعت", "hours", "hour"].some(unit => row.includes(unit))
          ),
          summaryLine: text.match(/[^\\n]*(?:سجل|سجلات|records?|رکورد)[^\\n]*/i)?.[0] ?? null,
          text
        }
      })()`
    )
    if (report?.error) fail("attendance report", `${report.error} :: ${report.text ?? ""}`)
    if (!report.hasEmployee) fail("attendance report", "employees missing from the table")
    if (report.completedRows < 2 || !report.tableHasBothEmployees || !report.showsWorkedHours) {
      fail("attendance report", `${report.tableRows} table rows, completed=${report.completedRows}, summary=${report.summaryLine ?? "none"}`)
    }
    pass("attendance report", `${report.completedRows} rows with worked hours=${report.showsWorkedHours} (${report.summaryLine ?? "no summary"})`)

    const consoleErrors = client.consoleErrors.filter(message => !/Download the React DevTools/i.test(message))
    if (consoleErrors.length > 0) fail("renderer console", consoleErrors.slice(0, 3).join(" | "))
    pass("renderer console", "no errors or uncaught exceptions")
  } finally {
    client?.close()
  }
}

main()
  .then(() => {
    const seconds = ((Date.now() - startedAt) / 1000).toFixed(1)
    console.log(`[smoke] PASSED in ${seconds}s (${results.length} checks)`)
  })
  .catch(error => {
    const seconds = ((Date.now() - startedAt) / 1000).toFixed(1)
    console.error(`[smoke] FAILED after ${seconds}s: ${error.message}`)
    for (const { label, logFile } of children) {
      const tail = fs.existsSync(logFile) ? fs.readFileSync(logFile, "utf8").split("\n").slice(-15).join("\n") : ""
      console.error(`[smoke] --- ${label} log tail ---\n${tail}`)
    }
    process.exitCode = 1
  })
  .finally(async () => {
    stopChildren()
    const released = await waitForPortRelease(cdpPort)
    if (!released) log(`warning: CDP port ${cdpPort} is still in use after cleanup`)
    setTimeout(() => {
      fs.rmSync(dataDir, { recursive: true, force: true })
      fs.rmSync(path.join(root, ".smoke-tmp"), { recursive: true, force: true })
    }, 1500)
  })
