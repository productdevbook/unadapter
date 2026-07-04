import type { BetterAuthOptions } from "./better-auth.schema.ts"
import { createAdapter } from "../src/index.ts"
import { describe, expect, test } from "vitest"
import { memoryAdapter } from "../src/adapters/memory/memory-adapter.ts"
import { getAuthTables } from "./better-auth.schema.ts"
import { runAdapterTest, runNumberIdAdapterTest } from "./test.ts"

describe("adapter test", async () => {
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
            email: "email_address",
          },
        },
        ...customOptions,
      })
    },
  })
})

describe("number Id Adapter Test", async () => {
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

describe("memory adapter range filters", () => {
  async function getRangeAdapter() {
    return createAdapter<BetterAuthOptions>(getAuthTables, {
      database: memoryAdapter({
        user: [],
        session: [],
        account: [],
      }),
      user: {
        additionalFields: {
          sequenceId: {
            type: "number",
            required: true,
            sortable: true,
            fieldName: "sequenceId",
          },
        },
      },
    })
  }

  test("findMany applies numeric gt/gte/lt/lte comparisons", async () => {
    const adapter = await getRangeAdapter()

    for (const sequenceId of [1, 2, 3]) {
      await adapter.create({
        model: "user",
        data: {
          name: `event-${sequenceId}`,
          email: `event-${sequenceId}@email.com`,
          emailVerified: true,
          createdAt: new Date(),
          updatedAt: new Date(),
          sequenceId,
        } as any,
      })
    }

    async function findSequenceIds(operator: "gt" | "gte" | "lt" | "lte", value: number) {
      const rows = await adapter.findMany({
        model: "user",
        where: [{ field: "sequenceId", operator, value }],
        sortBy: { field: "sequenceId", direction: "asc" },
      })

      return rows.map((row: any) => row.sequenceId)
    }

    await expect(findSequenceIds("gt", 1)).resolves.toEqual([2, 3])
    await expect(findSequenceIds("gte", 2)).resolves.toEqual([2, 3])
    await expect(findSequenceIds("lt", 3)).resolves.toEqual([1, 2])
    await expect(findSequenceIds("lte", 2)).resolves.toEqual([1, 2])
  })
})
