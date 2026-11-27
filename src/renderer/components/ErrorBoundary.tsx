import React, { Component, ErrorInfo, ReactNode } from "react"
import { AlertTriangle, Check, Copy, RefreshCw } from "lucide-react"

interface Props {
  children: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
  copied: boolean
  showDetails: boolean
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = {
      hasError: false,
      error: null,
      copied: false,
      showDetails: false
    }
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error("ErrorBoundary caught an unhandled error:", error, errorInfo)
  }

  private handleReload = (): void => {
    window.location.reload()
  }

  private handleCopy = async (): Promise<void> => {
    const errorText = `${this.state.error?.name || "Error"}: ${this.state.error?.message || "Unknown error"}\n\nStack:\n${this.state.error?.stack || "No stack trace available"}`
    try {
      await navigator.clipboard.writeText(errorText)
      this.setState({ copied: true })
      window.setTimeout(() => this.setState({ copied: false }), 2000)
    } catch {
      console.error("Failed to copy error to clipboard")
    }
  }

  private toggleDetails = (): void => {
    this.setState(prev => ({ showDetails: !prev.showDetails }))
  }

  render(): ReactNode {
    if (!this.state.hasError) {
      return this.props.children
    }

    const { error, copied, showDetails } = this.state

    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#060504] p-4 text-[#f4ece0]">
        <div className="panel w-full max-w-lg border border-[rgba(214,171,91,0.35)] bg-[rgba(18,16,13,0.95)] p-6 shadow-2xl backdrop-blur-md">
          <div className="flex items-center gap-3 border-b border-[color:var(--line)] pb-4">
            <div className="grid h-12 w-12 shrink-0 place-items-center rounded-xl border border-[rgba(239,68,68,0.35)] bg-[rgba(239,68,68,0.12)] text-red-400">
              <AlertTriangle className="h-6 w-6" aria-hidden />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-100">
                خطایی رخ داده است / حدث خطأ غیر متوقع
              </h2>
              <p className="mt-0.5 text-xs text-[#8d8275]">
                An unexpected application error occurred
              </p>
            </div>
          </div>

          <div className="mt-4 rounded-xl border border-red-500/20 bg-red-950/20 p-3 text-xs text-red-300">
            <p className="font-mono break-all font-semibold">
              {error?.name || "Error"}: {error?.message || "Unknown error"}
            </p>
          </div>

          <div className="mt-4 flex flex-wrap gap-2.5">
            <button
              type="button"
              onClick={this.handleReload}
              className="btn btn-primary flex flex-1 items-center justify-center gap-2"
            >
              <RefreshCw className="h-4 w-4" aria-hidden />
              <span>بارگذاری مجدد / إعادة التحميل</span>
            </button>

            <button
              type="button"
              onClick={this.handleCopy}
              className="btn btn-secondary flex items-center justify-center gap-2 px-4"
              title="کپی متن خطا / نسخ تفاصيل الخطأ"
            >
              {copied ? (
                <>
                  <Check className="h-4 w-4 text-emerald-400" aria-hidden />
                  <span className="text-xs text-emerald-400">کپی شد</span>
                </>
              ) : (
                <>
                  <Copy className="h-4 w-4" aria-hidden />
                  <span className="text-xs">کپی خطا</span>
                </>
              )}
            </button>
          </div>

          <div className="mt-4 border-t border-[color:var(--line)] pt-3">
            <button
              type="button"
              onClick={this.toggleDetails}
              className="text-[0.72rem] text-[#8d8275] transition-colors hover:text-[#e6c98a]"
            >
              {showDetails ? "▲ بستن جزئیات فنی" : "▼ مشاهده جزئیات فنی (Stack Trace)"}
            </button>

            {showDetails && error?.stack && (
              <pre className="custom-scrollbar mt-2 max-h-40 overflow-auto rounded-lg border border-slate-800 bg-[#090807] p-2.5 font-mono text-[0.65rem] text-slate-400 select-all">
                {error.stack}
              </pre>
            )}
          </div>
        </div>
      </div>
    )
  }
}
