import { PrismaClient } from '@prisma/client'
import { prismaAdapter } from '../../../src/adapters/prisma/index.ts'
import { getAuthTables } from '../../better-auth.schema.ts'

export function getAdapter() {
  const db = new PrismaClient()

  async function clearDb() {
    await db.user.deleteMany()
    try {
      await db.$executeRaw`DELETE FROM sqlite_sequence WHERE name = 'User'`
    }
    catch {}
  }

  const adapter = prismaAdapter(
    db,
    getAuthTables,
    {
      provider: 'sqlite',
      debugLogs: {
        isRunningAdapterTests: true,
      },
    },
  )

  return { adapter, clearDb }
}
