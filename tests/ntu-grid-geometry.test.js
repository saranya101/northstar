import { describe, expect, it } from 'vitest'
import { detectNtuClassRectangles } from '../app/utils/timetable-import/ntu-grid-geometry'

const word = (text, x, y, width = 50) => ({ text, bbox: { x0: x, y0: y, x1: x + width, y1: y + 20 } })

function fakeGridCanvas(rectangles) {
  return {
    width: 1300,
    height: 500,
    getContext: () => ({
      getImageData(x, y, width) {
        const data = new Uint8ClampedArray(width * 4)
        for (let pixel = 0; pixel < width; pixel += 1) {
          const white = rectangles.some(rectangle => x + pixel >= rectangle.x0 && x + pixel <= rectangle.x1 && y >= rectangle.y0 && y < rectangle.y1)
          data.set(white ? [255, 255, 255, 255] : [205, 229, 238, 255], pixel * 4)
        }
        return { data }
      }
    })
  }
}

describe('NTU timetable physical rectangle detection', () => {
  it('detects each visible class rectangle once across the full Monday-to-Friday width', () => {
    const headers = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'].map((day, index) => word(day, 125 + index * 200, 10))
    const times = [word('0830', 5, 90), word('0930', 5, 150), word('1030', 5, 210), word('1330', 5, 300), word('1430', 5, 360), word('1530', 5, 420)]
    const rectangles = [
      { x0: 51, x1: 249, y0: 90, y1: 180 },
      { x0: 251, x1: 449, y0: 90, y1: 180 },
      { x0: 251, x1: 449, y0: 190, y1: 250 },
      { x0: 251, x1: 449, y0: 300, y1: 430 },
      { x0: 451, x1: 649, y0: 140, y1: 180 },
      { x0: 451, x1: 649, y0: 340, y1: 430 },
      { x0: 651, x1: 849, y0: 190, y1: 270 },
      { x0: 651, x1: 849, y0: 340, y1: 470 },
      { x0: 851, x1: 1049, y0: 300, y1: 430 }
    ]
    const first = detectNtuClassRectangles(fakeGridCanvas(rectangles), [...headers, ...times], { x0: 0, y0: 0, x1: 1300, y1: 490 })
    const second = detectNtuClassRectangles(fakeGridCanvas(rectangles), [...headers, ...times], { x0: 0, y0: 0, x1: 1300, y1: 490 })

    expect(first.blocks).toHaveLength(9)
    expect(new Set(first.blocks.map(block => block.blockId)).size).toBe(9)
    expect(first.blocks.map(block => block.blockId)).toEqual(second.blocks.map(block => block.blockId))
    expect(first.blocks.filter(block => block.dayOfWeek === 'MONDAY')).toHaveLength(1)
    expect(first.blocks.filter(block => block.dayOfWeek === 'WEDNESDAY')).toHaveLength(2)
    expect(first.blocks.filter(block => block.dayOfWeek === 'FRIDAY')).toHaveLength(1)
    expect(first.blocks.some(block => block.dayOfWeek === 'MONDAY' && block.bbox.x0 < 100)).toBe(true)
    expect(first.blocks.some(block => block.dayOfWeek === 'FRIDAY' && block.bbox.x1 > 1000)).toBe(true)
  })
})
