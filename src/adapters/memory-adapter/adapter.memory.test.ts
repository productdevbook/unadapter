import { describe } from 'vitest'
import { runAdapterTest, runNumberIdAdapterTest } from '../test.ts'
import { memoryAdapter } from './memory-adapter.ts'

describe('adapter test', async () => {
  const db = {
    user: [],
    session: [],
    account: [],
  }
  const adapter = memoryAdapter(db, {
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
  const adapter = memoryAdapter(db, {
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
