import { MAX_OPPORTUNITY_PDF_PAGES } from './file-validation'
import { createOcrExtractor } from '../timetable-import/ocr-extractor.client'

function textFromItems(items) {
  const rows = []
  for (const item of [...items].sort((left, right) => Math.abs(right.y - left.y) > 3 ? right.y - left.y : left.x - right.x)) {
    let row = rows.find(value => Math.abs(value.y - item.y) <= 3)
    if (!row) { row = { y: item.y, items: [] }; rows.push(row) }
    row.items.push(item)
  }
  return rows.sort((left, right) => right.y - left.y).map(row => row.items.sort((left, right) => left.x - right.x).map(item => item.text).join(' ')).join('\n')
}

export async function extractOpportunityPdf(file, { onProgress = () => {}, signal, loadPdf, createExtractor = createOcrExtractor, createCanvas } = {}) {
  onProgress({ label: 'Reading PDF text', progress: 0 })
  const originalBytes = new Uint8Array(await file.arrayBuffer())
  const pdfData = originalBytes.slice()
  let loadingTask
  let pdfDocument
  let ocr
  const pageTexts = []
  try {
    if (loadPdf) {
      const loaded = await loadPdf(pdfData)
      if (loaded?.promise) {
        loadingTask = loaded
        pdfDocument = await loaded.promise
      } else {
        pdfDocument = loaded
      }
    } else {
      const pdfjs = await import('pdfjs-dist/build/pdf.mjs')
      pdfjs.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).href
      loadingTask = pdfjs.getDocument({ data: pdfData })
      pdfDocument = await loadingTask.promise
    }
    if (!pdfDocument || pdfDocument.numPages < 1) throw new Error('The PDF contains no readable pages.')
    if (pdfDocument.numPages > MAX_OPPORTUNITY_PDF_PAGES) throw new Error('The PDF must contain 10 pages or fewer.')
    for (let number = 1; number <= pdfDocument.numPages; number += 1) {
      if (signal?.aborted) throw new DOMException('Import cancelled.', 'AbortError')
      const page = await pdfDocument.getPage(number)
      let canvas
      try {
        const content = await page.getTextContent()
        const items = content.items.filter(item => 'str' in item).map(item => ({ text: item.str, x: item.transform[4], y: item.transform[5] }))
        let text = textFromItems(items)
        if (text.replace(/\s/g, '').length < 40) {
          ocr ||= await createExtractor({ onProgress, signal })
          const viewport = page.getViewport({ scale: 1.75 })
          canvas = createCanvas ? createCanvas(viewport) : document.createElement('canvas')
          canvas.width = Math.ceil(viewport.width); canvas.height = Math.ceil(viewport.height)
          await page.render({ canvasContext: canvas.getContext('2d', { alpha: false }), viewport }).promise
          text = (await ocr.recognise(canvas)).text
        }
        pageTexts.push(text)
      } finally {
        if (canvas) { canvas.width = 0; canvas.height = 0 }
        try { page.cleanup() } catch {}
      }
      onProgress({ label: `Reading page ${number} of ${pdfDocument.numPages}`, progress: number / pdfDocument.numPages })
    }
    return { text: pageTexts.join('\n'), confidence: ocr ? 0.55 : 0.95, usedOcr: Boolean(ocr) }
  } catch (error) {
    if (error?.name === 'PasswordException') throw new Error('Encrypted PDFs are not supported. Export an unlocked copy or use a screenshot.')
    if (['InvalidPDFException', 'MissingPDFException', 'UnexpectedResponseException', 'FormatError'].includes(error?.name)) throw new Error('This PDF could not be read. Try exporting it again or use a screenshot.')
    throw error
  } finally {
    try { await ocr?.terminate() } catch {}
    if (pdfDocument) {
      try { await pdfDocument.destroy() } catch {}
    } else {
      try { await loadingTask?.destroy() } catch {}
    }
    try { originalBytes.fill(0) } catch {}
  }
}
