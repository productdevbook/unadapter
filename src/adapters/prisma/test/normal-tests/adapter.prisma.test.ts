import { beforeAll, describe } from 'vitest'
import { runAdapterTest } from '../../../test.ts'
import { pushPrismaSchema } from '../push-schema.ts'
import { setState } from '../state.ts'
import { createTestOptions } from '../test-options.ts'

describe('adapter tests', async () => {
  beforeAll(async () => {
    setState('RUNNING')
    await pushPrismaSchema('normal')
    console.log('Successfully pushed normal Prisma Schema using pnpm...')
    const { getAdapter } = await import('./get-adapter.ts')
    const { clearDb } = getAdapter()
    await clearDb()
    return () => {
      console.log(
        `Normal Prisma adapter test finished. Now allowing number ID prisma tests to run.`,
      )
      setState('IDLE')
    }
  })

  await runAdapterTest({
    getAdapter: async (customOptions = {}) => {
      const { getAdapter } = await import('./get-adapter.ts')
      const { adapter } = getAdapter()
      const { advanced, database, user } = createTestOptions(adapter)
      return adapter({
        ...customOptions,
        user: {
          ...user,
          ...customOptions.user,
        },
        advanced: {
          ...advanced,
          ...customOptions.advanced,
        },
        database,
      })
    },
  })
})
