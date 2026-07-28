import { describe, expect, it } from 'vitest'
import { parseCourseOutline } from '../shared/academic/course-outline-parser'

const outline = `
Module Code: SC1001
Module Title: Systems in Context
Academic Units: 3
Academic Year: 2026/27
Semester: Semester 1
Lecturer: Avery Tan
Assessment 1: Group Project | 30% | due 12 October 2026 | Turnitin
Quiz | 20% | deadline 7 November 2026
Final Examination | 50% | exam date 1 December 2026 | closed-book | 120 minutes
Week 1: Foundations | Chapter 1 | Seminar
Week 2: Systems | Chapter 2 | Case activity | Quiz
`

describe('deterministic course outline parser', () => {
  it('extracts module facts and weekly rows in source order', () => {
    const result = parseCourseOutline(outline)
    expect(result.facts.find(item => item.fieldName === 'moduleCode')?.value).toBe('SC1001')
    expect(result.facts.find(item => item.fieldName === 'lecturer')?.value).toBe('Avery Tan')
    expect(result.weeks.map(item => item.weekNumber)).toEqual([1, 2])
    expect(result.weeks[0]).toMatchObject({ topic: 'Foundations', reading: 'Chapter 1', activity: 'Seminar' })
  })

  it('extracts multiple assessments, weights and group status', () => {
    const result = parseCourseOutline(outline)
    expect(result.assessments).toHaveLength(3)
    expect(result.assessments[0].name.value).toBe('Group Project')
    expect(result.assessments[0].type.value).toBe('GROUP_ASSIGNMENT')
    expect(result.assessments[0].weight.value).toBe(30)
    expect(result.assessments[0].groupAssessment.value).toBe(true)
  })

  it('keeps deadlines separate from exam dates', () => {
    const result = parseCourseOutline(outline)
    expect(result.assessments[0].officialDeadline.value).toContain('2026-10-12')
    expect(result.assessments[0].eventDate.value).toBeNull()
    expect(result.assessments[2].officialDeadline.value).toBeNull()
    expect(result.assessments[2].eventDate.value).toContain('2026-12-01')
  })

  it('extracts explicit exam format and duration without inference', () => {
    const exam = parseCourseOutline(outline).assessments[2]
    expect(exam.examFormat.value).toBe('closed-book')
    expect(exam.openBook.value).toBe(false)
    expect(exam.durationMinutes.value).toBe(120)
    expect(exam.instructions.value).toBeNull()
  })

  it('warns and leaves a date without a year unresolved', () => {
    const result = parseCourseOutline('Quiz | 10% | deadline 12 October')
    expect(result.assessments[0].officialDeadline.value).toBeNull()
    expect(result.warnings).toContain('A date has no year and was left unresolved.')
  })

  it('deduplicates identical candidates', () => {
    const line = 'Quiz | 10% | deadline 12 October 2026'
    expect(parseCourseOutline(`${line}\n${line}`).assessments).toHaveLength(1)
  })

  it('warns for historical sources and never invents unknown values', () => {
    const result = parseCourseOutline('Academic Year: 2024/25\nQuiz | 10%', { activeAcademicYear: '2026/27' })
    expect(result.historical).toBe(true)
    expect(result.warnings).toContain('The source appears historical or differs from the active semester.')
    expect(result.assessments[0].officialDeadline.value).toBeNull()
    expect(result.assessments[0].submissionUrl.value).toBeNull()
  })

  it('strips irrelevant HTML and preserves compact provenance excerpts', () => {
    const result = parseCourseOutline('<script>steal()</script><p>Quiz | 10% | deadline 12 October 2026</p>')
    expect(result.assessments).toHaveLength(1)
    expect(result.assessments[0].name.sourceExcerpt).not.toContain('steal')
  })
})
