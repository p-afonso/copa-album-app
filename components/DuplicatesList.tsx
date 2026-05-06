'use client'
import { trpc } from '@/lib/trpc'

type Props = { albumId: string }

export function DuplicatesList({ albumId }: Props) {
  const { data } = trpc.stickers.listDuplicates.useQuery({ albumId })

  if (!data || data.length === 0) return null

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
      <h3 className="text-sm font-semibold text-amber-400 mb-3">
        Repetidas para troca ({data.reduce((s, r) => s + r.extras, 0)} extras)
      </h3>
      <div className="flex flex-wrap gap-1.5">
        {data.map((s) => (
          <span
            key={s.id}
            className="bg-amber-900/40 border border-amber-700 text-amber-300 text-xs px-2 py-0.5 rounded"
          >
            {s.id} ×{s.extras}
          </span>
        ))}
      </div>
    </div>
  )
}
