# Album Reference Images

Add photos here to improve AI scanner accuracy (few-shot visual prompting).

## Files expected

| File | Description |
|------|-------------|
| `team-ref.jpg` | A team page SPREAD (both pages visible) with a MIX of filled and empty stickers. The Mexico or South Africa page works great. |
| `fwc-ref.jpg` | The FWC History pages (optional, improves FWC scanning). |

## Tips for best results

- Photo the full double-page spread (both pages open)
- Good lighting, flat album (no shadows in the middle)
- The image used for Brazil/Mexico spread (photo 3 or 4 from the conversation) is ideal
- JPEG or PNG, any size — the API uses `detail: low` for reference images to save tokens

## How it works

When the file exists, the API includes it as a "visual example" in the prompt before the
actual scan image. GPT-4o uses it to understand what filled vs empty slots look like in
**this specific album**, not just in general.
