export interface FormattedDuration {
  display: string
  hours: number
  minutes: number
  decimalHours: number
  decimalText: string
}

export function formatWorkDuration(hours: number | undefined | null, lang: string = "fa"): FormattedDuration {
  if (hours === undefined || hours === null || isNaN(hours) || hours <= 0) {
    return {
      display: "0",
      hours: 0,
      minutes: 0,
      decimalHours: 0,
      decimalText: "0.00"
    }
  }

  const totalMinutes = Math.round(hours * 60)
  const h = Math.floor(totalMinutes / 60)
  const m = totalMinutes % 60
  const decimalText = hours.toFixed(2)

  let display = ""

  if (lang === "en") {
    if (h > 0 && m > 0) {
      display = `${h}h ${m}m`
    } else if (h > 0) {
      display = `${h}h`
    } else {
      display = `${m}m`
    }
  } else if (lang === "ar") {
    if (h > 0 && m > 0) {
      display = `${h} ساعة و ${m} دقيقة`
    } else if (h > 0) {
      display = `${h} ساعة`
    } else {
      display = `${m} دقيقة`
    }
  } else {
    if (h > 0 && m > 0) {
      display = `${h} ساعت و ${m} دقیقه`
    } else if (h > 0) {
      display = `${h} ساعت`
    } else {
      display = `${m} دقیقه`
    }
  }

  return {
    display,
    hours: h,
    minutes: m,
    decimalHours: hours,
    decimalText
  }
}

export function formatWorkDurationText(hours: number | undefined | null, lang: string = "fa"): string {
  const result = formatWorkDuration(hours, lang)
  if (result.display === "0") return "0"
  
  if (lang === "en") {
    return `${result.display} (${result.decimalText}h)`
  }
  if (lang === "ar") {
    return `${result.display} (${result.decimalText} س)`
  }
  return `${result.display} (${result.decimalText} ساعت)`
}
