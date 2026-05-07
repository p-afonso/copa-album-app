import { z } from 'zod'
import { TRPCError } from '@trpc/server'
import { protectedProcedure, router } from '../trpc'
import { supabaseAdmin } from '../db'
import { ALL_STICKERS } from '@/lib/sticker-data'

async function assertMember(albumId: string, userId: string) {
  const { data } = await supabaseAdmin
    .from('album_members')
    .select('user_id')
    .eq('album_id', albumId)
    .eq('user_id', userId)
    .maybeSingle()
  if (!data) throw new TRPCError({ code: 'FORBIDDEN', message: 'Não é membro deste álbum' })
}

async function adjustSticker(
  albumId: string, stickerId: string,
  action: 'decrement' | 'gain', updatedBy: string,
) {
  if (action === 'decrement') {
    const { data } = await supabaseAdmin
      .from('album_stickers').select('quantity, status')
      .eq('album_id', albumId).eq('sticker_id', stickerId).maybeSingle()
    if (!data || data.status !== 'repeated')
      throw new TRPCError({ code: 'CONFLICT', message: `Figurinha ${stickerId} não está mais disponível para troca` })
    const qty = data.quantity
    if (qty <= 1) {
      const { error: delErr } = await supabaseAdmin.from('album_stickers').delete()
        .eq('album_id', albumId).eq('sticker_id', stickerId)
      if (delErr) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: delErr.message })
    } else {
      const { error: updErr } = await supabaseAdmin.from('album_stickers')
        .update({ quantity: qty - 1, status: qty === 2 ? 'obtained' : 'repeated',
          updated_at: new Date().toISOString(), updated_by: updatedBy })
        .eq('album_id', albumId).eq('sticker_id', stickerId)
      if (updErr) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: updErr.message })
    }
  } else {
    const { data } = await supabaseAdmin
      .from('album_stickers').select('quantity')
      .eq('album_id', albumId).eq('sticker_id', stickerId).maybeSingle()
    if (!data) {
      const { error: insErr } = await supabaseAdmin.from('album_stickers').insert({
        album_id: albumId, sticker_id: stickerId, status: 'obtained', quantity: 1,
        updated_by: updatedBy, updated_at: new Date().toISOString(),
      })
      if (insErr) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: insErr.message })
    } else {
      const newQty = data.quantity + 1
      const { error: updErr } = await supabaseAdmin.from('album_stickers')
        .update({ quantity: newQty, status: newQty >= 2 ? 'repeated' : 'obtained',
          updated_at: new Date().toISOString(), updated_by: updatedBy })
        .eq('album_id', albumId).eq('sticker_id', stickerId)
      if (updErr) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: updErr.message })
    }
  }
}

export const tradesRouter = router({
  setVisibility: protectedProcedure
    .input(z.object({ albumId: z.string().uuid(), visible: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      const { data: album } = await supabaseAdmin
        .from('albums').select('owner_id').eq('id', input.albumId).maybeSingle()
      if (!album || album.owner_id !== ctx.userId)
        throw new TRPCError({ code: 'FORBIDDEN', message: 'Somente o dono pode alterar visibilidade' })
      const { error } = await supabaseAdmin
        .from('albums').update({ marketplace_visible: input.visible }).eq('id', input.albumId)
      if (error) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: error.message })
      return { visible: input.visible }
    }),

  getMarketplace: protectedProcedure.query(async ({ ctx }) => {
    const { data: myMemberships } = await supabaseAdmin
      .from('album_members').select('album_id').eq('user_id', ctx.userId)
    const myAlbumIds = (myMemberships ?? []).map(m => m.album_id)

    const myRepeatedIds = new Set<string>()
    if (myAlbumIds.length > 0) {
      const { data: myRepeated } = await supabaseAdmin
        .from('album_stickers').select('sticker_id')
        .in('album_id', myAlbumIds).eq('status', 'repeated')
      for (const r of myRepeated ?? []) myRepeatedIds.add(r.sticker_id)
    }

    let albumQuery = supabaseAdmin
      .from('albums').select('id, name, owner_id').eq('marketplace_visible', true)
    if (myAlbumIds.length > 0)
      albumQuery = albumQuery.not('id', 'in', `(${myAlbumIds.join(',')})`)

    const { data: visibleAlbums, error } = await albumQuery
    if (error) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: error.message })
    if (!visibleAlbums?.length) return { offering: [], wanting: [] }

    const visibleAlbumIds = visibleAlbums.map(a => a.id)
    const ownerIds = [...new Set(visibleAlbums.map(a => a.owner_id))]

    const [{ data: allStickers }, { data: profiles }] = await Promise.all([
      supabaseAdmin.from('album_stickers').select('album_id, sticker_id, status').in('album_id', visibleAlbumIds),
      supabaseAdmin.from('profiles').select('user_id, username').in('user_id', ownerIds),
    ])

    const profileMap = new Map((profiles ?? []).map(p => [p.user_id, p.username]))
    const albumMap = new Map(visibleAlbums.map(a => [a.id, { ownerId: a.owner_id }]))
    const stickerInfoMap = new Map(ALL_STICKERS.map(s => [s.id, { countryName: s.countryName, section: s.section }]))
    const allStickerIds = ALL_STICKERS.map(s => s.id)

    const stickersByAlbum = new Map<string, { sticker_id: string; status: string }[]>()
    for (const id of visibleAlbumIds) stickersByAlbum.set(id, [])
    for (const s of (allStickers ?? [])) stickersByAlbum.get(s.album_id)?.push(s)

    type Entry = { stickerId: string; countryName: string; section: string; userId: string; username: string; albumId: string }
    const offering: Entry[] = []
    const wanting: Entry[] = []

    for (const [albumId, stickers] of stickersByAlbum) {
      const userId = albumMap.get(albumId)!.ownerId
      const username = profileMap.get(userId) ?? '?'
      const obtainedOrRepeated = new Set(stickers.map(s => s.sticker_id))
      const repeated = new Set(stickers.filter(s => s.status === 'repeated').map(s => s.sticker_id))

      for (const stickerId of repeated) {
        const info = stickerInfoMap.get(stickerId)
        if (info) offering.push({ stickerId, ...info, userId, username, albumId })
      }
      for (const stickerId of allStickerIds) {
        if (!obtainedOrRepeated.has(stickerId) && myRepeatedIds.has(stickerId)) {
          const info = stickerInfoMap.get(stickerId)
          if (info) wanting.push({ stickerId, ...info, userId, username, albumId })
        }
      }
    }

    return { offering, wanting }
  }),

  propose: protectedProcedure
    .input(z.object({
      proposerAlbumId: z.string().uuid(),
      offeredSticker: z.string(),
      receiverId: z.string().uuid(),
      receiverAlbumId: z.string().uuid(),
      wantedSticker: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      if (input.receiverId === ctx.userId)
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Não pode propor troca para si mesmo' })

      await assertMember(input.proposerAlbumId, ctx.userId)

      const { data: offeredRow } = await supabaseAdmin
        .from('album_stickers').select('status')
        .eq('album_id', input.proposerAlbumId).eq('sticker_id', input.offeredSticker).maybeSingle()
      if (!offeredRow || offeredRow.status !== 'repeated')
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Figurinha oferecida não está na lista de repetidas' })

      await assertMember(input.receiverAlbumId, input.receiverId)

      const { data: wantedRow } = await supabaseAdmin
        .from('album_stickers').select('status')
        .eq('album_id', input.receiverAlbumId).eq('sticker_id', input.wantedSticker).maybeSingle()
      if (!wantedRow || wantedRow.status !== 'repeated')
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Figurinha solicitada não está disponível' })

      const { data: existing } = await supabaseAdmin
        .from('trade_proposals').select('id')
        .eq('proposer_id', ctx.userId).eq('offered_sticker', input.offeredSticker)
        .eq('receiver_id', input.receiverId).eq('wanted_sticker', input.wantedSticker)
        .eq('status', 'pending').maybeSingle()
      if (existing)
        throw new TRPCError({ code: 'CONFLICT', message: 'Proposta idêntica já pendente' })

      const { data: proposal, error } = await supabaseAdmin
        .from('trade_proposals')
        .insert({
          proposer_id: ctx.userId, proposer_album: input.proposerAlbumId,
          offered_sticker: input.offeredSticker, receiver_id: input.receiverId,
          receiver_album: input.receiverAlbumId, wanted_sticker: input.wantedSticker,
        })
        .select('id').single()
      if (error) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: error.message })
      return { proposalId: proposal.id }
    }),

  respond: protectedProcedure
    .input(z.object({ proposalId: z.string().uuid(), action: z.enum(['accept', 'reject']) }))
    .mutation(async ({ ctx, input }) => {
      const { data: proposal } = await supabaseAdmin
        .from('trade_proposals').select('*')
        .eq('id', input.proposalId).eq('receiver_id', ctx.userId).eq('status', 'pending').maybeSingle()
      if (!proposal)
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Proposta não encontrada ou já respondida' })

      if (input.action === 'reject') {
        await supabaseAdmin.from('trade_proposals')
          .update({ status: 'rejected', updated_at: new Date().toISOString() }).eq('id', input.proposalId)
        return { status: 'rejected' as const, proposerAlbumId: null as null, receiverAlbumId: null as null }
      }

      const { data: offeredRow } = await supabaseAdmin
        .from('album_stickers').select('status')
        .eq('album_id', proposal.proposer_album).eq('sticker_id', proposal.offered_sticker).maybeSingle()
      if (!offeredRow || offeredRow.status !== 'repeated')
        throw new TRPCError({ code: 'CONFLICT', message: 'Figurinha oferecida não está mais disponível' })

      const { data: wantedRow } = await supabaseAdmin
        .from('album_stickers').select('status')
        .eq('album_id', proposal.receiver_album).eq('sticker_id', proposal.wanted_sticker).maybeSingle()
      if (!wantedRow || wantedRow.status !== 'repeated')
        throw new TRPCError({ code: 'CONFLICT', message: 'Figurinha solicitada não está mais disponível' })

      const { data: locked } = await supabaseAdmin
        .from('trade_proposals')
        .update({ status: 'accepted', updated_at: new Date().toISOString() })
        .eq('id', input.proposalId)
        .eq('status', 'pending')
        .select('id')
      if (!locked?.length)
        throw new TRPCError({ code: 'CONFLICT', message: 'Proposta já foi respondida por outra operação' })

      await adjustSticker(proposal.proposer_album, proposal.offered_sticker, 'decrement', proposal.proposer_id)
      await adjustSticker(proposal.proposer_album, proposal.wanted_sticker, 'gain', proposal.proposer_id)
      await adjustSticker(proposal.receiver_album, proposal.wanted_sticker, 'decrement', ctx.userId)
      await adjustSticker(proposal.receiver_album, proposal.offered_sticker, 'gain', ctx.userId)

      return {
        status: 'accepted' as const,
        proposerAlbumId: proposal.proposer_album as string,
        receiverAlbumId: proposal.receiver_album as string,
      }
    }),

  cancel: protectedProcedure
    .input(z.object({ proposalId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const { data: proposal } = await supabaseAdmin
        .from('trade_proposals').select('id')
        .eq('id', input.proposalId).eq('proposer_id', ctx.userId).eq('status', 'pending').maybeSingle()
      if (!proposal)
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Proposta não encontrada' })
      await supabaseAdmin.from('trade_proposals')
        .update({ status: 'cancelled', updated_at: new Date().toISOString() }).eq('id', input.proposalId)
      return { success: true }
    }),

  listProposals: protectedProcedure.query(async ({ ctx }) => {
    const { data: proposals, error } = await supabaseAdmin
      .from('trade_proposals').select('*')
      .or(`proposer_id.eq.${ctx.userId},receiver_id.eq.${ctx.userId}`)
      .order('created_at', { ascending: false })
    if (error) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: error.message })

    if (!proposals?.length) return []

    const otherUserIds = [...new Set(
      proposals.map(p => p.proposer_id === ctx.userId ? p.receiver_id : p.proposer_id),
    )]

    const { data: profiles } = await supabaseAdmin
      .from('profiles').select('user_id, username, phone').in('user_id', otherUserIds)
    const profileMap = new Map((profiles ?? []).map(p => [p.user_id, { username: p.username as string, phone: (p.phone as string | null) ?? null }]))
    const stickerMap = new Map(ALL_STICKERS.map(s => [s.id, { countryName: s.countryName, section: s.section }]))

    return (proposals ?? []).map(p => ({
      id: p.id as string,
      direction: (p.proposer_id === ctx.userId ? 'outgoing' : 'incoming') as 'outgoing' | 'incoming',
      offeredSticker: { id: p.offered_sticker as string, ...(stickerMap.get(p.offered_sticker) ?? { countryName: p.offered_sticker, section: '' }) },
      wantedSticker: { id: p.wanted_sticker as string, ...(stickerMap.get(p.wanted_sticker) ?? { countryName: p.wanted_sticker, section: '' }) },
      otherUserId: (p.proposer_id === ctx.userId ? p.receiver_id : p.proposer_id) as string,
      otherUsername: profileMap.get(p.proposer_id === ctx.userId ? p.receiver_id : p.proposer_id)?.username ?? '?',
      otherPhone: p.status === 'accepted'
        ? (profileMap.get(p.proposer_id === ctx.userId ? p.receiver_id : p.proposer_id)?.phone ?? null)
        : null,
      proposerAlbumId: p.proposer_album as string,
      receiverAlbumId: p.receiver_album as string,
      status: p.status as 'pending' | 'accepted' | 'rejected' | 'cancelled',
      createdAt: p.created_at as string,
      updatedAt: p.updated_at as string,
    }))
  }),
})
