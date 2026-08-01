let audioContext = null

export async function requestCompletionNotificationPermission(NotificationApi = globalThis.Notification) {
  try {
    if (!NotificationApi || typeof NotificationApi.requestPermission !== 'function') {
      return 'unsupported'
    }

    if (NotificationApi.permission === 'granted' || NotificationApi.permission === 'denied') {
      return NotificationApi.permission
    }

    return await NotificationApi.requestPermission()
  } catch {
    return 'denied'
  }
}

export function showCompletionNotification(
  { title = 'Focus timer complete', body = '' } = {},
  NotificationApi = globalThis.Notification,
) {
  try {
    if (!NotificationApi || NotificationApi.permission !== 'granted') return false
    const notification = new NotificationApi(title, {
      body,
      icon: '/favicon.ico',
      tag: 'northstar-focus-completion',
      renotify: false,
    })
    return Boolean(notification)
  } catch {
    return false
  }
}

export async function primeCompletionSound(AudioContextApi = globalThis.AudioContext || globalThis.webkitAudioContext) {
  try {
    if (!AudioContextApi) return false
    if (!audioContext || audioContext.state === 'closed') audioContext = new AudioContextApi()
    if (audioContext.state === 'suspended') await audioContext.resume()
    return true
  } catch {
    return false
  }
}

export async function playCompletionSound() {
  try {
    if (!audioContext || audioContext.state === 'closed') return false
    if (audioContext.state === 'suspended') await audioContext.resume()

    const now = audioContext.currentTime
    const oscillator = audioContext.createOscillator()
    const gain = audioContext.createGain()

    oscillator.type = 'sine'
    oscillator.frequency.setValueAtTime(660, now)
    oscillator.frequency.setValueAtTime(880, now + 0.12)
    gain.gain.setValueAtTime(0.0001, now)
    gain.gain.exponentialRampToValueAtTime(0.12, now + 0.02)
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.32)

    oscillator.connect(gain)
    gain.connect(audioContext.destination)
    oscillator.start(now)
    oscillator.stop(now + 0.34)
    return true
  } catch {
    return false
  }
}
