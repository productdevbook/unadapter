import { MongoClient } from 'mongodb'

import { beforeAll, describe } from 'vitest'
import { mongodbAdapter } from '../src/adapters/mongodb/index.ts'
import { runAdapterTest } from './test.ts'

describe('adapter test', async () => {
  const dbClient = async (connectionString: string, dbName: string) => {
    const client = new MongoClient(connectionString)
    await client.connect()
    const db = client.db(dbName)
    return db
  }

  const user = 'user'
  const db = await dbClient('mongodb://127.0.0.1:27017', 'better-auth')
  async function clearDb() {
    await db.collection(user).deleteMany({})
    await db.collection('session').deleteMany({})
  }

  beforeAll(async () => {
    await clearDb()
  })

  const adapter = mongodbAdapter(db)
  await runAdapterTest({
    getAdapter: async (customOptions = {}) => {
      return adapter({
        user: {
          fields: {
            email: 'email_address',
          },
          additionalFields: {
            test: {
              type: 'string',
              defaultValue: 'test',
            },
          },
        },
        ...customOptions,
      })
    },
    disableTests: {
      SHOULD_PREFER_GENERATE_ID_IF_PROVIDED: true,
    },
  })
})
