import { describe, expect, it } from 'vitest'
import { loginSchema, signupSchema, validationErrors } from '../app/utils/auth-validation'

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

  it('maps validation messages to their form fields', () => {
    const errors = validationErrors(loginSchema.safeParse({
      email: 'invalid',
      password: 'short'
    }))

    expect(errors).toEqual({
      email: 'Enter a valid email address.',
      password: 'Password must be at least 8 characters.'
    })
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

  it('requires password confirmation', () => {
    const result = signupSchema.safeParse({
      ...validSignup,
      confirmPassword: ''
    })

    expect(result.success).toBe(false)
    expect(result.error.issues.some(issue => issue.path[0] === 'confirmPassword')).toBe(true)
  })
})
