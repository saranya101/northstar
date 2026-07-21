import { describe, expect, it } from 'vitest'
import { parseNtuGrid } from '../app/utils/timetable-import/ntu-grid-parser'

const word = (text, x, y, width = 30, height = 12) => ({ text, bbox: { x0: x, y0: y, x1: x + width, y1: y + height } })

describe('weekly grid parser', () => {
  it('maps relative day columns and start rows while requiring end-time review', () => {
    const result = parseNtuGrid([word('MON', 100, 20), word('TUE', 300, 20), word('0830', 10, 100), word('0930', 10, 200), word('AB1201', 300, 150)])
    expect(result.modules[0].sessions[0]).toMatchObject({ dayOfWeek: 'TUESDAY', startMinutes: 510, endMinutes: null })
    expect(result.modules[0].sessions[0].warnings).toContain('End time needs confirmation.')
    expect(result.modules[0].sessions[0].confidence).toBeLessThan(0.5)
  })
})

