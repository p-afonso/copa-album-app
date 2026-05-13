export const dynamic = 'force-dynamic'

import OpenAI from 'openai'
import { NextResponse } from 'next/server'
import { checkRateLimit, getClientIp } from '@/lib/rate-limit'

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

export async function POST(req: Request) {
  const { imageBase64, mimeType, teamName, stickerNumbers, pageIndex, gridCols, gridRows } =
    await req.json() as {
      imageBase64: string
      mimeType: string
      teamName: string
      stickerNumbers: string[]
      pageIndex: number      // 0-based page number in the album
      gridCols: number       // columns in the sticker grid for this page
      gridRows: number       // rows in the sticker grid for this page
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

  // Build ordered grid description so the model knows exact spatial layout
  const gridDescription = buildGridDescription(stickerNumbers, gridCols, gridRows)

  const isSpecialPage = teamName.includes('FIFA World Cup') || teamName.includes('Coca-Cola')
  const pageType = isSpecialPage ? 'special' : 'team'
  
  const systemPrompt = `You are an expert at reading Panini FIFA World Cup sticker albums.

Album: FIFA World Cup 2026 (Panini official)
Page type: ${pageType === 'special' ? 'Special page (FWC or Coca-Cola)' : `Team page: ${teamName}`}
Page index: ${pageIndex + 1} of ${pageIndex < 48 ? '48 team pages' : 'special sections'}
Grid layout: ${gridRows} rows × ${gridCols} columns = ${stickerNumbers.length} sticker slots

STICKER NUMBERS TO DETECT: ${stickerNumbers.join(', ')}

VISUAL PATTERNS - HOW TO IDENTIFY OBTAINED vs MISSING:

**OBTAINED (sticker is pasted in the album):**
- Slot contains a colorful printed image (player photo, team badge, stadium, trophy, or logo)
- Image fills most of the slot area with colors (red, blue, green, gold, etc.)
- You can see faces, jerseys, flags, or detailed graphics
- There may be a thin white border around the image
- Even partial/angled images count as OBTAINED

**MISSING (empty slot waiting for sticker):**
- Slot shows only a light grey, white, or pale background rectangle
- May show a faint gray outline/border with nothing inside
- May show just the sticker number printed faintly as a ghost
- Completely blank empty spaces count as MISSING
- If you're UNSURE whether there's an image → mark as MISSING

**CRITICAL DISTINCTION:**
- COLLECTED = colorful image visible
- MISSING = gray/white/blank empty slot

GRID ORDER (read left-to-right, top-to-bottom, row by row):
${gridDescription}

Your task: For each slot in the grid above, determine if it shows a pasted sticker (OBTAINED) or an empty slot (MISSING) based ONLY on what you visually see in the photo.`

  const userPrompt = `Look at this album page photo carefully.

You need to classify these specific stickers: ${stickerNumbers.join(', ')}

STRICT RULES:
1. Scan the grid left-to-right, top-to-bottom, row by row
2. ANY visible colorful image/photo/graphic = OBTAINED
3. Blank, gray, white, or empty slot = MISSING
4. Include EVERY sticker number in EXACTLY ONE list (obtained OR missing)
5. If you cannot clearly see the sticker → treat as MISSING (conservative)
6. Partial or blurry images that still show color/content = OBTAINED

Look for the sticker numbers in the grid and identify which ones are pasted (obtained) vs empty slots (missing).

Respond with ONLY valid JSON (no markdown, no explanation):
{"obtained":["1","3","5","7"],"missing":["2","4","6","8"]}`

  try {
    const response = await client.chat.completions.create({
      model: 'gpt-4o',
      temperature: 0,
      max_tokens: 600,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: systemPrompt },
        {
          role: 'user',
          content: [
            {
              type: 'image_url',
              image_url: {
                url: `data:${mimeType};base64,${imageBase64}`,
                detail: 'high',
              },
            },
            { type: 'text', text: userPrompt },
          ],
        },
      ],
    })

    const text = response.choices[0]?.message?.content ?? ''
    let result: { obtained: string[]; missing: string[] }
    try {
      result = JSON.parse(text)
    } catch {
      return NextResponse.json({ error: 'Could not parse model response', raw: text }, { status: 500 })
    }

    // Validate: every requested number must appear in exactly one list
    const returnedAll = new Set([...(result.obtained ?? []), ...(result.missing ?? [])])
    const missing = stickerNumbers.filter(n => !returnedAll.has(n))
    if (missing.length > 0) {
      // Add any unclassified stickers as missing (conservative fallback)
      result.missing = [...(result.missing ?? []), ...missing]
    }

    return NextResponse.json({
      obtained: result.obtained ?? [],
      missing: result.missing ?? [],
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

function buildGridDescription(numbers: string[], cols: number, rows: number): string {
  const lines: string[] = []
  for (let r = 0; r < rows; r++) {
    const rowNums = numbers.slice(r * cols, r * cols + cols)
    lines.push(`  Row ${r + 1}: [${rowNums.join('] [')}]`)
  }
  return lines.join('\n')
}
