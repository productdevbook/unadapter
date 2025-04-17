import type { BetterAuthOptions } from './better-auth.schema.ts'
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
  const adapter = memoryAdapter<BetterAuthOptions>(db, getAuthTables, {
    debugLogs: {
      isRunningAdapterTests: true,
    },
  })
  await runAdapterTest({
    getAdapter: async (customOptions = {}) => {
      return adapter({
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
  const adapter = memoryAdapter(db, getAuthTables, {
    debugLogs: {
      isRunningAdapterTests: true,
    },
  })
  await runNumberIdAdapterTest({
    getAdapter: async (customOptions = {}) => {
      return adapter({
        ...customOptions,
      })
    },
  })
})
