import { router } from '../trpc'
import { stickersRouter } from './stickers'
import { profileRouter } from './profile'
import { albumsRouter } from './albums'
import { tradesRouter } from './trades'

export const appRouter = router({
  stickers: stickersRouter,
  profile: profileRouter,
  albums: albumsRouter,
  trades: tradesRouter,
})

export type AppRouter = typeof appRouter
