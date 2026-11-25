export class ApiError extends Error {
  readonly code: string

  constructor(code: string, message = "") {
    super(message || code)
    this.name = "ApiError"
    this.code = code
  }
}

export function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError
}

export function errorKey(error: unknown): string {
  if (isApiError(error) && error.code) return `errors.${error.code}`
  return "errors.internal_error"
}
