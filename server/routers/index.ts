import { router } from '../trpc'
import { stickersRouter } from './stickers'

export const appRouter = router({
  stickers: stickersRouter,
})

export type AppRouter = typeof appRouter
