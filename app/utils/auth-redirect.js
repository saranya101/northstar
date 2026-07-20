const DEFAULT_AUTH_REDIRECT = '/app'
const LOOPING_AUTH_PATHS = new Set(['/login', '/signup', '/onboarding'])

export function safeLocalRedirect(value, fallback = DEFAULT_AUTH_REDIRECT, currentPath = '') {
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

  const destinationPath = destination.split(/[?#]/, 1)[0]
  if (LOOPING_AUTH_PATHS.has(destinationPath) || destination === currentPath || destinationPath === currentPath) {
    return fallback
  }

  return destination
}
