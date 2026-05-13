export const dynamic = 'force-dynamic'

import OpenAI from 'openai'
import { NextResponse } from 'next/server'
import { checkRateLimit, getClientIp } from '@/lib/rate-limit'
import fs from 'fs'
import path from 'path'

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

// Load album reference images for few-shot prompting.
// Place photos in public/album-ref/:
//   team-ref.jpg    — a team page spread with MIXED stickers (some filled, some empty)
//   fwc-ref.jpg     — the FWC History pages (optional)
function loadRefImage(filename: string): string | null {
  try {
    const p = path.join(process.cwd(), 'public', 'album-ref', filename)
    if (!fs.existsSync(p)) return null
    return fs.readFileSync(p).toString('base64')
  } catch {
    return null
  }
}

type ImageContent = {
  type: 'image_url'
  image_url: { url: string; detail: 'high' | 'low' | 'auto' }
}
type TextContent = { type: 'text'; text: string }
type ContentPart = ImageContent | TextContent

export async function POST(req: Request) {
  const { imageBase64, mimeType, teamName, stickerNumbers, pageIndex, gridCols, gridRows } =
    await req.json() as {
      imageBase64: string
      mimeType: string
      teamName: string
      stickerNumbers: string[]
      pageIndex: number
      gridCols: number
      gridRows: number
    }

  if (!imageBase64 || !stickerNumbers?.length) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  // 5 scans per minute per IP
  const ip = getClientIp(req)
  if (!checkRateLimit(`scan:${ip}`, 5, 60_000)) {
    return NextResponse.json(
      { error: 'Muitas requisições. Aguarde um momento antes de escanear novamente.' },
      { status: 429 },
    )
  }

  const isSpecial = teamName.includes('FWC') || teamName.includes('Coca-Cola')
  const refFile   = isSpecial ? 'fwc-ref.jpg' : 'team-ref.jpg'
  const refBase64 = loadRefImage(refFile) ?? loadRefImage('team-ref.jpg')

  const gridDesc = buildGridDesc(stickerNumbers, gridCols, gridRows)

  // ── System prompt (album-specific, based on real Copa 2026 Panini photos) ──
  const systemPrompt = `You are an expert at reading the official Copa 2026 Panini sticker album (Brazilian Portuguese edition).

ALBUM STRUCTURE:
- Each team occupies a full double-page spread (left page = "WE ARE [TEAM]" + right page = group info)
- LEFT PAGE: 2 larger stickers at the top (side by side), then 3 columns × rows of regular stickers
- RIGHT PAGE: group information column on the left side, then 3 columns × rows of stickers
- Total: 20 stickers per team, spread across both pages

EXACT VISUAL APPEARANCE — EMPTY SLOT (sticker NOT pasted):
- Background: cream/off-white or very light colored rectangle
- Large watermark text of the team code fills the background (e.g., "MEX", "RSA", "BRA", "KOR")
- Player name printed in small dark text at the TOP of the slot
- Sticker number shown prominently in the CENTER of the slot
- Rounded rectangle shape, sometimes with decorative curved edges
- NO photo, NO face, NO jersey colors — just a pale background with text/watermark

EXACT VISUAL APPEARANCE — OBTAINED (sticker IS pasted):
- Full-color player photograph fills the entire slot
- Player wearing team jersey, usually with colorful or gradient background
- Small Panini/FIFA logo strip visible at the BOTTOM of the sticker
- Sticker number text is HIDDEN under the photo (only the image is visible)
- Some stickers have colored border strips matching team colors
- For FWC/History pages: team group photos instead of individual players
- You can clearly see a human face, body, or team photo

KEY DISTINCTION:
- EMPTY = pale/cream background + team code watermark + player name text visible
- OBTAINED = full photo covers the slot, player or team photo clearly visible

PAGE: ${pageIndex + 1} — ${teamName}
STICKERS TO CLASSIFY: ${stickerNumbers.join(', ')}
GRID (${gridRows} rows × ${gridCols} cols, left-to-right top-to-bottom):
${gridDesc}`

  // ── Few-shot reference block (if reference image is available) ──
  const fewShotContent: ContentPart[] = refBase64
    ? [
        {
          type: 'image_url',
          image_url: { url: `data:image/jpeg;base64,${refBase64}`, detail: 'low' },
        },
        {
          type: 'text',
          text: 'REFERENCE EXAMPLE — This is what a real album page looks like. Cream/white slots = MISSING. Full photo slots = OBTAINED. Use this visual reference when analyzing the next image.',
        },
      ]
    : []

  // ── User prompt (the actual page to scan) ──
  const userPrompt = `Analyze this album page photo.

Stickers to classify: ${stickerNumbers.join(', ')}

RULES:
1. A slot showing a full-color player/team PHOTO = OBTAINED
2. A slot showing cream/white background + team code watermark + player name = MISSING
3. Scan left page first (top-to-bottom), then right page (top-to-bottom)
4. EVERY sticker number must appear in exactly one list
5. When in doubt (blurry, angle) → mark as MISSING (conservative)

Respond ONLY with valid JSON (no markdown, no extra text):
{"obtained":["1","3"],"missing":["2","4"]}`

  try {
    const messages: OpenAI.ChatCompletionMessageParam[] = [
      { role: 'system', content: systemPrompt },
    ]

    // Few-shot example message (if reference available)
    if (fewShotContent.length > 0) {
      messages.push({ role: 'user',      content: fewShotContent })
      messages.push({ role: 'assistant', content: '{"understood": true}' })
    }

    // Actual scan request
    messages.push({
      role: 'user',
      content: [
        {
          type: 'image_url',
          image_url: { url: `data:${mimeType};base64,${imageBase64}`, detail: 'high' },
        },
        { type: 'text', text: userPrompt },
      ] as ContentPart[],
    })

    const response = await client.chat.completions.create({
      model: 'gpt-4o',
      temperature: 0,
      max_tokens: 600,
      response_format: { type: 'json_object' },
      messages,
    })

    const text = response.choices[0]?.message?.content ?? ''
    let result: { obtained: string[]; missing: string[] }
    try {
      result = JSON.parse(text)
    } catch {
      return NextResponse.json({ error: 'Could not parse model response', raw: text }, { status: 500 })
    }

    // Ensure every requested sticker is in exactly one list
    const classified = new Set([...(result.obtained ?? []), ...(result.missing ?? [])])
    const unclassified = stickerNumbers.filter(n => !classified.has(n))
    if (unclassified.length > 0) {
      result.missing = [...(result.missing ?? []), ...unclassified]
    }

    return NextResponse.json({
      obtained: result.obtained ?? [],
      missing:  result.missing  ?? [],
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

function buildGridDesc(numbers: string[], cols: number, rows: number): string {
  const lines: string[] = []
  for (let r = 0; r < rows; r++) {
    const row = numbers.slice(r * cols, r * cols + cols)
    if (row.length === 0) break
    lines.push(`  Row ${r + 1}: [${row.join('] [')}]`)
  }
  return lines.join('\n')
}
