#!/usr/bin/env node

import fs from "node:fs"
import http from "node:http"
import path from "node:path"
import { spawn, spawnSync } from "node:child_process"
import { createRequire } from "node:module"
import { fileURLToPath } from "node:url"

const require = createRequire(import.meta.url)
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const dataDir = path.join(root, ".smoke-data")
const vitePort = Number(process.env.SMOKE_VITE_PORT || 5199)
const cdpPort = Number(process.env.SMOKE_CDP_PORT || 9450)
const PASSWORD = "Smoke#2026pass"

const children = []
const startedAt = Date.now()
const results = []

function log(message) {
  console.log(`[smoke] ${message}`)
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
    shell: process.platform === "win32"
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

async function connectToPage() {
  const targets = await waitFor(async () => {
    const { body } = await request(`http://127.0.0.1:${cdpPort}/json/list`)
    const list = JSON.parse(body)
    return list.find(item => item.type === "page" && String(item.url || "").startsWith("http")) ? list : null
  }, "renderer page")

  const target = targets.find(item => item.type === "page" && String(item.url || "").startsWith("http"))
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
      baseSalaryMinor: 25_000,
      paymentMethod: "bank_transfer"
    },
    "smoke"
  )

  database.closeDatabase()
  return { first, second, third, payslip, todayKey }
}

async function main() {
  fs.rmSync(path.join(root, ".smoke-tmp"), { recursive: true, force: true })
  const seed = seedDatabase()
  log(`seeded throwaway database in ${path.relative(root, dataDir)}`)
  console.log(`  PASS  database seed — 2 completed shifts, 1 idle employee, 1 payslip (${seed.payslip.number})`)

  startProcess("vite", "npx", ["vite", "--host", "127.0.0.1", "--port", String(vitePort), "--strictPort"])
  await waitFor(async () => (await request(`http://127.0.0.1:${vitePort}/`)).status === 200, "vite dev server")
  pass("vite dev server", `http://127.0.0.1:${vitePort}`)

  startProcess("electron", "npx", ["electron", ".", `--remote-debugging-port=${cdpPort}`, `--user-data-dir=${dataDir}`], {
    env: { VITE_DEV_SERVER_URL: `http://127.0.0.1:${vitePort}/` }
  })
  const client = await connectToPage()
  pass("electron window", "renderer attached over CDP")

  try {
    const booted = await evaluate(
      client,
      `(async () => {
        const sleep = ms => new Promise(resolve => setTimeout(resolve, ms))
        for (let i = 0; i < 120; i += 1) {
          const text = document.body.innerText
          if (text.trim().length > 20 && !/(جارٍ تحميل|در حال بارگذاری|Loading)/i.test(text)) return true
          await sleep(250)
        }
        return false
      })()`
    )
    if (!booted) fail("app boot", "window never rendered content")
    pass("app boot", "kiosk/login screen rendered")

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

    const kiosk = await evaluate(
      client,
      `(async () => {
        const sleep = ms => new Promise(resolve => setTimeout(resolve, ms))
        const text = () => document.body.innerText
        const cardVisible = () => [...document.querySelectorAll("button")].some(node => (node.textContent || "").includes("SM-3"))
        if (!cardVisible()) {
          const button = [...document.querySelectorAll("button, a")].find(node =>
            /تسجيل الحضور اليومي|ثبت حضور روزانه|Daily attendance/i.test((node.textContent || "").trim())
          )
          if (button) {
            button.click()
            await sleep(1500)
          }
        }
        const card = [...document.querySelectorAll("button")].find(node => (node.textContent || "").includes("SM-3"))
        if (!card) return { error: "no-employee-card", text: text().slice(0, 200) }
        card.click()
        await sleep(1500)
        const punchIn = [...document.querySelectorAll("button")].find(node =>
          /(بدء|تسجيل الدخول|شروع|Start)/i.test((node.textContent || "").trim())
        )
        if (!punchIn) return { error: "no-punch-in", text: text().slice(0, 300) }
        punchIn.click()
        await sleep(1500)
        const afterIn = text()
        return {
          punchedIn: /(استراحة|استراحت|Break|في العمل|در حال کار|working)/i.test(afterIn),
          afterIn: afterIn.slice(0, 300),
          controls: [...document.querySelectorAll("button, a")].map(node => (node.textContent || "").trim()).filter(Boolean).slice(0, 25)
        }
      })()`
    )
    if (kiosk?.error) fail("kiosk punch in", `${kiosk.error} :: ${kiosk.text ?? ""}`)
    if (!kiosk.punchedIn) fail("kiosk punch in", "no working/break state after punch")
    pass("kiosk punch in", "employee SM-3 started a shift through the real IPC path")

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

    const payroll = await evaluate(
      client,
      `(async () => {
        const sleep = ms => new Promise(resolve => setTimeout(resolve, ms))
        const nav = [...document.querySelectorAll("button, a")].find(node =>
          /فیش‌های حقوق|كشوف الرواتب|Payroll/i.test((node.textContent || "").trim())
        )
        if (!nav) return { error: "no-payroll-nav" }
        nav.click()
        await sleep(2500)
        const preview = [...document.querySelectorAll("button")].find(node =>
          /(معاينة|پیش‌نمایش|Preview)/i.test((node.getAttribute("title") || "") + (node.textContent || "")) ||
          /(معاينة|پیش‌نمایش|Preview)/i.test(node.getAttribute("aria-label") || "")
        )
        if (!preview) return { error: "no-preview-button", text: document.body.innerText.slice(0, 300) }
        preview.click()
        await sleep(1500)
        const dialog = document.querySelector('[role="dialog"]')
        const printButton = [...document.querySelectorAll('[role="dialog"] button')].find(node =>
          /(طباعة|چاپ|Print)/i.test((node.textContent || "").trim())
        )
        return {
          dialogOpen: Boolean(dialog),
          showsNet: Boolean(dialog && (dialog.innerText.includes("602") || /\\d+\\.\\d{3}/.test(dialog.innerText))),
          printButtonEnabled: Boolean(printButton && !printButton.disabled),
          printBridge: typeof window.api.print.payslip === "function" && typeof window.api.print.payslipPdf === "function",
          printableLayout: Boolean(dialog && dialog.querySelector(".print\\\\:hidden, [class*='print:']"))
        }
      })()`
    )
    if (payroll?.error) fail("payslip preview", `${payroll.error} :: ${payroll.text ?? ""}`)
    if (!payroll.dialogOpen) fail("payslip preview", "preview dialog did not open")
    if (!payroll.showsNet) fail("payslip preview", "net amount not rendered")
    if (!payroll.printButtonEnabled) fail("payslip preview", "print button missing or disabled")
    if (!payroll.printBridge) fail("print bridge", "print IPC methods missing")
    pass("payslip preview", "dialog, net amount and enabled print button")
    pass("print bridge", "print + printToPDF channels exposed")

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
  .finally(() => {
    stopChildren()
    setTimeout(() => {
      fs.rmSync(dataDir, { recursive: true, force: true })
      fs.rmSync(path.join(root, ".smoke-tmp"), { recursive: true, force: true })
    }, 1500)
  })
