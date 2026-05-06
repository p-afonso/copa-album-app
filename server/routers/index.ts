import { router } from '../trpc'
import { stickersRouter } from './stickers'
import { profileRouter } from './profile'
import { albumsRouter } from './albums'

export const appRouter = router({
  stickers: stickersRouter,
  profile: profileRouter,
  albums: albumsRouter,
})

export type AppRouter = typeof appRouter
