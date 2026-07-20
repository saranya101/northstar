const DEFAULT_AUTH_ERROR = 'Authentication failed. Please try again.'

export function normaliseAuthError(error, fallback = DEFAULT_AUTH_ERROR) {
  const code = String(error?.code ?? '').toUpperCase()
  const message = String(error?.message ?? '').toLowerCase()
  const status = Number(error?.status ?? 0)

  if (code.includes('USER_ALREADY_EXISTS') || message.includes('already exists')) {
    return 'An account with this email already exists.'
  }

  if (
    code.includes('INVALID_EMAIL_OR_PASSWORD')
    || code.includes('INVALID_CREDENTIALS')
    || message.includes('invalid email or password')
  ) {
    return 'Invalid email or password.'
  }

  if (code.includes('PASSWORD_TOO_SHORT') || message.includes('password') && message.includes('short')) {
    return 'Password must be at least 8 characters.'
  }

  if (status === 429 || code.includes('TOO_MANY_REQUESTS')) {
    return 'Too many attempts. Please wait and try again.'
  }

  return fallback
}
