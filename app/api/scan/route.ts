import Anthropic from '@anthropic-ai/sdk'
import { NextResponse } from 'next/server'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

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

  const prompt = `You are scanning a physical FIFA World Cup 2026 sticker album page for the team "${teamName}".

The stickers on this page are numbered: ${stickerNumbers.join(', ')}.

Look at the image carefully. Each sticker slot shows either:
- A FILLED sticker (colorful photo/illustration placed in the slot) — this means the user HAS this sticker
- An EMPTY slot (blank white/grey area, just a border outline) — this means the sticker is MISSING

Return ONLY valid JSON with no explanation, in this exact format:
{"obtained": ["1", "2", "3"], "missing": ["4", "5"]}

Where "obtained" lists the numbers of stickers that are filled in the album, and "missing" lists the numbers of empty slots.
Include ALL sticker numbers from the list in exactly one of the two arrays.
Only use numbers from this list: ${stickerNumbers.join(', ')}`

  try {
    const response = await client.messages.create({
      model: 'claude-opus-4-7',
      max_tokens: 512,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: {
                type: 'base64',
                media_type: mimeType as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp',
                data: imageBase64,
              },
            },
            { type: 'text', text: prompt },
          ],
        },
      ],
    })

    const text = response.content[0].type === 'text' ? response.content[0].text : ''
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
