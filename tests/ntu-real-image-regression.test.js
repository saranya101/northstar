import { describe, expect, it } from 'vitest'
import { parseNtuTimetableImage } from '../app/utils/timetable-import/ntu-timetable-image-parser'
import { createTimetableImportSchema } from '../shared/schemas/timetable'

const words = []
const word = (text, x, y, width = Math.max(12, text.length * 7), height = 14) => words.push({ text, confidence: .85, bbox: { x0: x, y0: y, x1: x + width, y1: y + height } })

// Sanitised geometry reconstructed from the supplied screenshot. The identity strip is deliberately absent.
word('TIME\\DAY', 20, 28, 90); ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'].forEach((day, index) => word(day, 190 + index * 155, 28, 40))
for (const [time, y] of [['0830', 105], ['0930', 155], ['1030', 205], ['1130', 255], ['1230', 315], ['1330', 375], ['1430', 445], ['1530', 515], ['1630', 575], ['1730', 635], ['1830', 695], ['1930', 755], ['2030', 895], ['2130', 1045], ['2230', 1145], ['2330', 1205]]) word(time, 20, y, 42)
const session = (column, y, values) => values.forEach(([text, dy = 0, dx = 0]) => word(text, 140 + column * 155 + dx, y + dy))
session(0, 160, [['5C2005'], ['LAB', 0, 55], ['SCEB', 0, 90], ['SWLAB2', 16], ['0930to1120', 32], ['Wk1,3,5,7,9,11,13;', 48]])
session(1, 176, [['BUS5601'], ['LEC/STU', 0, 58], ['1', 0, 116], ['LT6', 0, 132], ['0930to1120;', 18]])
session(1, 375, [['5C3000'], ['LEC/STU', 0, 58], ['SCL3', 0, 116], ['LT1A', 15], ['1330to1420;', 30]])
session(2, 230, [['ML0004'], ['TUT', 0, 55], ['T042', 0, 90], ['LHN-TR+12', 16], ['1030to1220;', 32]])
session(2, 375, [['5C2207'], ['LAB', 0, 55], ['SCSD', 0, 90], ['SPL', 0, 130], ['1230to1420', 16], ['Wk1,3,5,7,9,11,13;', 32]])
session(3, 675, [['CCO006'], ['LEC/STU', 0, 55], ['LE', 0, 115], ['EXAMHALL', 16], ['7', 16, 75], ['1830to2120', 32], ['Wk12;', 48]])
session(4, 403, [['ES5007'], ['LEC/STU', 0, 55], ['LE', 0, 115], ['TCT-LT', 16], ['1330to1620', 32], ['Wk1-7,9-13;', 48]])

word('Academic', 174, 1243, 86); word('Year', 265, 1243, 40); word('2025,Semester', 310, 1243, 126); word('2', 441, 1243); word('Legend:', 615, 1243, 68)
for (const [text, x] of [['Index', 23], ['Course', 84], ['Title', 202], ['AUs', 300], ['Status', 350], ['@Exam', 437], ['Schedule', 508]]) word(text, x, 1274)
const rows = [
  ['79705', 'gssooy', '3', 'Registered', '06-May-2026 1700to1900 hrs'],
  ['10352', 'C3000', '3', 'Registered', '28-Apr-2026 ADI1300t01500'],
  ['10324', 'sczzor', '3', 'Registered', '30-Apr-2026 1700to1900 hrs'],
  ['00989', 'BUSGO1', '3', 'Registered', 'Not Applicable'],
  ['86046', 'CCO006', '3', 'Registered', 'Not Applicable'],
  ['84042', 'miooos', '2', 'Registered', 'Not Applicable'],
  ['10262', 'SC2005', '3', 'Registered', 'Not Applicable']
]
rows.forEach((row, index) => { const y = 1312 + index * 46; word(row[0], 23, y); word(row[1], 84, y); word('title', 160, y); word(row[2], 300, y); word(row[3], 345, y); row[4].split(' ').forEach((value, part) => word(value, 422 + part * 78, y)) })
word('Total', 22, 1635); word('7', 84, 1635); word('Course(s)', 95, 1635); word('20', 300, 1635); word('AU(s)', 318, 1635)

const refinedTitles = ['Climate & Climate Change', 'Artificial Intelligence', 'Introduction To Databases', 'Fundamentals Of Management', 'Sustainability: Society, Economy & Environment', 'Career Design & Workplace Readiness In The V.U.C.A World', 'Operating Systems']

describe('sanitised real NTU screenshot regression', () => {
  it('uses the table allowlist and reconstructs semester, exams and weekday sessions', () => {
    const result = parseNtuTimetableImage({ words, refinedTitles, dimensions: { width: 1080, height: 1826 } })
    expect(result.modules.map(module => module.code)).toEqual(['ES5007', 'SC3000', 'SC2207', 'BU5601', 'CC0006', 'ML0004', 'SC2005'])
    expect(result.sourceSemester).toMatchObject({ academicYearStart: 2025, academicYearLabel: '2025/2026', semesterNumber: 2 })
    expect(result.sourceSummary).toEqual({ moduleCount: 7, totalAcademicUnits: 20 })
    expect(result.modules.reduce((sum, module) => sum + module.academicUnits, 0)).toBe(20)
    expect(result.modules.filter(module => module.examCandidate.applicable)).toHaveLength(3)
    expect(Object.fromEntries(result.modules.map(module => [module.code, module.examCandidate]))).toMatchObject({
      ES5007: { applicable: true, startMinutes: 1020, endMinutes: 1140, rawText: '06-May-2026 1700to1900 hrs' },
      SC3000: { applicable: true, startMinutes: 780, endMinutes: 900, rawText: '28-Apr-2026 ADI1300t01500' },
      SC2207: { applicable: true, startMinutes: 1020, endMinutes: 1140, rawText: '30-Apr-2026 1700to1900 hrs' },
      BU5601: { applicable: false, startMinutes: null, endMinutes: null },
      CC0006: { applicable: false, startMinutes: null, endMinutes: null },
      ML0004: { applicable: false, startMinutes: null, endMinutes: null },
      SC2005: { applicable: false, startMinutes: null, endMinutes: null }
    })
    expect(new Set(result.modules.flatMap(module => module.sessions.map(session => session.dayOfWeek)))).toEqual(new Set(['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY']))
    expect(result.modules.flatMap(module => module.sessions).every(session => session.startMinutes !== null && session.endMinutes !== null)).toBe(true)
    expect(result.modules.map(module => module.title)).toEqual(refinedTitles)
    expect(result.modules.map(module => module.code)).not.toEqual(expect.arrayContaining(['BUSG01', 'BUS5601', 'MLO004', 'E000', 'TRI17', 'CCO006', 'WK12', 'WKI12', 'C0006', 'C3000']))
    expect(JSON.stringify(result)).not.toMatch(/RAJA|LATCHIYA|DHURGA/i)
    expect(createTimetableImportSchema.safeParse(result).success).toBe(true)
    expect(JSON.stringify(result)).not.toMatch(/data:image|image\/png|arraybuffer|blob:|matric/i)
  })
})
