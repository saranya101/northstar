import { timingSafeEqual } from 'node:crypto'

export function isAuthorizedCronRequest(authorizationHeader, secret) {
  if (
    typeof authorizationHeader !== 'string'
    || typeof secret !== 'string'
    || secret.length === 0
  ) {
    return false
  }

  const received = Buffer.from(authorizationHeader)
  const expected = Buffer.from(`Bearer ${secret}`)

  if (received.length !== expected.length) {
    return false
  }

  return timingSafeEqual(received, expected)
}
