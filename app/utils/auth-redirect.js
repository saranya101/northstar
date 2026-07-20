const DEFAULT_AUTH_REDIRECT = '/app'

export function safeLocalRedirect(value, fallback = DEFAULT_AUTH_REDIRECT) {
  if (typeof value !== 'string') {
    return fallback
  }

  const destination = value.trim()

  if (
    !destination.startsWith('/')
    || destination.startsWith('//')
    || destination.includes('\\')
    || /[\u0000-\u001F\u007F]/.test(destination)
  ) {
    return fallback
  }

  return destination
}
