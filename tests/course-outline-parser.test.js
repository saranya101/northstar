import { describe, expect, it } from 'vitest'
import { parseCourseOutline } from '../shared/academic/course-outline-parser'

const item = (text, x, y, width = null) => ({ text, x, y, width })
const withLayout = (text, pages) => `${text}
[[COURSE_OUTLINE_LAYOUT_V1]]
${JSON.stringify(pages)}
[[/COURSE_OUTLINE_LAYOUT_V1]]`

const fragmentedAssessmentPage = {
  pageNumber: 2,
  items: [
    item('Course Assessment', 48, 687),
    item('Component', 58, 598), item('ILO Tested', 146, 598), item('Weighting', 308, 598),
    item('Team/Indivi', 391, 607), item('dual', 391, 590), item('Assessment', 474, 647), item('Rubrics', 486, 630),
    item('Class', 58, 513), item('Participatio', 58, 496), item('n', 58, 479),
    item('1, 2, 3, 4', 141, 496), item('15', 308, 496), item('Individual', 391, 496), item('See Rubric', 474, 505), item('1', 474, 488),
    item('LAMS', 58, 443), item('Attempts', 58, 426), item('(Online', 58, 409), item('MCQ &', 58, 392), item('Short', 58, 375), item('Answers)', 58, 359),
    item('1, 2, 3, 4', 141, 401), item('10', 308, 401), item('Individual', 391, 401), item('LAMS', 474, 409), item('Attempts', 474, 392),
    item('Online Final', 58, 322), item('Exam', 58, 305), item('conducted', 58, 288), item('via', 58, 271), item('NTULearn', 58, 254),
    item('1, 2, 3,4', 141, 288), item('45', 308, 288), item('Individual', 391, 288), item('See Rubric', 474, 296), item('2', 474, 280),
    item('Presentatio', 58, 209), item('n', 58, 192),
    item('1, 2, 3, 4', 141, 201), item('15', 308, 201), item('Individual', 391, 201), item('See Rubric', 474, 209), item('4', 474, 192),
    item('Group', 58, 122), item('Project', 58, 105),
    item('3, 4', 141, 114), item('15', 308, 114), item('Team', 391, 114), item('3', 419, 118), item('See Rubric', 474, 122), item('3, 5', 474, 105),
    item('Total', 58, 43), item('100%', 141, 43)
  ]
}

const ab1201SummaryPage = {
  pageNumber: 2,
  items: [
    item('D) Assessment (includes both continuous and summative assessment)', 72, 574),
    item('Component', 77, 547), item('ILO', 171, 547), item('NBS Learning Goal', 212, 547), item('Weightage', 311, 547), item('Team/', 375, 547), item('Assessment Rubrics', 443, 547),
    item('1. Class', 77, 495), item('Participation', 87, 482), item('ILO1, ILO5', 162, 495), item('Oral communication', 205, 495), item('10%', 329, 495), item('Individual', 375, 495), item('Class Participation Rubric 1', 443, 495),
    item('2. Group Project', 77, 456), item('Presentation', 77, 443), item('ILO1, ILO4, ILO5', 162, 456), item('Teamwork and Interpersonal skills', 212, 456), item('10%', 329, 456), item('Group', 375, 456), item('Rubric 2', 443, 456),
    item('Oral communication', 212, 351), item('10%', 329, 328), item('Individual', 375, 328), item('Presentation Rubric 3', 443, 351),
    item('3. Quiz', 77, 302), item('ILO1, ILO3, ILO5', 162, 302), item('Acquisition of knowledge', 212, 302), item('20%', 329, 302), item('Individual', 375, 302),
    item('4. Final', 77, 263), item('Examination', 77, 250), item('ILO1, ILO2, ILO3, ILO5', 162, 263), item('Acquisition of knowledge', 212, 263), item('50%', 329, 263), item('Individual', 375, 263),
    item('Total', 77, 211), item('100%', 162, 211), item('2', 303, 46)
  ]
}

const ab1201SchedulePage = {
  pageNumber: 6,
  items: [
    item('K) Planned Weekly Schedule', 72, 696),
    item('Week', 78, 668), item('Topic', 127, 668), item('ILO', 302, 668), item('Readings/ Activities', 410, 668),
    ...Array.from({ length: 13 }, (_, index) => {
      const week = index + 1
      const y = 650 - index * 28
      const topic = week === 8 ? 'The Cost of Capital Common Quiz on Tue, 7pm - 8pm' : week === 13 ? 'Revision/Course Wrap Up' : `Finance topic ${week}`
      return [item(String(week), 94, y), item(topic, 127, y), item(`ILO${Math.min(week, 8)}`, 302, y), item(`C${week}`, 410, y)]
    }).flat(),
    item('RECESS WEEK', 240, 438), item('FINAL EXAMINATION', 245, 270)
  ]
}

const ab1201Outline = withLayout(`
Academic Year 2026 - 2027 Semester 1
Course Coordinator Nick Orlic
Course Code AB1201
Course Title Financial Management
No of AUs 3
D) Assessment (includes both continuous and summative assessment)
Detail for Assessment Components
1) Class Participation (individual, 10%)
Participation is assessed throughout the semester and refers to Rubric 1.
2) Group Project Presentation (Group - 10%; Individual Presentation - 10%)
Group slides are assessed as group work while delivery is assessed as an individual presentation.
3) Quiz (Individual, 20%)
The quiz is held on Tuesday of Week 8 at 7pm to 8pm. It is closed book and conducted on NTULearn with LockDown Browser.
5) Final examination (Individual, 50%)
The final examination is conducted physically, with pen and paper. It is closed book.
E) Formative Feedback
Rubrics
Presentation Rubric 50
ILO4 Oral communication 10
`, [ab1201SummaryPage, ab1201SchedulePage])

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

  it('reconstructs a fragmented assessment table without treating table noise as weights', () => {
    const result = parseCourseOutline(withLayout('Course Assessment\nClass Participatio n\nTotal 100%', [fragmentedAssessmentPage]))
    expect(result.assessments.map(candidate => candidate.name.value)).toEqual([
      'Class Participation',
      'LAMS Attempts (Online MCQ & Short Answers)',
      'Online Final Exam conducted via NTULearn',
      'Presentation',
      'Group Project'
    ])
    expect(result.assessments.map(candidate => candidate.weight.value)).toEqual([15, 10, 45, 15, 15])
    expect(result.assessments.map(candidate => candidate.groupAssessment.value)).toEqual([false, false, false, false, true])
    expect(result.assessments.reduce((sum, candidate) => sum + candidate.weight.value, 0)).toBe(100)
    expect(result.assessments.every(candidate => candidate.name.value !== 'Total')).toBe(true)
    expect(result.assessments.every(candidate => candidate.name.pageNumber === 2)).toBe(true)
    expect(result.assessments[0].name.sourceExcerpt).toContain('Class')
    expect(result.assessments).toHaveLength(5)
    expect(result.assessments.every(candidate => candidate.examFormat.value !== 'Oral')).toBe(true)
  })

  it('prefers the main summary table and does not create assessments from details or rubrics', () => {
    const result = parseCourseOutline(ab1201Outline)
    expect(result.assessments).toHaveLength(5)
    expect(result.assessments.every(candidate => !/rubric/i.test(candidate.name.value))).toBe(true)
    expect(result.assessments.reduce((total, candidate) => total + candidate.weight.value, 0)).toBe(100)
    expect(parseCourseOutline('Rubrics\nPresentation Rubric 50%\nILO4 Oral communication 10%').assessments).toEqual([])
  })

  it('keeps separately weighted group and individual components as editable rows', () => {
    const result = parseCourseOutline(ab1201Outline)
    expect(result.assessments.map(candidate => ({
      name: candidate.name.value,
      weight: candidate.weight.value,
      type: candidate.type.value,
      group: candidate.groupAssessment.value
    }))).toEqual([
      { name: 'Class Participation', weight: 10, type: 'CLASS_PARTICIPATION', group: false },
      { name: 'Group Project Presentation — Group component', weight: 10, type: 'GROUP_ASSIGNMENT', group: true },
      { name: 'Group Project Presentation — Individual presentation component', weight: 10, type: 'PRESENTATION', group: false },
      { name: 'Quiz', weight: 20, type: 'QUIZ', group: false },
      { name: 'Final Examination', weight: 50, type: 'FINAL_EXAMINATION', group: false }
    ])
  })

  it('uses explicit exam evidence instead of learning-goal text', () => {
    const result = parseCourseOutline(ab1201Outline)
    const participation = result.assessments[0]
    const presentation = result.assessments[2]
    const quiz = result.assessments[3]
    const examination = result.assessments[4]
    expect(participation.examFormat.value).toBeNull()
    expect(presentation.examFormat.value).toBeNull()
    expect(quiz.examFormat.value).toBe('closed-book, Online')
    expect(examination.examFormat.value).toBe('closed-book, Physical, Pen-and-paper')
  })

  it('extracts AB1201 module metadata and all thirteen teaching weeks', () => {
    const result = parseCourseOutline(ab1201Outline)
    const facts = Object.fromEntries(result.facts.map(fact => [fact.fieldName, fact.value]))
    expect(facts).toMatchObject({
      moduleCode: 'AB1201',
      moduleTitle: 'Financial Management',
      academicYear: '2026–2027',
      semesterLabel: 'Semester 1',
      lecturer: 'Nick Orlic',
      academicUnits: '3'
    })
    expect(result.weeks.map(week => week.weekNumber)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13])
    expect(result.weeks.some(week => /RECESS|FINAL EXAMINATION/i.test(week.topic || ''))).toBe(false)
  })

  it('retains week-based quiz timing without inventing a calendar date', () => {
    const result = parseCourseOutline(ab1201Outline)
    const quiz = result.assessments.find(candidate => candidate.type.value === 'QUIZ')
    const weekEight = result.weeks.find(week => week.weekNumber === 8)
    expect(quiz.instructions.value).toBe('Tuesday of Week 8; 7:00 PM–8:00 PM')
    expect(quiz.officialDeadline.value).toBeNull()
    expect(quiz.eventDate.value).toBeNull()
    expect(weekEight.importantDate).toBe('Tue; 7:00 PM–8:00 PM')
  })

  it('carries inferred table columns across page boundaries', () => {
    const firstPage = {
      pageNumber: 3,
      items: [
        item('Grading Scheme', 40, 760),
        item('Component', 50, 700), item('Learning outcome', 180, 700), item('Weight', 330, 700), item('Mode', 420, 700),
        item('Individual Essay', 50, 620), item('1, 2', 180, 620), item('30', 330, 620), item('Individual', 420, 620),
        item('Team Project', 50, 530), item('3, 4', 180, 530), item('40', 330, 530), item('Team', 420, 530)
      ]
    }
    const secondPage = {
      pageNumber: 4,
      items: [
        item('Final Examination', 50, 730), item('1, 2, 3, 4', 180, 730), item('30', 330, 730), item('Individual', 420, 730),
        item('Total', 50, 640), item('100%', 180, 640)
      ]
    }
    const result = parseCourseOutline(withLayout('Grading Scheme\nIndividual Essay\nTeam Project\nFinal Examination\nTotal 100%', [firstPage, secondPage]))
    expect(result.assessments.map(candidate => candidate.name.value)).toEqual(['Individual Essay', 'Team Project', 'Final Examination'])
    expect(result.assessments.map(candidate => candidate.name.pageNumber)).toEqual([3, 3, 4])
  })

  it('supports pasted lists, OCR-style fragments, paragraphs and unresolved fields', () => {
    const pasted = parseCourseOutline(`Assessment Components
- Reflection journal
- Group Project | 40%
The final examination accounts for 50% of the grade.
References`)
    expect(pasted.assessments.map(candidate => candidate.weight.value)).toEqual([null, 40, 50])
    expect(pasted.warnings).toContain('Assessment weights are incomplete.')
    expect(pasted.assessments[0].officialDeadline.value).toBeNull()

    const ocr = parseCourseOutline(`Modes of Assessment
Presentatio n | 25%
Presentatio n | 25%
Indivi dual Quiz | 20%
Readings`)
    expect(ocr.assessments.map(candidate => candidate.name.value)).toEqual(['Presentation', 'Individual Quiz'])
    expect(ocr.assessments).toHaveLength(2)
  })
})
