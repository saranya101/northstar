import { describe, expect, it, vi } from 'vitest'
import {
  requestCompletionNotificationPermission,
  showCompletionNotification,
} from '../app/utils/focus-effects.client.js'

describe('focus completion notifications', () => {
  it('does not request permission until called by a user action', async () => {
    const requestPermission = vi.fn().mockResolvedValue('granted')
    const NotificationApi = { permission: 'default', requestPermission }
    expect(requestPermission).not.toHaveBeenCalled()
    await requestCompletionNotificationPermission(NotificationApi)
    expect(requestPermission).toHaveBeenCalledOnce()
  })

  it('notification denial does not break the timer flow', async () => {
    const NotificationApi = {
      permission: 'default',
      requestPermission: vi.fn().mockRejectedValue(new Error('denied')),
    }
    await expect(requestCompletionNotificationPermission(NotificationApi)).resolves.toBe('denied')
  })

  it('silently skips notifications without permission', () => {
    function NotificationApi() {
      throw new Error('must not construct')
    }
    NotificationApi.permission = 'denied'
    expect(showCompletionNotification({ title: 'Done' }, NotificationApi)).toBe(false)
  })
})
