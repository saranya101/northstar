import { academicProposalResultSchema } from '../schemas/academic-intake.js'

const MODULE_CODE = /\b[A-Z]{2,6}\d{3,6}[A-Z]?\b/g
const weekReference = text => Number(/\bweek\s+(\d{1,2})\b/i.exec(text)?.[1]) || null
const weight = text => Number(/\b(\d+(?:\.\d+)?)\s*%/.exec(text)?.[1]) || null
const title = (text, fallback) => String(text).split(/[.!?\n]/)[0].trim().slice(0, 200) || fallback
const assessmentName = text => {
  const numberedQuiz = /\bquiz\s*(\d+)?\b/i.exec(text)
  if (numberedQuiz) return `Quiz${numberedQuiz[1] ? ` ${numberedQuiz[1]}` : ''}`
  if (/\bmid[ -]?term\b/i.test(text)) return 'Midterm'
  if (/\bexam(?:ination)?\b/i.test(text)) return 'Examination'
  if (/\btest\b/i.test(text)) return 'Test'
  return 'Assessment'
}
const expectedCount = text => Number(/\b(\d{1,2})\s+(?:expected\s+)?(?:occurrences?|weeks?|attempts?)\b/i.exec(text)?.[1]) || null

export function moduleCodesInText(text) {
  return [...new Set(String(text || '').toUpperCase().match(MODULE_CODE) || [])]
}

export function deterministicAcademicInterpretation(rawText, context = {}) {
  const text = String(rawText || '').trim()
  const lower = text.toLowerCase()
  const payloadBase = { sourceText: text, teachingWeek: weekReference(text) }
  let result
  if (/\b(quiz|midterm|test|exam|assessment)\b/i.test(text)) {
    const isExam = /\bexam(?:ination)?\b/i.test(text)
    const isUpdate = /\b(moved|changed|rescheduled|updated|postponed)\b/i.test(text)
    result = {
      category: isUpdate ? 'ASSESSMENT_UPDATE' : isExam ? 'EXAM_INFORMATION' : 'NEW_ASSESSMENT', moduleEnrolmentId: context.moduleEnrolmentId,
      clarificationReason: isUpdate ? 'Choose the existing assessment this update applies to.' : null,
      proposals: [{ actionType: isUpdate ? 'UPDATE_ASSESSMENT' : 'CREATE_ASSESSMENT', targetType: 'ASSESSMENT', payload: { ...payloadBase, name: assessmentName(text), type: isExam ? 'FINAL_EXAMINATION' : /\bmid[ -]?term\b/i.test(text) ? 'MIDTERM' : 'QUIZ', weight: weight(text), officialDeadline: null, instructions: text } }]
    }
  } else if (/\b(lams|coursework|tutorial preparation|seminar preparation|weekly assignment)\b/i.test(text)) {
    result = {
      category: 'COURSEWORK', moduleEnrolmentId: context.moduleEnrolmentId, clarificationReason: null,
      proposals: [{ actionType: 'CREATE_COURSEWORK', targetType: 'RECURRING_COURSEWORK', payload: { ...payloadBase, title: /\blams\b/i.test(text) ? 'LAMS' : title(text, 'Coursework'), type: /\blams\b/i.test(text) ? 'LAMS' : 'OTHER', frequency: 'WEEKLY', totalExpected: expectedCount(text), timingNote: /before\s+(?:class|seminar|tutorial)/i.exec(text)?.[0] || null } }]
    }
  } else if (/\b(complete|prepare|submit|read|revise|task|todo|to-do)\b/i.test(text)) {
    result = {
      category: 'TASK', moduleEnrolmentId: context.moduleEnrolmentId, clarificationReason: null,
      proposals: [{ actionType: 'CREATE_TASK', targetType: 'TASK', payload: { ...payloadBase, title: title(text, 'Academic task'), type: /\bread\b/i.test(text) ? 'READING' : /\brevise\b/i.test(text) ? 'REVISION' : 'STUDY', timingNote: /before\s+(?:class|seminar|tutorial)/i.exec(text)?.[0] || null, dueAt: null } }]
    }
  } else {
    result = { category: /\b(announc|notice|update)\b/i.test(lower) ? 'ANNOUNCEMENT' : 'GENERAL_NOTE', moduleEnrolmentId: context.moduleEnrolmentId, clarificationReason: null, proposals: [{ actionType: 'ADD_NOTE', targetType: 'MODULE_NOTE', payload: payloadBase }] }
  }
  return academicProposalResultSchema.parse(result)
}

export function createAcademicInterpreter(provider = null) {
  return {
    key: provider ? provider.key : 'deterministic-v1',
    async interpret(text, context) {
      if (provider) return academicProposalResultSchema.parse(await provider.interpret(text, context))
      return deterministicAcademicInterpretation(text, context)
    }
  }
}
