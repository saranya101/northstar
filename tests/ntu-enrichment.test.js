import { describe, expect, it, vi } from 'vitest'
import { createNtuCourseEnrichmentService, isAllowedNtuPublicUrl, parseNtuPublicCourseContentPage, parseNtuPublicCoursePage } from '../server/services/ntu-course-enrichment'
import { timetableModuleCandidateSchema } from '../shared/schemas/timetable'

const input = { code: 'AB1501', academicYear: '2026/27', semester: 'Semester 1', importedTitle: 'Marketing' }
const html = '<table><tr><td>AB1501</td><td>MARKETING*</td><td>3.0 AU</td></tr></table>'
const response = (body = html, status = 200) => ({ status, ok: status >= 200 && status < 300, text: vi.fn().mockResolvedValue(body) })

describe('public NTU enrichment', () => {
  it('extracts public title and academic units', () => expect(parseNtuPublicCoursePage(html, 'AB1501')).toMatchObject({ title: 'MARKETING', academicUnits: 3 }))

  it('extracts optional public course-content metadata with field provenance', async () => {
    const content = '<div>AB1501</div><div>Course Description</div><div>Foundations of marketing.</div><div>Grading Basis: Letter graded</div><div>School: Nanyang Business School</div>'
    expect(parseNtuPublicCourseContentPage(content, 'AB1501')).toMatchObject({ description: 'Foundations of marketing.', gradingBasis: 'Letter graded', school: 'Nanyang Business School' })
    const fetchImpl = vi.fn().mockResolvedValueOnce(response()).mockResolvedValueOnce(response(content))
    const service = createNtuCourseEnrichmentService({ fetchImpl, cache: new Map(), pending: new Map() })
    const enrichment = await service.enrich(input)
    expect(enrichment).toMatchObject({ description: 'Foundations of marketing.', fieldProvenance: { description: { sourceType: 'NTU_CONTENT_OF_COURSES' } } })
    expect(timetableModuleCandidateSchema.safeParse({
      candidateId: 'AB1501', code: 'AB1501', title: null, academicUnits: null, indexNumber: null, courseType: null,
      confidence: 0.9, selected: true, sessions: [], publicEnrichment: {
        title: enrichment.title, academicUnits: enrichment.academicUnits, description: enrichment.description,
        gradingBasis: enrichment.gradingBasis, school: enrichment.school, officialUrl: enrichment.officialUrl,
        fieldProvenance: enrichment.fieldProvenance, verificationStatus: enrichment.verificationStatus
      }
    }).success).toBe(true)
  })

  it('falls back gracefully when public enrichment is unavailable', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(response('', 404))
    const service = createNtuCourseEnrichmentService({ fetchImpl, cache: new Map(), pending: new Map() })
    await expect(service.enrich(input)).resolves.toMatchObject({ available: false })
  })

  it('flags a public title mismatch without overwriting imported sessions', async () => {
    const service = createNtuCourseEnrichmentService({ fetchImpl: vi.fn().mockResolvedValue(response()), cache: new Map(), pending: new Map() })
    const imported = { title: 'Different imported title', sessions: [{ groupLabel: '1', venue: 'LT26' }] }
    const result = await service.enrich({ ...input, importedTitle: imported.title })
    expect(result.verificationStatus).toBe('PUBLIC_SOURCE_CONFLICT')
    expect(imported.sessions).toEqual([{ groupLabel: '1', venue: 'LT26' }])
    expect(result).not.toHaveProperty('sessions')
  })

  it('deduplicates and caches repeated requests', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(response())
    const service = createNtuCourseEnrichmentService({ fetchImpl, cache: new Map(), pending: new Map() })
    const [first, second] = await Promise.all([service.enrich(input), service.enrich(input)])
    const third = await service.enrich(input)
    expect(first.available && second.available && third.available).toBe(true)
    expect(fetchImpl).toHaveBeenCalledTimes(2)
  })

  it('never follows or allowlists authenticated NTU URLs', async () => {
    expect(isAllowedNtuPublicUrl('https://www.ntu.edu.sg/studentlink/login')).toBe(false)
    expect(isAllowedNtuPublicUrl('https://wish.wis.ntu.edu.sg/webexe/owa/aus_schedule.main_display1')).toBe(true)
    expect(isAllowedNtuPublicUrl('https://wish.wis.ntu.edu.sg/webexe/owa/aus_subj_cont2.main')).toBe(true)
    const fetchImpl = vi.fn().mockResolvedValue({ status: 302, ok: false, headers: { get: () => 'https://www.ntu.edu.sg/studentlink/login' } })
    const service = createNtuCourseEnrichmentService({ fetchImpl, cache: new Map(), pending: new Map() })
    await expect(service.enrich(input)).resolves.toMatchObject({ available: false })
    expect(fetchImpl).toHaveBeenCalledTimes(1)
    expect(fetchImpl.mock.calls[0][1]).toMatchObject({ redirect: 'manual' })
  })
})
