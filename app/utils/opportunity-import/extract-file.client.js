import { validateOpportunityFile } from './file-validation'
import { sanitiseOpportunityText } from './text-sanitizer'

export async function extractOpportunityFile(file, options = {}) {
  const { kind } = validateOpportunityFile(file)
  const extraction = kind === 'pdf'
    ? await (await import('./pdf-extractor.client')).extractOpportunityPdf(file, options)
    : await (await import('./image-extractor.client')).extractOpportunityImage(file, options)
  if (options.signal?.aborted) throw new DOMException('Import cancelled.', 'AbortError')
  const text = sanitiseOpportunityText(extraction.text)
  if (text.length < 20) throw new Error('Not enough opportunity text could be read. Try a clearer file or paste the text instead.')
  return { text, confidence: extraction.confidence, usedOcr: extraction.usedOcr, kind }
}
