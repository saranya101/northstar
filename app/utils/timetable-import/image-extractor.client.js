import { createOcrExtractor } from './ocr-extractor.client'

export async function extractImage(file, options = {}) {
  const extractor = await createOcrExtractor(options)
  try {
    return await extractor.recognise(file)
  } finally {
    await extractor.terminate()
  }
}
