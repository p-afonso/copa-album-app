// Gera o SQL de seed e popula o Supabase via API
// Uso: npx tsx scripts/generate-seed.ts
import { createClient } from '@supabase/supabase-js'
import { ALL_STICKERS } from '../lib/sticker-data'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
const key = process.env.SUPABASE_SERVICE_ROLE_KEY!

if (!url || !key) {
  console.error('Configure NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no .env.local')
  process.exit(1)
}

const supabase = createClient(url, key)

async function seed() {
  console.log(`Inserindo ${ALL_STICKERS.length} figurinhas...`)

  const rows = ALL_STICKERS.map((s) => ({
    id: s.id,
    section: s.section,
    country_code: s.countryCode,
    country_name: s.countryName,
    number: s.number,
    position: s.position,
  }))

  const { error } = await supabase
    .from('stickers')
    .upsert(rows, { onConflict: 'id' })

  if (error) {
    console.error('Erro ao inserir:', error)
    process.exit(1)
  }

  console.log('✓ Seed concluído!')
}

seed()
