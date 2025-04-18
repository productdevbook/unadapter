import type { BetterAuthOptions } from './better-auth.schema.ts'
import { createAdapter } from 'unadapter'
import { describe } from 'vitest'
import { memoryAdapter } from '../src/adapters/memory/memory-adapter.ts'
import { getAuthTables } from './better-auth.schema.ts'
import { runAdapterTest, runNumberIdAdapterTest } from './test.ts'

describe('adapter test', async () => {
  const db = {
    user: [],
    session: [],
    account: [],
  }

  await runAdapterTest({
    getAdapter: async (customOptions = {}) => {
      return createAdapter<BetterAuthOptions>(getAuthTables, {
        database: memoryAdapter(db, {
          debugLogs: {
            isRunningAdapterTests: true,
          },
        }),
        user: {
          fields: {
            email: 'email_address',
          },
        },
        ...customOptions,
      })
    },
  })
})

describe('number Id Adapter Test', async () => {
  const db = {
    user: [],
    session: [],
    account: [],
  }

  await runNumberIdAdapterTest({
    getAdapter: async (customOptions = {}) => {
      return createAdapter<BetterAuthOptions>(getAuthTables, {
        database: memoryAdapter(db, {
          debugLogs: {
            isRunningAdapterTests: true,
          },
        }),
        ...customOptions,
      })
    },
  })
})
