/**
 * Safe CSV Export Utility
 * Mitigates CSV Formula Injection (CWE-1236) by sanitizing cells that begin with formula triggers.
 */

const FORMULA_PREFIXES = ['=', '+', '-', '@', '\t', '\r']

/**
 * Sanitize a single cell value against CSV formula injection.
 */
export function sanitizeCsvCell(value: unknown): string {
  if (value === null || value === undefined) {
    return '""'
  }

  let str = String(value)
  const trimmed = str.trimStart()

  // Catch formula trigger characters: tab and carriage return on raw string, or formula prefixes on trimmed string
  const isFormula =
    str.startsWith('\t') ||
    str.startsWith('\r') ||
    FORMULA_PREFIXES.some((prefix) => trimmed.startsWith(prefix))

  if (isFormula) {
    str = `'${str}`
  }

  // Escape any existing double quotes by doubling them
  const escaped = str.replace(/"/g, '""')

  return `"${escaped}"`
}

/**
 * Generate an RFC-4180 compliant, injection-safe CSV string.
 */
export function generateSafeCsv(
  headers: string[],
  rows: Array<Array<unknown>>
): string {
  const headerLine = headers.map(sanitizeCsvCell).join(',')
  const dataLines = rows.map((row) => row.map(sanitizeCsvCell).join(','))

  return [headerLine, ...dataLines].join('\r\n')
}
