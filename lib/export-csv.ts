type StickerEntry = {
  id: string
  countryName: string
  section: string
  status: 'missing' | 'obtained' | 'repeated'
  quantity: number
}

function esc(f: string): string {
  return f.includes(',') || f.includes('"') || f.includes('\n') || f.includes('\r')
    ? `"${f.replace(/"/g, '""')}"`
    : f
}

export function generateCSV(stickers: StickerEntry[], username: string): void {
  const repeated = stickers.filter((s) => s.status === 'repeated')
  const missing = stickers.filter((s) => s.status === 'missing')
  const len = Math.max(repeated.length, missing.length)

  const rows: string[] = ['REPETIDAS,Nome,Extras,,FALTANDO,Nome']

  for (let i = 0; i < len; i++) {
    const r = repeated[i]
    const m = missing[i]
    const left = r
      ? `${esc(r.id)},${esc(r.countryName)},×${r.quantity - 1}`
      : ',,'
    const right = m
      ? `${esc(m.id)},${esc(m.countryName)}`
      : ','
    rows.push(`${left},,${right}`)
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
