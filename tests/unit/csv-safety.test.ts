import { describe, test, expect } from 'vitest'
import { generateSafeCsv } from '@/lib/utils/csv'

describe('Unit Tests: Safe CSV Export & Formula Injection Prevention (CWE-1236)', () => {
  test('prefixes dangerous spreadsheet formula trigger characters with single quote', () => {
    const headers = ['Name', 'Formula']
    const rows = [
      ['=SUM(A1:A10)', 'Safe'],
      ['+123456789', 'Safe'],
      ['-2+5+cmd|', 'Safe'],
      ['@SUM(1,2)', 'Safe'],
      ['\tDANGEROUS', 'Safe'],
      ['\rDANGEROUS', 'Safe'],
    ]

    const csv = generateSafeCsv(headers, rows)
    const lines = csv.split('\r\n')

    expect(lines[1]).toContain('\'=SUM(A1:A10)')
    expect(lines[2]).toContain('\'+123456789')
    expect(lines[3]).toContain('\'-2+5+cmd|')
    expect(lines[4]).toContain('\'@SUM(1,2)')
    expect(lines[5]).toContain('\'\tDANGEROUS')
    expect(lines[6]).toContain('\'\rDANGEROUS')
  })

  test('escapes internal quotes properly by doubling them', () => {
    const headers = ['Quote Test']
    const rows = [['He said "Hello" to the world']]

    const csv = generateSafeCsv(headers, rows)
    expect(csv).toContain('"He said ""Hello"" to the world"')
  })

  test('handles null and undefined values cleanly without crashing', () => {
    const headers = ['A', 'B', 'C']
    const rows = [[null, undefined, 'Valid']]

    const csv = generateSafeCsv(headers, rows)
    expect(csv).toContain('"", "", "Valid"'.replace(/, /g, ','))
  })
})

