import { createOcrExtractor } from './ocr-extractor.client'
import { detectNtuClassRectangles } from './ntu-grid-geometry'
import { detectNtuImageRegions, tableGeometry } from './ntu-image-regions'

function canvasBlob(canvas) {
  return new Promise((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('Unable to prepare the screenshot for OCR.')), 'image/png'))
}

function variantCanvas(bitmap, { scale = 2, grayscale = false, contrast = 1 } = {}) {
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(bitmap.width * scale)
  canvas.height = Math.round(bitmap.height * scale)
  const context = canvas.getContext('2d', { willReadFrequently: grayscale })
  context.imageSmoothingEnabled = true
  context.imageSmoothingQuality = 'high'
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  if (grayscale) {
    const image = context.getImageData(0, 0, canvas.width, canvas.height)
    for (let offset = 0; offset < image.data.length; offset += 4) {
      const gray = image.data[offset] * 0.299 + image.data[offset + 1] * 0.587 + image.data[offset + 2] * 0.114
      const adjusted = Math.max(0, Math.min(255, (gray - 128) * contrast + 128))
      image.data[offset] = adjusted; image.data[offset + 1] = adjusted; image.data[offset + 2] = adjusted
    }
    context.putImageData(image, 0, 0)
  }
  return canvas
}

function normaliseExtraction(extraction, scale) {
  const bbox = box => ({ x0: box.x0 / scale, y0: box.y0 / scale, x1: box.x1 / scale, y1: box.y1 / scale })
  return { ...extraction, words: extraction.words.map(word => ({ ...word, bbox: bbox(word.bbox) })), blocks: extraction.blocks.map(block => ({ ...block, bbox: bbox(block.bbox) })) }
}

function regionCanvas(bitmap, region, scale) {
  const canvas = document.createElement('canvas')
  canvas.width = Math.round((region.x1 - region.x0) * scale); canvas.height = Math.round((region.y1 - region.y0) * scale)
  const context = canvas.getContext('2d')
  context.imageSmoothingEnabled = true; context.imageSmoothingQuality = 'high'
  context.drawImage(bitmap, region.x0, region.y0, region.x1 - region.x0, region.y1 - region.y0, 0, 0, canvas.width, canvas.height)
  return canvas
}

function placeRegionExtraction(extraction, region, scale) {
  const placed = normaliseExtraction(extraction, scale)
  const offset = item => ({ ...item, bbox: { x0: item.bbox.x0 + region.x0, y0: item.bbox.y0 + region.y0, x1: item.bbox.x1 + region.x0, y1: item.bbox.y1 + region.y0 } })
  return { ...placed, words: placed.words.map(offset), blocks: placed.blocks.map(offset) }
}

function extractionScore(extraction) {
  const text = extraction.text.toUpperCase()
  const headers = ['TIME\\DAY', 'ACADEMIC YEAR', 'INDEX', 'COURSE', 'TITLE', 'AUS', 'STATUS', 'EXAM SCHEDULE'].filter(value => text.includes(value)).length
  const days = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'].filter(value => new RegExp(`\\b${value}\\b`).test(text)).length
  const indexes = extraction.words.filter(word => /^\d{5}$/.test(word.text.trim())).length
  const confidence = extraction.words.length ? extraction.words.reduce((sum, word) => sum + word.confidence, 0) / extraction.words.length : 0
  return headers * 8 + days * 5 + Math.min(indexes, 7) * 4 + confidence * 10
}

async function refinedTableTitles(extractor, bitmap, words, regions, canvases, signal) {
  const geometry = tableGeometry(words, regions.registeredCoursesRegion)
  if (!geometry) return []
  const titles = []
  for (const row of geometry.rows) {
    if (signal?.aborted) throw new DOMException('Import cancelled.', 'AbortError')
    const column = geometry.columns.title
    const padding = 2
    const source = { x: Math.max(0, column.x0 + padding), y: Math.max(0, row.y0 + 1), width: Math.max(1, column.x1 - column.x0 - padding * 2), height: Math.max(1, row.y1 - row.y0 - 2) }
    const scale = 6
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(source.width * scale); canvas.height = Math.round(source.height * scale)
    const context = canvas.getContext('2d')
    context.imageSmoothingEnabled = true; context.imageSmoothingQuality = 'high'
    context.drawImage(bitmap, source.x, source.y, source.width, source.height, 0, 0, canvas.width, canvas.height)
    canvases.push(canvas)
    const result = await extractor.recognise(await canvasBlob(canvas), { pageSegmentationMode: '6' })
    titles.push(result.text.replace(/[|_]+/g, ' ').replace(/\s+/g, ' ').trim())
  }
  return titles
}

async function refinedGridBlocks(extractor, bitmap, blocks, canvases, signal) {
  const words = []
  for (const [index, block] of blocks.entries()) {
    if (signal?.aborted) throw new DOMException('Import cancelled.', 'AbortError')
    const padding = 4
    const region = {
      x0: Math.max(0, block.bbox.x0 - padding),
      y0: Math.max(0, block.bbox.y0 - padding),
      x1: Math.min(bitmap.width, block.bbox.x1 + padding),
      y1: Math.min(bitmap.height, block.bbox.y1 + padding)
    }
    const scale = 4
    const canvas = regionCanvas(bitmap, region, scale)
    canvases.push(canvas)
    const extraction = await extractor.recognise(await canvasBlob(canvas), { pageSegmentationMode: '6' })
    words.push(...placeRegionExtraction(extraction, region, scale).words)
    if (index % 3 === 2) await new Promise(resolve => setTimeout(resolve, 0))
  }
  return words
}

export async function extractImage(file, options = {}) {
  const extractor = await createOcrExtractor(options)
  const canvases = []
  let bitmap
  try {
    bitmap = await createImageBitmap(file)
    const variants = [variantCanvas(bitmap, { scale: 2 }), variantCanvas(bitmap, { scale: 2, grayscale: true, contrast: 1.3 })]
    canvases.push(...variants)
    const results = []
    for (const [index, canvas] of variants.entries()) {
      options.onProgress?.({ label: index ? 'Checking table detail' : 'Reading timetable structure', progress: 0.15 + index * 0.25 })
      results.push(normaliseExtraction(await extractor.recognise(await canvasBlob(canvas)), 2))
    }
    const rankedResults = [...results].sort((left, right) => extractionScore(right) - extractionScore(left))
    const best = rankedResults[0]
    const dimensions = { width: bitmap.width, height: bitmap.height }
    const headerRegion = { x0: 0, y0: bitmap.height * 0.01, x1: bitmap.width, y1: bitmap.height * 0.075 }
    const headerCanvas = regionCanvas(bitmap, headerRegion, 4)
    canvases.push(headerCanvas)
    const headerExtraction = placeRegionExtraction(await extractor.recognise(await canvasBlob(headerCanvas), { pageSegmentationMode: '11' }), headerRegion, 4)
    const safeHeaderWords = headerExtraction.words.filter(word => /^(?:TIME\\?DAY|TIMEDAY|MON|TUE|WED|THU|FRI|SAT)$/i.test(word.text.replace(/[^A-Z\\]/gi, '')))
    for (const result of results) result.words = [...result.words, ...safeHeaderWords]
    const initialRegions = detectNtuImageRegions(best.words, dimensions)
    const geometryCanvas = variantCanvas(bitmap, { scale: 1 })
    canvases.push(geometryCanvas)
    const gridGeometry = detectNtuClassRectangles(geometryCanvas, best.words, initialRegions.timetableGridRegion)
    options.onProgress?.({ label: 'Refining physical class blocks', progress: 0.48 })
    const refinedGridWords = await refinedGridBlocks(extractor, bitmap, gridGeometry.blocks, canvases, options.signal)
    const tableCanvas = regionCanvas(bitmap, initialRegions.registeredCoursesRegion, 4)
    canvases.push(tableCanvas)
    options.onProgress?.({ label: 'Reading registered-course rows', progress: 0.58 })
    const tableExtraction = placeRegionExtraction(await extractor.recognise(await canvasBlob(tableCanvas), { pageSegmentationMode: '6' }), initialRegions.registeredCoursesRegion, 4)
    const outsideTable = best.words.filter(word => (word.bbox.y0 + word.bbox.y1) / 2 < initialRegions.registeredCoursesRegion.y0 || (word.bbox.x0 + word.bbox.x1) / 2 > initialRegions.registeredCoursesRegion.x1)
    best.words = [...outsideTable, ...tableExtraction.words]
    const regions = detectNtuImageRegions(best.words, dimensions)
    options.onProgress?.({ label: 'Refining registered-course titles', progress: 0.68 })
    const refinedTitles = await refinedTableTitles(extractor, bitmap, best.words, regions, canvases, options.signal)
    return {
      ...best,
      dimensions,
      regions,
      refinedTitles,
      physicalBlocks: gridGeometry.blocks,
      geometryWarnings: gridGeometry.warnings,
      wordVariants: [...rankedResults.filter(result => result !== best).map(result => result.words), refinedGridWords],
      preprocessing: { variants: 4, upscale: 2, grayscaleContrastVariant: true, headerUpscale: 4, tableUpscale: 4, titleCellUpscale: 6, gridBlockUpscale: 4, geometryScale: 1, deskewDegrees: 0 }
    }
  } finally {
    for (const canvas of canvases) { canvas.width = 0; canvas.height = 0 }
    bitmap?.close()
    await extractor.terminate()
  }
}
