function wordsFromResult(result) {
  const words = result?.data?.words || result?.data?.blocks?.flatMap(block => block.paragraphs?.flatMap(paragraph => paragraph.lines?.flatMap(line => line.words || []) || []) || []) || []
  return words.map(word => ({ text: word.text, confidence: word.confidence / 100, bbox: word.bbox })).filter(word => word.text && word.bbox)
}

export async function createOcrExtractor({ onProgress = () => {}, signal } = {}) {
  onProgress({ label: 'Loading OCR', progress: 0 })
  const { createWorker } = await import('tesseract.js')
  let worker
  const abort = () => {
    const activeWorker = worker
    worker = null
    void activeWorker?.terminate()
  }
  signal?.addEventListener('abort', abort, { once: true })
  try {
    if (signal?.aborted) throw new DOMException('Import cancelled.', 'AbortError')
    worker = await createWorker('eng', 1, { logger: message => onProgress({ label: message.status === 'recognizing text' ? 'Detecting timetable' : 'Reading page', progress: message.progress || 0 }) })
    return {
      async recognise(image) {
        if (signal?.aborted) throw new DOMException('Import cancelled.', 'AbortError')
        const result = await worker.recognize(image, {}, { text: true, blocks: true })
        return { text: result.data.text || '', words: wordsFromResult(result) }
      },
      async terminate() {
        signal?.removeEventListener('abort', abort)
        if (worker) await worker.terminate()
        worker = null
      }
    }
  } catch (error) {
    signal?.removeEventListener('abort', abort)
    if (worker) await worker.terminate()
    throw error
  }
}
