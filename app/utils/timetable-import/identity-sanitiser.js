const IDENTITY_LINE = /^\s*(?:name|matric(?:ulation(?:\s+number)?)?|student\s+id|current\s+programme|registration\s+programme)\b\s*[:#-]?/i

export function sanitiseIdentityText(text = '') {
  return String(text).split(/\r?\n/).filter(line => !IDENTITY_LINE.test(line)).join('\n')
}

