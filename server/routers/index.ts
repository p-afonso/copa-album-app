import { router } from '../trpc'
import { stickersRouter } from './stickers'
import { profileRouter } from './profile'

export const appRouter = router({
  stickers: stickersRouter,
  profile: profileRouter,
})

export type AppRouter = typeof appRouter
