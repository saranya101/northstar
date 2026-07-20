import { z } from 'zod'

const passwordSchema = z.string()
  .min(8, 'Password must be at least 8 characters.')
  .max(128, 'Password must be at most 128 characters.')

export const loginSchema = z.object({
  email: z.string().trim().email('Enter a valid email address.'),
  password: passwordSchema
})

export const signupSchema = z.object({
  name: z.string().trim().min(1, 'Enter your full name.'),
  email: z.string().trim().email('Enter a valid email address.'),
  password: passwordSchema,
  confirmPassword: z.string().min(1, 'Confirm your password.')
}).refine(({ password, confirmPassword }) => password === confirmPassword, {
  message: 'Passwords do not match.',
  path: ['confirmPassword']
})

export function firstValidationError(result) {
  return result.error?.issues?.[0]?.message ?? 'Check the form and try again.'
}

export function validationErrors(result) {
  if (result.success) {
    return {}
  }

  return result.error.issues.reduce((errors, issue) => {
    const field = issue.path[0]

    if (typeof field === 'string' && !errors[field]) {
      errors[field] = issue.message
    }

    return errors
  }, {})
}
