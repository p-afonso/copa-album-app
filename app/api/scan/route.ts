export const dynamic = 'force-dynamic'

import OpenAI from 'openai'
import { NextResponse } from 'next/server'
import { checkRateLimit, getClientIp } from '@/lib/rate-limit'

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

export async function POST(req: Request) {
  const { imageBase64, mimeType, teamName, stickerNumbers } = await req.json() as {
    imageBase64: string
    mimeType: string
    teamName: string
    stickerNumbers: string[]
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

  const prompt = `You are scanning a physical FIFA World Cup 2026 sticker album page for the team "${teamName}".

The stickers on this page are numbered: ${stickerNumbers.join(', ')}.

Look at the image carefully. Each sticker slot shows either:
- A FILLED sticker (colorful photo/illustration placed in the slot) — the user HAS this sticker
- An EMPTY slot (blank white/grey area, just a border outline) — the sticker is MISSING

Return ONLY valid JSON with no explanation, in this exact format:
{"obtained": ["1", "2", "3"], "missing": ["4", "5"]}

Where "obtained" lists the numbers of stickers that are filled, and "missing" lists the numbers of empty slots.
Include ALL sticker numbers from the list in exactly one of the two arrays.
Only use numbers from this list: ${stickerNumbers.join(', ')}`

  try {
    const response = await client.chat.completions.create({
      model: 'gpt-4o',
      max_tokens: 512,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image_url',
              image_url: { url: `data:${mimeType};base64,${imageBase64}` },
            },
            { type: 'text', text: prompt },
          ],
        },
      ],
    })

    const text = response.choices[0]?.message?.content ?? ''
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      return NextResponse.json({ error: 'Could not parse model response', raw: text }, { status: 500 })
    }

    const result = JSON.parse(jsonMatch[0]) as { obtained: string[]; missing: string[] }
    return NextResponse.json(result)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
