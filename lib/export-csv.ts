type StickerEntry = {
  id: string
  countryName: string
  section: string
  status: 'missing' | 'obtained' | 'repeated'
  quantity: number
}

function csvRow(fields: string[]): string {
  return fields
    .map((f) => (f.includes(',') || f.includes('"') || f.includes('\n') || f.includes('\r') ? `"${f.replace(/"/g, '""')}"` : f))
    .join(',')
}

export function generateCSV(stickers: StickerEntry[], username: string): void {
  const rows: string[] = ['tipo,id,nome,secao,quantidade']

  for (const s of stickers) {
    if (s.status === 'repeated') {
      rows.push(csvRow(['repetida', s.id, s.countryName, s.section, String(s.quantity)]))
    }
  }

  for (const s of stickers) {
    if (s.status === 'missing') {
      rows.push(csvRow(['faltando', s.id, s.countryName, s.section, '']))
    }
  }

  const blob = new Blob([rows.join('\n')], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const date = new Date().toISOString().split('T')[0]
  const a = document.createElement('a')
  a.href = url
  a.download = `copa2026-@${username}-${date}.csv`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
