import React, { useEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { useTranslation } from "react-i18next"
import { Bot, RotateCcw, Send, Sparkles, User, X } from "lucide-react"

import { queryAIAssistant } from "../services/aiKnowledge"
import { Language } from "../types"

interface ChatMessage {
  id: string
  sender: "user" | "assistant"
  text: string
  time: string
  suggestions?: string[]
}

interface AIAssistantModalProps {
  isOpen: boolean
  onClose: () => void
}

export const AIAssistantModal: React.FC<AIAssistantModalProps> = ({ isOpen, onClose }) => {
  const { t, i18n } = useTranslation()
  const lang = (i18n.language || "fa") as Language

  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState("")
  const [isTyping, setIsTyping] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const currentTimeStr = () => {
    const now = new Date()
    return `${now.getHours().toString().padStart(2, "0")}:${now.getMinutes().toString().padStart(2, "0")}`
  }

  const defaultWelcomeMessage = (): ChatMessage => ({
    id: "welcome",
    sender: "assistant",
    text: t("ai.welcome"),
    time: currentTimeStr(),
    suggestions: [
      lang === "fa"
        ? "نحوه ثبت تردد و وقت استراحت پرسنل چگونه است؟"
        : lang === "ar"
          ? "كيف يتم تسجيل الحضور وأوقات الاستراحة؟"
          : "How do attendance and breaks work?",
      lang === "fa"
        ? "محاسبه حقوق و اضافه‌کاری چگونه انجام می‌شود؟"
        : lang === "ar"
          ? "كيف يتم احتساب الراتب والعمل الإضافي؟"
          : "How are salary and overtime calculated?",
      lang === "fa"
        ? "خروجی فایل اکسل شامل چه مواردی است؟"
        : lang === "ar"
          ? "ماذا يتضمن ملف تقرير Excel الصادر؟"
          : "What is included in the exported Excel spreadsheet?",
      lang === "fa"
        ? "امنیت داده‌ها و پشتیبان‌گیری آفلاین چگونه است؟"
        : lang === "ar"
          ? "ما هي معايير الأمان والنسخ الاحتياطي؟"
          : "How does offline data storage and backups work?"
    ]
  })

  useEffect(() => {
    if (!isOpen) return
    if (messages.length === 0) {
      setMessages([defaultWelcomeMessage()])
    }
    const timer = setTimeout(() => {
      inputRef.current?.focus()
    }, 100)
    return () => clearTimeout(timer)
  }, [isOpen])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages, isTyping])

  useEffect(() => {
    if (!isOpen) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose()
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [isOpen, onClose])

  const handleSend = (textToSend?: string) => {
    const prompt = (textToSend ?? input).trim()
    if (!prompt || isTyping) return

    const userMsg: ChatMessage = {
      id: `u-${Date.now()}`,
      sender: "user",
      text: prompt,
      time: currentTimeStr()
    }

    setMessages(prev => [...prev, userMsg])
    setInput("")
    setIsTyping(true)

    setTimeout(() => {
      const result = queryAIAssistant(prompt, lang)
      const assistantMsg: ChatMessage = {
        id: `a-${Date.now()}`,
        sender: "assistant",
        text: result.answer,
        time: currentTimeStr(),
        suggestions: result.suggestions
      }
      setMessages(prev => [...prev, assistantMsg])
      setIsTyping(false)
    }, 550)
  }

  const handleClear = () => {
    setMessages([defaultWelcomeMessage()])
  }

  if (!isOpen) return null

  const modal = (
    <div
      role="dialog"
      aria-modal="true"
      onClick={event => {
        if (event.target === event.currentTarget) onClose()
      }}
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-[rgba(6,5,4,0.78)] p-3 sm:p-5 backdrop-blur-md animate-in fade-in duration-200"
    >
      <div className="panel relative flex h-[min(46rem,calc(100vh-3rem))] w-[94vw] max-w-2xl flex-col overflow-hidden rounded-2xl border border-[rgba(214,171,91,0.38)] bg-[rgba(14,12,10,0.96)] shadow-[0_25px_70px_rgba(0,0,0,0.92),0_0_35px_rgba(214,171,91,0.18)]">
        <div className="h-[2px] w-full bg-gradient-to-r from-transparent via-[rgba(214,171,91,0.85)] to-transparent" />

        <div className="flex items-center justify-between border-b border-[color:var(--line)] bg-[rgba(20,17,14,0.7)] px-5 py-4">
          <div className="flex items-center gap-3">
            <span className="relative grid h-10 w-10 place-items-center rounded-xl border border-[rgba(214,171,91,0.4)] bg-[linear-gradient(135deg,rgba(214,171,91,0.22),rgba(214,171,91,0.04))] text-[#e6c98a] shadow-inner">
              <Sparkles className="h-5 w-5 animate-pulse text-[#ffe49e]" />
              <span className="absolute -bottom-0.5 -end-0.5 h-2.5 w-2.5 rounded-full border-2 border-[#0b0a08] bg-[#46c39f]" />
            </span>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold tracking-tight text-[#f8efd8]">{t("ai.title")}</h3>
                <span className="rounded-full border border-[rgba(70,195,159,0.35)] bg-[rgba(43,166,136,0.15)] px-2 py-0.5 text-[0.62rem] font-bold text-[#78dcbc]">
                  AI Agent
                </span>
              </div>
              <p className="mt-0.5 text-[0.68rem] text-[#9d9182]">{t("ai.subtitle")}</p>
            </div>
          </div>

          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={handleClear}
              className="rounded-lg p-2 text-[#8d8275] transition-colors hover:bg-[rgba(255,246,230,0.06)] hover:text-[#f4ece0]"
              title={t("ai.clearChat")}
            >
              <RotateCcw className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-2 text-[#8d8275] transition-colors hover:bg-[rgba(255,246,230,0.06)] hover:text-[#f4ece0]"
              aria-label={t("common.close")}
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto p-4 sm:p-5">
          {messages.map(msg => (
            <div
              key={msg.id}
              className={`flex flex-col ${msg.sender === "user" ? "items-end" : "items-start"}`}
            >
              <div className="flex items-start gap-2.5 max-w-[88%] sm:max-w-[82%]">
                {msg.sender === "assistant" && (
                  <span className="mt-1 grid h-7 w-7 shrink-0 place-items-center rounded-lg border border-[rgba(214,171,91,0.35)] bg-[rgba(214,171,91,0.14)] text-[#e6c98a]">
                    <Bot className="h-4 w-4" />
                  </span>
                )}

                <div
                  className={`rounded-2xl px-4 py-3 text-xs sm:text-sm leading-relaxed ${
                    msg.sender === "user"
                      ? "rounded-tr-sm border border-[rgba(214,171,91,0.4)] bg-[linear-gradient(135deg,#c4943b,#96681b)] font-medium text-[#140e04] shadow-md"
                      : "rounded-tl-sm border border-[rgba(255,246,230,0.1)] bg-[rgba(24,20,16,0.92)] text-[#ded4c5] shadow-sm"
                  }`}
                >
                  <p className="whitespace-pre-wrap">{msg.text}</p>
                  <span
                    className={`mt-1.5 block text-[0.62rem] font-mono ${
                      msg.sender === "user" ? "text-[#3f2905]" : "text-[#7b7063]"
                    }`}
                  >
                    {msg.time}
                  </span>
                </div>

                {msg.sender === "user" && (
                  <span className="mt-1 grid h-7 w-7 shrink-0 place-items-center rounded-lg border border-[rgba(255,246,230,0.15)] bg-[rgba(255,246,230,0.06)] text-[#c8beaf]">
                    <User className="h-4 w-4" />
                  </span>
                )}
              </div>

              {msg.suggestions && msg.suggestions.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-1.5 ps-9">
                  {msg.suggestions.map((suggestion, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => handleSend(suggestion)}
                      className="rounded-lg border border-[rgba(214,171,91,0.28)] bg-[rgba(214,171,91,0.06)] px-2.5 py-1 text-[0.7rem] font-medium text-[#e6c98a] transition-all hover:border-[rgba(214,171,91,0.6)] hover:bg-[rgba(214,171,91,0.15)] hover:text-[#fff3d1]"
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))}

          {isTyping && (
            <div className="flex items-start gap-2.5">
              <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg border border-[rgba(214,171,91,0.35)] bg-[rgba(214,171,91,0.14)] text-[#e6c98a]">
                <Bot className="h-4 w-4 animate-pulse" />
              </span>
              <div className="rounded-2xl rounded-tl-sm border border-[rgba(255,246,230,0.1)] bg-[rgba(24,20,16,0.92)] px-4 py-3 text-xs text-[#a89c8f]">
                <div className="flex items-center gap-1.5">
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[#d6ab5b]" />
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[#d6ab5b] [animation-delay:0.18s]" />
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[#d6ab5b] [animation-delay:0.36s]" />
                  <span className="ms-2 font-mono text-[0.68rem] text-[#8d8275]">{t("ai.thinking")}</span>
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        <div className="border-t border-[color:var(--line)] bg-[rgba(18,15,12,0.85)] p-3 sm:p-4">
          <form
            onSubmit={event => {
              event.preventDefault()
              handleSend()
            }}
            className="flex items-center gap-2"
          >
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={event => setInput(event.target.value)}
              placeholder={t("ai.placeholder")}
              className="flex-1 rounded-xl border border-[color:var(--line)] bg-[rgba(255,246,230,0.04)] px-4 py-2.5 text-xs sm:text-sm text-[#f4ece0] placeholder-[#7d7265] focus:border-[rgba(214,171,91,0.6)] focus:outline-none focus:ring-1 focus:ring-[rgba(214,171,91,0.3)]"
            />
            <button
              type="submit"
              disabled={!input.trim() || isTyping}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[linear-gradient(135deg,#d6ab5b,#b8862f)] text-[#1a1305] shadow-md transition-all hover:brightness-110 disabled:opacity-40"
              title={t("ai.send")}
            >
              <Send className="h-4 w-4" />
            </button>
          </form>
        </div>
      </div>
    </div>
  )

  if (typeof document !== "undefined") {
    return createPortal(modal, document.body)
  }
  return modal
}
