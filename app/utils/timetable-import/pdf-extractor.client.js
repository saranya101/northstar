import { MAX_TIMETABLE_PDF_PAGES } from './file-validation'
import { createOcrExtractor } from './ocr-extractor.client'

function textFromItems(items) {
  const rows = []
  for (const item of [...items].sort((left, right) => Math.abs(right.y - left.y) > 3 ? right.y - left.y : left.x - right.x)) {
    let row = rows.find(value => Math.abs(value.y - item.y) <= 3)
    if (!row) { row = { y: item.y, items: [] }; rows.push(row) }
    row.items.push(item)
  }
  return rows.sort((left, right) => right.y - left.y).map(row => row.items.sort((left, right) => left.x - right.x).map(item => item.text).join(' ')).join('\n')
}

export async function extractPdf(file, { onProgress = () => {}, signal } = {}) {
  onProgress({ label: 'Reading PDF', progress: 0 })
  const pdfjs = await import('pdfjs-dist/build/pdf.mjs')
  pdfjs.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).href
  const bytes = new Uint8Array(await file.arrayBuffer())
  let pdfDocument
  let ocr
  const pages = []
  try {
    pdfDocument = await pdfjs.getDocument({ data: bytes }).promise
    if (pdfDocument.numPages > MAX_TIMETABLE_PDF_PAGES) throw new Error('The PDF must contain 10 pages or fewer.')
    for (let number = 1; number <= pdfDocument.numPages; number += 1) {
      if (signal?.aborted) throw new DOMException('Import cancelled.', 'AbortError')
      const page = await pdfDocument.getPage(number)
      const content = await page.getTextContent()
      const items = content.items.filter(item => 'str' in item).map(item => ({ text: item.str, x: item.transform[4], y: item.transform[5], width: item.width, height: item.height }))
      let text = textFromItems(items)
      let words = []
      if (text.replace(/\s/g, '').length < 40) {
        ocr ||= await createOcrExtractor({ onProgress, signal })
        const viewport = page.getViewport({ scale: 1.75 })
        const canvas = globalThis.document.createElement('canvas')
        canvas.width = Math.ceil(viewport.width)
        canvas.height = Math.ceil(viewport.height)
        const context = canvas.getContext('2d', { alpha: false })
        await page.render({ canvasContext: context, viewport }).promise
        const result = await ocr.recognise(canvas)
        text = result.text
        words = result.words
        canvas.width = 0
        canvas.height = 0
      }
      pages.push({ number, text, items, words })
      page.cleanup()
      onProgress({ label: `Reading page ${number} of ${pdfDocument.numPages}`, progress: number / pdfDocument.numPages })
    }
    return { text: pages.map(page => page.text).join('\n'), pages, usedOcr: Boolean(ocr) }
  } catch (error) {
    if (error?.name === 'PasswordException') throw new Error('Encrypted PDFs are not supported. Export an unlocked copy or use a screenshot.')
    throw error
  } finally {
    await ocr?.terminate()
    await pdfDocument?.destroy()
    bytes.fill(0)
  }
}
