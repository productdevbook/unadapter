import * as fs from 'node:fs'
import { beforeAll, describe } from 'vitest'
import { getAuthTables } from '../../better-auth.schema.ts'
import { runNumberIdAdapterTest } from '../../test.ts'
import { pushPrismaSchema } from '../push-schema.ts'
import { getState, stateFilePath } from '../state.ts'
import { createTestOptions } from '../test-options.ts'

describe('number Id Adapter Test', async () => {
  beforeAll(async () => {
    await new Promise((resolve) => {
      const checkState = async () => {
        await new Promise(r => setTimeout(r, 500))
        if (getState() === 'IDLE') {
          resolve(true)
          return
        }
        console.log(`Waiting for state to be IDLE...`)
        fs.watch(stateFilePath, () => {
          if (getState() === 'IDLE') {
            resolve(true)
          }
        })
      }

      checkState()
    })
    console.log(`Now running Number ID Prisma adapter test...`)
    await pushPrismaSchema('number-id')
    console.log(`Successfully pushed number id Prisma Schema using pnpm...`)
    const { getAdapter } = await import('./get-adapter.ts')
    const { clearDb } = getAdapter()
    await clearDb()
  }, Number.POSITIVE_INFINITY)

  await runNumberIdAdapterTest({
    getAdapter: async (customOptions = {}) => {
      const { getAdapter } = await import('./get-adapter.ts')
      const { adapter } = getAdapter()
      const { advanced, database, user } = createTestOptions(adapter)
      return adapter(getAuthTables, {
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
