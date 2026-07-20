import { describe, expect, it } from 'vitest'
import { loginSchema, signupSchema } from '../app/utils/auth-validation'

describe('login validation', () => {
  it('accepts a valid email and password and trims the email', () => {
    const result = loginSchema.parse({
      email: ' student@example.com ',
      password: ' password-is-not-trimmed '
    })

    expect(result.email).toBe('student@example.com')
    expect(result.password).toBe(' password-is-not-trimmed ')
  })

  it('rejects invalid email and short passwords', () => {
    expect(loginSchema.safeParse({ email: 'invalid', password: 'short' }).success).toBe(false)
  })
})

describe('signup validation', () => {
  const validSignup = {
    name: ' Student Name ',
    email: 'student@example.com',
    password: 'password123',
    confirmPassword: 'password123'
  }

  it('requires and trims the name', () => {
    expect(signupSchema.parse(validSignup).name).toBe('Student Name')
    expect(signupSchema.safeParse({ ...validSignup, name: '   ' }).success).toBe(false)
  })

  it('rejects a mismatched password confirmation', () => {
    const result = signupSchema.safeParse({
      ...validSignup,
      confirmPassword: 'different-password'
    })

    expect(result.success).toBe(false)
    expect(result.error.issues[0].path).toEqual(['confirmPassword'])
  })
})
