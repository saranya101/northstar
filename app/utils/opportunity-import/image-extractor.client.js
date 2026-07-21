import { createOcrExtractor } from '../timetable-import/ocr-extractor.client'

export async function extractOpportunityImage(file, { onProgress = () => {}, signal, createExtractor = createOcrExtractor } = {}) {
  const extractor = await createExtractor({ onProgress, signal })
  let bitmap
  let canvas
  try {
    if (signal?.aborted) throw new DOMException('Import cancelled.', 'AbortError')
    bitmap = await createImageBitmap(file)
    const maximum = 2400
    const scale = Math.min(2, maximum / Math.max(bitmap.width, bitmap.height))
    canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.round(bitmap.width * scale))
    canvas.height = Math.max(1, Math.round(bitmap.height * scale))
    const context = canvas.getContext('2d', { alpha: false })
    context.fillStyle = '#fff'; context.fillRect(0, 0, canvas.width, canvas.height)
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
    onProgress({ label: 'Reading image text', progress: 0.2 })
    const result = await extractor.recognise(canvas)
    const confidence = result.words.length ? result.words.reduce((sum, word) => sum + word.confidence, 0) / result.words.length : 0
    onProgress({ label: 'Preparing review', progress: 0.95 })
    return { text: result.text, confidence, usedOcr: true }
  } finally {
    if (canvas) { canvas.width = 0; canvas.height = 0 }
    bitmap?.close()
    await extractor.terminate()
  }
}
