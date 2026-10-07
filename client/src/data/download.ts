export function downloadFixture(name: string, headers: string[], rows: string[][]) {
  const escapeCell = (value: string) => `"${value.replaceAll('"', '""')}"`
  const blob = new Blob(
    ['\uFEFF', [headers, ...rows].map((row) => row.map(escapeCell).join(',')).join('\r\n')],
    { type: 'text/csv;charset=utf-8' },
  )
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = `${name}-demo.csv`
  anchor.click()
  URL.revokeObjectURL(url)
}
