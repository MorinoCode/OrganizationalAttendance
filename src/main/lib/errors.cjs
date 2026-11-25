"use strict"

class AppError extends Error {
  constructor(code, message, details) {
    super(message || code)
    this.name = "AppError"
    this.code = code
    if (details !== undefined) this.details = details
  }
}

function appError(code, message, details) {
  return new AppError(code, message, details)
}

function toErrorPayload(error) {
  if (error instanceof AppError) {
    return { code: error.code, message: error.message, details: error.details }
  }
  const message = error instanceof Error ? error.message : String(error)
  return { code: "internal_error", message }
}

module.exports = { AppError, appError, toErrorPayload }
