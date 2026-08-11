export const CURRENT_SEMESTER_SEED = Object.freeze({
  academicYear: '2026/2027',
  termName: 'Semester 1',
  semesterNumber: 1,
  modules: [
    {
      code: 'AD1102', title: 'Financial Accounting', indexNumber: '01128', academicUnits: 3,
      sessions: [{ classType: 'SEMINAR', groupLabel: '14', dayOfWeek: 'FRIDAY', startMinutes: 810, endMinutes: 980, venue: 'S4-SR20', recurrence: 'WEEKLY', weekNumbers: [], deliveryMode: 'IN_PERSON' }],
      exam: { start: '2026-11-23T13:00:00+08:00', end: '2026-11-23T15:30:00+08:00' }
    },
    {
      code: 'HE5091', title: 'Principles of Economics', indexNumber: '01075', academicUnits: 3,
      sessions: [
        { classType: 'LECTURE', groupLabel: '2', dayOfWeek: 'MONDAY', startMinutes: 510, endMinutes: 620, venue: 'LT2A', recurrence: 'WEEKLY', weekNumbers: [], deliveryMode: 'IN_PERSON' },
        { classType: 'TUTORIAL', groupLabel: 'NBS16', dayOfWeek: 'MONDAY', startMinutes: 810, endMinutes: 860, venue: 'LHS-TR+44', recurrence: 'CUSTOM', weekNumbers: [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13], deliveryMode: 'IN_PERSON' }
      ],
      exam: { start: '2026-11-23T17:00:00+08:00', end: '2026-11-23T19:30:00+08:00' }
    },
    {
      code: 'AB0403', title: 'Decision Making With Programming & Analytics', indexNumber: '00462', academicUnits: 3,
      sessions: [{ classType: 'SEMINAR', groupLabel: '5', dayOfWeek: 'TUESDAY', startMinutes: 510, endMinutes: 620, venue: 'S4-SR2', recurrence: 'WEEKLY', weekNumbers: [], deliveryMode: 'IN_PERSON' }],
      exam: { start: '2026-11-24T17:00:00+08:00', end: '2026-11-24T18:30:00+08:00' }
    },
    {
      code: 'AB1201', title: 'Financial Management', indexNumber: '00105', academicUnits: 3,
      sessions: [{ classType: 'SEMINAR', groupLabel: '11', dayOfWeek: 'TUESDAY', startMinutes: 810, endMinutes: 980, venue: 'ESR4', recurrence: 'WEEKLY', weekNumbers: [], deliveryMode: 'IN_PERSON' }],
      exam: { start: '2026-11-27T09:00:00+08:00', end: '2026-11-27T11:30:00+08:00' }
    },
    {
      code: 'AB1088', title: 'Career Launchpad', indexNumber: '01210', academicUnits: 1,
      sessions: [
        { classType: 'SEMINAR', groupLabel: '1', dayOfWeek: 'MONDAY', startMinutes: 870, endMinutes: 980, venue: 'CR1', recurrence: 'CUSTOM', weekNumbers: [2, 3, 4, 5, 10, 11], deliveryMode: 'IN_PERSON' },
        { classType: 'LECTURE', groupLabel: '1', dayOfWeek: 'THURSDAY', startMinutes: 870, endMinutes: 1040, venue: 'LT19', recurrence: 'CUSTOM', weekNumbers: [2, 3, 6, 7, 8, 9, 10, 11], deliveryMode: 'IN_PERSON' }
      ],
      exam: null
    },
    {
      code: 'AB1501', title: 'Marketing', indexNumber: '00879', academicUnits: 3,
      sessions: [
        { classType: 'LECTURE', groupLabel: '1', dayOfWeek: 'WEDNESDAY', startMinutes: 570, endMinutes: 620, venue: 'ONLINE', recurrence: 'WEEKLY', weekNumbers: [], deliveryMode: 'ONLINE' },
        { classType: 'TUTORIAL', groupLabel: '19', dayOfWeek: 'THURSDAY', startMinutes: 630, endMinutes: 740, venue: 'TR+110', recurrence: 'CUSTOM', weekNumbers: [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13], deliveryMode: 'IN_PERSON' }
      ],
      exam: null
    }
  ]
})

export function classSessionIdentity(session) {
  return [session.classType, session.groupLabel, session.dayOfWeek, session.startMinutes, session.endMinutes].join('|')
}

export function currentSemesterSeedSummary(seed = CURRENT_SEMESTER_SEED) {
  return {
    moduleCount: seed.modules.length,
    academicUnits: seed.modules.reduce((sum, module) => sum + module.academicUnits, 0),
    sessionCount: seed.modules.reduce((sum, module) => sum + module.sessions.length, 0),
    examCount: seed.modules.filter(module => module.exam).length
  }
}

export function validateCurrentSemesterSeed(seed = CURRENT_SEMESTER_SEED) {
  const summary = currentSemesterSeedSummary(seed)
  if (summary.moduleCount !== 6 || summary.academicUnits !== 16 || summary.sessionCount !== 9 || summary.examCount !== 4) throw new Error('Current semester seed totals are invalid.')
  const moduleCodes = new Set()
  for (const module of seed.modules) {
    if (moduleCodes.has(module.code)) throw new Error(`Duplicate seed module: ${module.code}`)
    moduleCodes.add(module.code)
    const sessions = module.sessions.map(classSessionIdentity)
    if (new Set(sessions).size !== sessions.length) throw new Error(`Duplicate seed session identity: ${module.code}`)
    for (const session of module.sessions) {
      if (session.recurrence === 'CUSTOM' && !session.weekNumbers.length) throw new Error(`${module.code} has an empty custom teaching-week list.`)
      if (session.recurrence !== 'CUSTOM' && session.weekNumbers.length) throw new Error(`${module.code} has teaching weeks on a non-custom session.`)
    }
    if (module.exam && new Date(module.exam.end) <= new Date(module.exam.start)) throw new Error(`${module.code} has an invalid exam time range.`)
  }
  return summary
}
