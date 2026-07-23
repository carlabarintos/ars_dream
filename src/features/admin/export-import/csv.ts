import Papa from 'papaparse'

export function toCsv<T extends Record<string, unknown>>(rows: T[], columns: (keyof T & string)[]): string {
  return Papa.unparse({ fields: columns, data: rows.map((row) => columns.map((column) => row[column])) })
}

export function parseCsv(text: string): { rows: Record<string, string>[]; errors: string[] } {
  const result = Papa.parse<Record<string, string>>(text, { header: true, skipEmptyLines: true })
  return {
    rows: result.data,
    errors: result.errors.map((error) => `Row ${error.row ?? '?'}: ${error.message}`),
  }
}

export function downloadTextFile(filename: string, content: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.click()
  URL.revokeObjectURL(url)
}
