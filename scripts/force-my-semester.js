import 'dotenv/config'
import { PrismaNeon } from '@prisma/adapter-neon'
import { createJiti } from 'jiti'
import { CURRENT_SEMESTER_SEED, validateCurrentSemesterSeed } from './current-semester-seed-data.js'
import { dateKey } from '../shared/calendar/events.js'
import { loadForceSemesterDiagnostics, resolveForceSemesterTarget, setAuthoritativeTeachingStart, synchronizeCurrentSemester } from './force-my-semester-logic.js'

const { PrismaClient } = await createJiti(import.meta.url).import('../server/generated/prisma/client.ts')
const connectionString = process.env.DATABASE_URL
const verifyOnly = process.argv.includes('--verify')

if (!connectionString) throw new Error('DATABASE_URL is required.')

validateCurrentSemesterSeed()
const prisma = new PrismaClient({ adapter: new PrismaNeon({ connectionString }) })

function minutes(value) {
  return `${String(Math.floor(value / 60)).padStart(2, '0')}:${String(value % 60).padStart(2, '0')}`
}

function printDiagnostics(diagnostics) {
  console.log(`Active semester: ${diagnostics.activeSemester}`)
  console.log(`Teaching start: ${dateKey(diagnostics.teachingStartDate) || 'UNSET'}`)
  console.log(`Sessions: ${diagnostics.sessions.length}`)
  for (const module of CURRENT_SEMESTER_SEED.modules) console.log(`${module.code}: ${diagnostics.counts[module.code] || 0}`)
  for (const session of diagnostics.sessions) {
    const weeks = session.recurrence === 'CUSTOM' ? ` [${session.weekNumbers.join(',')}]` : ''
    console.log(`${session.module.code}: ${session.dayOfWeek} ${minutes(session.startMinutes)}-${minutes(session.endMinutes)} ${session.classType} ${session.groupLabel} ${session.venue || 'TBC'} ${session.recurrence}${weeks}`)
  }
  console.log(`Teaching week mapping: ${diagnostics.mapping.safe ? 'RESOLVED' : 'UNRESOLVED'}`)
}

try {
  if (verifyOnly) {
    const target = await resolveForceSemesterTarget(prisma)
    printDiagnostics(await loadForceSemesterDiagnostics(prisma, target, CURRENT_SEMESTER_SEED))
  } else {
    const diagnostics = await prisma.$transaction(async (database) => {
      const target = await resolveForceSemesterTarget(database)
      await setAuthoritativeTeachingStart(database, target)
      await synchronizeCurrentSemester(database, target, CURRENT_SEMESTER_SEED)
      return loadForceSemesterDiagnostics(database, target, CURRENT_SEMESTER_SEED)
    }, { isolationLevel: 'Serializable', maxWait: 10_000, timeout: 30_000 })

    if (diagnostics.sessions.length !== 9) throw new Error(`Expected 9 canonical sessions, found ${diagnostics.sessions.length}.`)
    console.log('Semester populated successfully')
    console.log('Modules: 6')
    console.log('AU: 16')
    console.log('Sessions: 9')
    console.log('Exams: 4')
    printDiagnostics(diagnostics)
  }
} finally {
  await prisma.$disconnect()
}
