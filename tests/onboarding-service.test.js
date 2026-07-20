import { describe, expect, it, vi } from 'vitest'

vi.mock('../server/utils/prisma', () => ({ prisma: {} }))

import { completeOnboarding, saveSemester, validateAcademicRelationships } from '../server/services/onboarding'

describe('academic reference ownership', () => {
  it('rejects a school from another university', () => {
    expect(() => validateAcademicRelationships(
      { school: { universityId: 'other' }, programme: { schoolId: 's1' } },
      { universityId: 'u1', schoolId: 's1' }
    )).toThrowError(expect.objectContaining({ statusCode: 400 }))
  })

  it('rejects a programme from another school', () => {
    expect(() => validateAcademicRelationships(
      { school: { universityId: 'u1' }, programme: { schoolId: 'other' } },
      { universityId: 'u1', schoolId: 's1' }
    )).toThrowError(expect.objectContaining({ statusCode: 400 }))
  })
})

function completionDatabase(records) {
  const update = vi.fn()
  const transaction = {
    profile: { findUnique: vi.fn().mockResolvedValue(records.profile), update },
    userAcademicProfile: { findUnique: vi.fn().mockResolvedValue(records.academicProfile) },
    userSemester: { findFirst: vi.fn().mockResolvedValue(records.activeSemester) },
    studyPreference: { findUnique: vi.fn().mockResolvedValue(records.studyPreference) }
  }
  return { database: { $transaction: callback => callback(transaction) }, update }
}

describe('onboarding completion', () => {
  it('fails when required records are missing', async () => {
    const { database } = completionDatabase({ profile: {}, academicProfile: null, activeSemester: {}, studyPreference: {} })
    await expect(completeOnboarding('user-1', database)).rejects.toMatchObject({ statusCode: 409 })
  })

  it('marks onboarding complete when every record exists', async () => {
    const { database, update } = completionDatabase({ profile: {}, academicProfile: {}, activeSemester: {}, studyPreference: {} })
    await expect(completeOnboarding('user-1', database)).resolves.toEqual({ redirectTo: '/app' })
    expect(update).toHaveBeenCalledWith({ where: { userId: 'user-1' }, data: { onboardingCompleted: true, onboardingStep: 6 } })
  })
})

describe('active semester transaction', () => {
  it('deactivates existing semesters before activating the selected term', async () => {
    const updateMany = vi.fn().mockResolvedValue({ count: 1 })
    const upsert = vi.fn().mockResolvedValue({ id: 'semester-2' })
    const transaction = {
      userAcademicProfile: { findUnique: vi.fn().mockResolvedValue({ universityId: 'u1' }) },
      academicTerm: { findFirst: vi.fn().mockResolvedValue({ id: 'term-2', universityId: 'u1' }) },
      userSemester: { updateMany, upsert },
      profile: { upsert: vi.fn(), updateMany: vi.fn() }
    }
    const database = { $transaction: callback => callback(transaction) }

    await saveSemester('user-1', { academicTermId: 'term-2', targetSemesterGpa: 4.5 }, database)

    expect(updateMany).toHaveBeenCalledWith({ where: { userId: 'user-1', isActive: true }, data: { isActive: false } })
    expect(upsert).toHaveBeenCalledWith(expect.objectContaining({ update: expect.objectContaining({ isActive: true }) }))
  })
})
