import { PrismaClient } from '@prisma/client'
import { prismaAdapter } from '../../../src/adapters/prisma/index.ts'

export function getAdapter() {
  const db = new PrismaClient()

  async function clearDb() {
    await db.user.deleteMany()
  }

  const adapter = prismaAdapter(
    db,
    {
      provider: 'sqlite',
      debugLogs: {
        isRunningAdapterTests: true,
      },
    },
  )

  return { adapter, clearDb }
}
