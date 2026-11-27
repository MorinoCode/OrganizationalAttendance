import { describe, expect, it } from "vitest"
import { KNOWLEDGE_BASE, queryAIAssistant } from "../src/renderer/services/aiKnowledge"

describe("AI Knowledge Base & Assistant", () => {
  it("contains all 12 core system topics with complete translations", () => {
    expect(KNOWLEDGE_BASE.length).toBe(12)
    for (const item of KNOWLEDGE_BASE) {
      expect(item.id).toBeTruthy()
      expect(item.keywords.length).toBeGreaterThan(3)
      expect(item.fa.question).toBeTruthy()
      expect(item.fa.answer).toBeTruthy()
      expect(item.ar.question).toBeTruthy()
      expect(item.ar.answer).toBeTruthy()
      expect(item.en.question).toBeTruthy()
      expect(item.en.answer).toBeTruthy()
    }
  })

  it("responds in Arabic when lang is ar", () => {
    const greeting = queryAIAssistant("مرحبا", "ar")
    expect(greeting.answer).toContain("المساعد الذكي")

    const shifts = queryAIAssistant("هل يمكن تسجيل ورديتين في اليوم؟", "ar")
    expect(shifts.matchedTopic).toBe("multiple_shifts")
    expect(shifts.answer).toContain("ورديات متعددة")

    const whatsapp = queryAIAssistant("كيف ارسل الراتب عبر واتساب؟", "ar")
    expect(whatsapp.matchedTopic).toBe("whatsapp_payslip")
    expect(whatsapp.answer).toContain("واتساب")
  })

  it("responds in Persian when lang is fa", () => {
    const greeting = queryAIAssistant("سلام", "fa")
    expect(greeting.answer).toContain("دستیار هوشمند")

    const shifts = queryAIAssistant("چند شیفت در روز چگونه ثبت میشود؟", "fa")
    expect(shifts.matchedTopic).toBe("multiple_shifts")
    expect(shifts.answer).toContain("چند شیفت در یک روز")

    const leaves = queryAIAssistant("مرخصی بدون حقوق چطور محاسبه میشود؟", "fa")
    expect(leaves.matchedTopic).toBe("leave_management")
    expect(leaves.answer).toContain("مرخصی")
  })

  it("responds in English when lang is en", () => {
    const greeting = queryAIAssistant("hello", "en")
    expect(greeting.answer).toContain("AI Assistant")

    const backup = queryAIAssistant("how do offline backups work?", "en")
    expect(backup.matchedTopic).toBe("offline_security_backup")
    expect(backup.answer).toContain("Local-First")

    const correction = queryAIAssistant("how to edit punch in and out times?", "en")
    expect(correction.matchedTopic).toBe("attendance_correction")
    expect(correction.answer).toContain("correction modal")
  })

  it("honors user selected language even if prompt is in another language", () => {
    const resAr = queryAIAssistant("چند شیفت در روز", "ar")
    expect(resAr.matchedTopic).toBe("multiple_shifts")
    expect(resAr.answer).toContain("ورديات متعددة")

    const resFa = queryAIAssistant("how do split shifts work?", "fa")
    expect(resFa.matchedTopic).toBe("multiple_shifts")
    expect(resFa.answer).toContain("چند شیفت")
  })

  it("returns helpful fallback guidance in selected language when query does not match", () => {
    const resFa = queryAIAssistant("xyz obscure query", "fa")
    expect(resFa.answer).toContain("ثبت تردد در کیوسک")
    expect(resFa.suggestions.length).toBeGreaterThan(0)

    const resAr = queryAIAssistant("xyz obscure query", "ar")
    expect(resAr.answer).toContain("تسجيل الحضور في الكشك")
    expect(resAr.suggestions.length).toBeGreaterThan(0)

    const resEn = queryAIAssistant("xyz obscure query", "en")
    expect(resEn.answer).toContain("Kiosk Punching")
    expect(resEn.suggestions.length).toBeGreaterThan(0)
  })
})
