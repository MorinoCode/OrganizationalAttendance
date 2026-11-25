import { CompanySettings, Payslip } from "../types"

export function cleanPhoneNumber(raw: string | undefined | null): string {
  if (!raw) return ""
  let cleaned = raw.replace(/\D/g, "")
  cleaned = cleaned.replace(/^0+/, "")
  if (!cleaned) return ""

  if (cleaned.startsWith("965") && cleaned.length >= 11) {
    return cleaned
  }
  if (cleaned.length === 8) {
    return `965${cleaned}`
  }
  if (cleaned.length >= 7 && cleaned.length <= 15) {
    return cleaned
  }
  return ""
}

export function buildPayslipMessage({
  slip,
  settings,
  lang,
  formatMoneyFn
}: {
  slip: Payslip
  settings: CompanySettings
  lang: string
  formatMoneyFn: (minor: number) => string
}): string {
  const hours = (slip.workedMinutes / 60).toFixed(1)
  const baseFormatted = formatMoneyFn(slip.baseSalaryMinor)
  const overtimeFormatted = formatMoneyFn(slip.overtimeAmountMinor)
  const bonusesFormatted = formatMoneyFn(slip.bonusesMinor)
  const deductionsFormatted = formatMoneyFn(slip.deductionsMinor)
  const netFormatted = formatMoneyFn(slip.netAmountMinor)

  if (lang === "en") {
    return [
      `🏢 *${settings.companyName}*`,
      `📋 *Salary Payslip Notice*`,
      `━━━━━━━━━━━━━━━━━━`,
      `👤 Employee: ${slip.employeeName}`,
      `🆔 Code: ${slip.employeeCode}`,
      `🏢 Department: ${slip.department || "General"}`,
      `🗓️ Period: ${slip.periodStart} ~ ${slip.periodEnd}`,
      `⏱️ Work Days: ${slip.workedDays} days (${hours} hrs)`,
      `━━━━━━━━━━━━━━━━━━`,
      `💵 Base Salary: ${baseFormatted}`,
      slip.overtimeAmountMinor > 0 ? `⏱️ Overtime: +${overtimeFormatted}` : null,
      slip.bonusesMinor > 0 ? `🎁 Bonuses: +${bonusesFormatted}` : null,
      slip.deductionsMinor > 0 ? `🔻 Deductions: -${deductionsFormatted}` : null,
      `━━━━━━━━━━━━━━━━━━`,
      `💰 *Net Payable: ${netFormatted}*`,
      `📅 Payment Date: ${slip.paymentDate}`,
      `━━━━━━━━━━━━━━━━━━`,
      `Best regards, Management`
    ].filter(Boolean).join("\n")
  }

  if (lang === "fa") {
    return [
      `🏢 *${settings.companyName}*`,
      `📋 *فیش حقوق و دستمزد ماهانه*`,
      `━━━━━━━━━━━━━━━━━━`,
      `👤 کارمند: ${slip.employeeName}`,
      `🆔 کد پرسنلی: ${slip.employeeCode}`,
      `🏢 بخش: ${slip.department || "عمومی"}`,
      `🗓️ دوره: ${slip.periodStart} تا ${slip.periodEnd}`,
      `⏱️ کارکرد: ${slip.workedDays} روز (${hours} ساعت)`,
      `━━━━━━━━━━━━━━━━━━`,
      `💵 حقوق پایه: ${baseFormatted}`,
      slip.overtimeAmountMinor > 0 ? `⏱️ اضافه‌کاری: +${overtimeFormatted}` : null,
      slip.bonusesMinor > 0 ? `🎁 پاداش و مزایا: +${bonusesFormatted}` : null,
      slip.deductionsMinor > 0 ? `🔻 کسورات: -${deductionsFormatted}` : null,
      `━━━━━━━━━━━━━━━━━━`,
      `💰 *مبلغ خالص پرداختی: ${netFormatted}*`,
      `📅 تاریخ پرداخت: ${slip.paymentDate}`,
      `━━━━━━━━━━━━━━━━━━`,
      `با تشکر و احترام، مدیریت مجموعه`
    ].filter(Boolean).join("\n")
  }

  return [
    `🏢 *${settings.companyName}*`,
    `📋 *إشعار كشف الراتب الشهري*`,
    `━━━━━━━━━━━━━━━━━━`,
    `👤 الموظف: ${slip.employeeName}`,
    `🆔 الرقم الوظيفي: ${slip.employeeCode}`,
    `🏢 القسم: ${slip.department || "عام"}`,
    `🗓️ الفترة: ${slip.periodStart} إلى ${slip.periodEnd}`,
    `⏱️ أيام الدوام: ${slip.workedDays} يوم (${hours} ساعة)`,
    `━━━━━━━━━━━━━━━━━━`,
    `💵 الراتب الأساسي: ${baseFormatted}`,
    slip.overtimeAmountMinor > 0 ? `⏱️ الإضافي: +${overtimeFormatted}` : null,
    slip.bonusesMinor > 0 ? `🎁 البدلات والمكافآت: +${bonusesFormatted}` : null,
    slip.deductionsMinor > 0 ? `🔻 الاستقطاعات: -${deductionsFormatted}` : null,
    `━━━━━━━━━━━━━━━━━━`,
    `💰 *صافي الراتب المستحق: ${netFormatted}*`,
    `📅 تاريخ الصرف: ${slip.paymentDate}`,
    `━━━━━━━━━━━━━━━━━━`,
    `مع تحيات الإدارة العامة`
  ].filter(Boolean).join("\n")
}

export function openWhatsAppPayslip({
  phone,
  message
}: {
  phone: string
  message: string
}): boolean {
  const validPhone = cleanPhoneNumber(phone)
  if (!validPhone) return false

  const url = `https://wa.me/${validPhone}?text=${encodeURIComponent(message)}`
  window.open(url, "_blank")
  return true
}
