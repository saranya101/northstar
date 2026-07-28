const words = []
const word = (text, x, y, width = Math.max(14, text.length * 7), height = 16) => words.push({ text, confidence: 0.88, bbox: { x0: x, y0: y, x1: x + width, y1: y + height } })

// Sanitised full-page mobile layout: status/browser chrome and margins precede the WISH content.
word('12:34', 28, 18); word('wish.wis.ntu.edu.sg', 160, 78); word('Home', 34, 142)
word('TIME\\DAY', 30, 242, 96)
;['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'].forEach((day, index) => word(day, 245 + index * 155, 242, 42))
for (const [time, y] of [['0830', 310], ['0930', 390], ['1030', 470], ['1130', 550], ['1230', 630], ['1330', 710], ['1430', 790], ['1530', 870], ['1630', 950], ['1730', 1030]]) word(time, 36, y, 44)

function session(column, y, lines) {
  for (const [line, offset = 0, horizontalOffset = 0] of lines) word(line, 215 + column * 155 + horizontalOffset, y + offset)
}

session(0, 310, [['HE5091'], ['LEC/STU;', 18], ['LT2A', 36], ['0830to1020;', 54]])
session(1, 310, [['SEM 5'], ['S4-SR2', 12, -18], ['0830to1020;', 28], ['\\p0403', 48]])
session(2, 390, [['AB1501'], ['LEC/STU 1', 18], ['ONLINE', 36], ['0930to1020;', 54]])
session(1, 470, [['TUT NBS3'], ['LHS-TR+51', 14, 20], ['1030to1120;', 30], ['Wk2-13;', 46], ['HE5091', 66]])
session(3, 470, [['AB1501'], ['TUT 19', 18], ['TR+110', 36], ['1030to1220;', 54], ['Wk2-13;', 72]])
session(1, 710, [['AB1201'], ['SEM 11', 18], ['ESR4', 36], ['1330to1620;', 54]])
session(2, 790, [['AB1088'], ['SEM 6', 18], ['CR1', 36], ['1430to1620;', 54], ['Wk2-5,10,11;', 72]])
session(3, 790, [['AB1088'], ['LEC/STU 1', 18], ['LT19', 36], ['1430to1720;', 54], ['Wk2,3,6-11;', 72]])
session(4, 710, [['SEM 14'], ['S4-SR20', 16, -16], ['1330to1620;', 34], ['AD1102', 62]])

word('Academic', 150, 1260, 82); word('Year', 240, 1260, 38); word('2026,Semester', 288, 1260, 126); word('1', 420, 1260)
word('Legend:', 1010, 1260, 68)
for (const [text, x] of [['Index', 28], ['Course', 118], ['Title', 300], ['AUs', 650], ['Status', 735], ['@Exam', 865], ['Schedule', 932]]) word(text, x, 1300)

const rows = [
  { index: '01128', code: 'AD1102', title: ['Financial', 'Accounting'], au: '3', exam: '23-Nov-2026 1300to1530 hrs' },
  { index: '01062', code: 'HE5091', title: ['Principles of', 'Economics *~#'], au: '3', exam: '23-Nov-2026 1700to1930 hrs' },
  { index: '00462', code: 'AB0403', title: ['Decision Making with', 'Programming & Analytics'], au: '3', exam: '24-Nov-2026 1700to1830 hrs' },
  { index: '00105', code: 'AB1201', title: ['Financial', 'Management'], au: '3', exam: '27-Nov-2026 0900to1130 hrs' },
  { index: '01215', code: 'AB1088', title: ['Career', 'Launchpad'], au: '1', exam: 'Not Applicable' },
  { index: '00879', code: 'AB1501', title: ['arketing'], au: '3', exam: 'Not Applicable' }
]

rows.forEach((row, index) => {
  const y = 1350 + index * 82
  word(row.index, 28, y, 52); word(row.code, 118, y, 60)
  row.title.forEach((text, line) => word(text, 220, y + line * 20))
  word(row.au, 650, y); word('Registered', 725, y, 80)
  row.exam.split(' ').forEach((text, part) => word(text, 835 + part * 105, y))
})
word('Total', 28, 1850); word('6', 118, 1850); word('Course(s)', 145, 1850); word('16', 650, 1850); word('AU(s)', 678, 1850)
word('Legend', 1000, 1900); word('Registered', 1000, 1920)

const normalWords = words.map(item => ({ ...item, bbox: { ...item.bbox } }))
const highContrastWords = normalWords.filter(item => !(
  (item.bbox.y0 >= 310 && item.bbox.y0 <= 346 && item.bbox.x0 < 370 && ['HE5091', 'LT2A'].includes(item.text))
  || (item.bbox.y0 >= 710 && item.bbox.y0 <= 790 && item.bbox.x0 >= 800 && ['AD1102', 'S4-SR20'].includes(item.text))
))
highContrastWords.push(
  { text: 'Heat', confidence: 0.61, bbox: { x0: 215, y0: 310, x1: 271, y1: 362 } },
  { text: 'Fr', confidence: 0.58, bbox: { x0: 835, y0: 710, x1: 895, y1: 746 } },
  { text: '54-', confidence: 0.78, bbox: { x0: 888, y0: 710, x1: 910, y1: 726 } }
)

const physicalBlocks = [
  ['he5091-mon', 'MONDAY', 168, 304, 322, 382, 510, 620],
  ['ab0403-tue', 'TUESDAY', 323, 304, 477, 382, 510, 620],
  ['ab1501-wed', 'WEDNESDAY', 478, 384, 632, 462, 570, 620],
  ['he5091-tue', 'TUESDAY', 323, 464, 477, 554, 630, 680],
  ['ab1501-thu', 'THURSDAY', 633, 464, 787, 562, 630, 740],
  ['ab1201-tue', 'TUESDAY', 323, 704, 477, 789, 810, 980],
  ['ab1088-wed', 'WEDNESDAY', 478, 790, 632, 882, 870, 980],
  ['ab1088-thu', 'THURSDAY', 633, 790, 787, 882, 870, 1040],
  ['ad1102-fri', 'FRIDAY', 788, 704, 942, 789, 810, 980]
].map(([blockId, dayOfWeek, x0, y0, x1, y1, geometryStartMinutes, geometryEndMinutes]) => ({
  blockId: `ntu-block-${blockId}`,
  dayOfWeek,
  bbox: { x0, y0, x1, y1 },
  geometryStartMinutes,
  geometryEndMinutes,
  geometryTimeReliable: true
}))

export const ntuFullMobileOcrFixture = {
  words: highContrastWords,
  wordVariants: [normalWords],
  physicalBlocks,
  refinedTitles: rows.map(row => row.title.join(' ')),
  dimensions: { width: 1200, height: 2100 }
}
