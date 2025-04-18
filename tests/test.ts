// @ts-nocheck - Test dosyasında tip kontrolleri devre dışı bırakıldı
import type { Adapter, AdapterOptions, User } from '../src/types/index.ts'
import { beforeAll, describe, expect, test } from 'vitest'

interface AdapterTestOptions<T extends Record<string, any>> {
  getAdapter: (
    customOptions?: Omit<AdapterOptions<T>, 'database'>,
  ) => Promise<Adapter>
  disableTests?: Partial<Record<keyof typeof adapterTests, boolean>>
  testPrefix?: string
}

interface NumberIdAdapterTestOptions<T extends Record<string, any> = Record<string, any>> {
  getAdapter: (
    customOptions?: Omit<AdapterOptions<T>, 'database'>,
  ) => Promise<Adapter>
  disableTests?: Partial<Record<keyof typeof numberIdAdapterTests, boolean>>
  testPrefix?: string
}

const adapterTests = {
  CREATE_MODEL: 'create model',
  CREATE_MODEL_SHOULD_ALWAYS_RETURN_AN_ID: 'create model should always return an id',
  FIND_MODEL: 'find model',
  FIND_MODEL_WITHOUT_ID: 'find model without id',
  FIND_MODEL_WITH_SELECT: 'find model with select',
  FIND_MODEL_WITH_MODIFIED_FIELD_NAME: 'find model with modified field name',
  UPDATE_MODEL: 'update model',
  SHOULD_FIND_MANY: 'should find many',
  SHOULD_FIND_MANY_WITH_WHERE: 'should find many with where',
  SHOULD_FIND_MANY_WITH_OPERATORS: 'should find many with operators',
  SHOULD_WORK_WITH_REFERENCE_FIELDS: 'should work with reference fields',
  SHOULD_FIND_MANY_WITH_SORT_BY: 'should find many with sortBy',
  SHOULD_FIND_MANY_WITH_LIMIT: 'should find many with limit',
  SHOULD_FIND_MANY_WITH_OFFSET: 'should find many with offset',
  SHOULD_UPDATE_WITH_MULTIPLE_WHERE: 'should update with multiple where',
  DELETE_MODEL: 'delete model',
  SHOULD_DELETE_MANY: 'should delete many',
  SHOULD_NOT_THROW_ON_DELETE_RECORD_NOT_FOUND: 'shouldn\'t throw on delete record not found',
  SHOULD_NOT_THROW_ON_RECORD_NOT_FOUND: 'shouldn\'t throw on record not found',
  SHOULD_FIND_MANY_WITH_CONTAINS_OPERATOR: 'should find many with contains operator',
  SHOULD_SEARCH_USERS_WITH_STARTS_WITH: 'should search users with startsWith',
  SHOULD_SEARCH_USERS_WITH_ENDS_WITH: 'should search users with endsWith',
  SHOULD_PREFER_GENERATE_ID_IF_PROVIDED: 'should prefer generateId if provided',
} as const

const { ...numberIdAdapterTestsCopy } = adapterTests

const numberIdAdapterTests = {
  ...numberIdAdapterTestsCopy,
  SHOULD_RETURN_A_NUMBER_ID_AS_A_RESULT: 'Should return a number id as a result',
  SHOULD_INCREMENT_THE_ID_BY_1: 'Should increment the id by 1',
} as const

async function adapterTest<T extends Record<string, any> = Record<string, any>>(
  { getAdapter, disableTests: disabledTests, testPrefix }: AdapterTestOptions<T>,
  internalOptions?: {
    predefinedOptions: Omit<T, 'database'>
  },
) {
  const adapter = async () =>
    await getAdapter(internalOptions?.predefinedOptions)

  async function resetDebugLogs() {
    // @ts-expect-error - Adapter debug logs are only available in test mode
    (await adapter())?.adapterTestDebugLogs?.resetDebugLogs()
  }

  async function printDebugLogs() {
    // @ts-expect-error - Adapter debug logs are only available in test mode
    (await adapter())?.adapterTestDebugLogs?.printDebugLogs()
  }

  // @ts-expect-error - Intentionally omitting id for test data
  const user: {
    name: string
    email: string
    emailVerified: boolean
    createdAt: Date
    updatedAt: Date
    id: string
  } = {
    name: 'user',
    email: 'user@email.com',
    emailVerified: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  }

  test.skipIf(disabledTests?.CREATE_MODEL)(
    `${testPrefix ? `${testPrefix} - ` : ''}${adapterTests.CREATE_MODEL}`,
    async ({ onTestFailed }) => {
      resetDebugLogs()
      onTestFailed(() => {
        printDebugLogs()
      })
      const res = await (await adapter()).create({
        model: 'user',
        data: user,
      })
      user.id = res.id
      expect({
        name: res.name,
        email: res.email,
      }).toEqual({
        name: user.name,
        email: user.email,
      })
    },
  )

  test.skipIf(disabledTests?.CREATE_MODEL_SHOULD_ALWAYS_RETURN_AN_ID)(
    `${testPrefix ? `${testPrefix} - ` : ''}${
      adapterTests.CREATE_MODEL_SHOULD_ALWAYS_RETURN_AN_ID
    }`,
    async ({ onTestFailed }) => {
      resetDebugLogs()
      onTestFailed(() => {
        printDebugLogs()
      })
      const res = await (await adapter()).create({
        model: 'user',
        data: {
          name: 'test-name-without-id',
          email: 'test-email-without-id@email.com',
        },
      })
      expect(res).toHaveProperty('id')
      // @ts-ignore
      expect(typeof res?.id).toEqual('string')
    },
  )

  test.skipIf(disabledTests?.FIND_MODEL)(
    `${testPrefix ? `${testPrefix} - ` : ''}${adapterTests.FIND_MODEL}`,
    async ({ onTestFailed }) => {
      resetDebugLogs()
      onTestFailed(() => {
        printDebugLogs()
      })
      const res = await (await adapter()).findOne<User>({
        model: 'user',
        where: [
          {
            field: 'id',
            value: user.id,
          },
        ],
      })
      expect({
        name: res?.name,
        email: res?.email,
      }).toEqual({
        name: user.name,
        email: user.email,
      })
    },
  )

  test.skipIf(disabledTests?.FIND_MODEL_WITHOUT_ID)(
    `${testPrefix ? `${testPrefix} - ` : ''}${
      adapterTests.FIND_MODEL_WITHOUT_ID
    }`,
    async ({ onTestFailed }) => {
      resetDebugLogs()
      onTestFailed(() => {
        printDebugLogs()
      })
      const res = await (await adapter()).findOne<User>({
        model: 'user',
        where: [
          {
            field: 'email',
            value: user.email,
          },
        ],
      })
      expect({
        name: res?.name,
        email: res?.email,
      }).toEqual({
        name: user.name,
        email: user.email,
      })
    },
  )

  test.skipIf(disabledTests?.FIND_MODEL_WITH_MODIFIED_FIELD_NAME)(
    `${testPrefix ? `${testPrefix} - ` : ''}${
      adapterTests.FIND_MODEL_WITH_MODIFIED_FIELD_NAME
    }`,
    async ({ onTestFailed }) => {
      resetDebugLogs()
      onTestFailed(() => {
        printDebugLogs()
      })
      const email = 'test-email-with-modified-field@email.com'
      const adapter = await getAdapter(
        Object.assign(
          {
            user: {
              fields: {
                email: 'email_address',
              },
            },
          },
          internalOptions?.predefinedOptions,
        ),
      )
      const user = await adapter.create({
        model: 'user',
        data: {
          email,
          name: 'test-name-with-modified-field',
          emailVerified: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      })
      expect(user.email).toEqual(email)
      const res = await adapter.findOne<User>({
        model: 'user',
        where: [
          {
            field: 'email',
            value: email,
          },
        ],
      })
      expect(res).not.toBeNull()
      expect(res?.email).toEqual(email)
    },
  )

  test.skipIf(disabledTests?.FIND_MODEL_WITH_SELECT)(
    `${testPrefix ? `${testPrefix} - ` : ''}${
      adapterTests.FIND_MODEL_WITH_SELECT
    }`,
    async ({ onTestFailed }) => {
      resetDebugLogs()
      onTestFailed(() => {
        printDebugLogs()
      })
      const res = await (await adapter()).findOne({
        model: 'user',
        where: [
          {
            field: 'id',
            value: user.id,
          },
        ],
        select: ['email'],
      })
      expect(res).toEqual({ email: user.email })
    },
  )

  test.skipIf(disabledTests?.UPDATE_MODEL)(
    `${testPrefix ? `${testPrefix} - ` : ''}${adapterTests.UPDATE_MODEL}`,
    async ({ onTestFailed }) => {
      resetDebugLogs()
      onTestFailed(() => {
        printDebugLogs()
      })
      const newEmail = 'updated@email.com'

      const res = await (await adapter()).update<User>({
        model: 'user',
        where: [
          {
            field: 'id',
            value: user.id,
          },
        ],
        update: {
          email: newEmail,
        },
      })
      expect(res).toMatchObject({
        email: newEmail,
        name: user.name,
      })
    },
  )

  test.skipIf(disabledTests?.SHOULD_FIND_MANY)(
    `${testPrefix ? `${testPrefix} - ` : ''}${adapterTests.SHOULD_FIND_MANY}`,
    async ({ onTestFailed }) => {
      resetDebugLogs()
      onTestFailed(() => {
        printDebugLogs()
      })
      const res = await (await adapter()).findMany({
        model: 'user',
      })
      expect(res.length).toBe(3)
    },
  )

  test.skipIf(disabledTests?.SHOULD_FIND_MANY_WITH_WHERE)(
    `${testPrefix ? `${testPrefix} - ` : ''}${
      adapterTests.SHOULD_FIND_MANY_WITH_WHERE
    }`,
    async ({ onTestFailed }) => {
      resetDebugLogs()
      onTestFailed(() => {
        printDebugLogs()
      })
      const user = await (await adapter()).create<User>({
        model: 'user',
        data: {
          name: 'user2',
          email: 'test@email.com',
          emailVerified: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      })
      const res = await (await adapter()).findMany({
        model: 'user',
        where: [
          {
            field: 'id',
            value: user.id,
          },
        ],
      })
      expect(res.length).toBe(1)
    },
  )

  test.skipIf(disabledTests?.SHOULD_FIND_MANY_WITH_OPERATORS)(
    `${testPrefix ? `${testPrefix} - ` : ''}${
      adapterTests.SHOULD_FIND_MANY_WITH_OPERATORS
    }`,
    async ({ onTestFailed }) => {
      resetDebugLogs()
      onTestFailed(() => {
        printDebugLogs()
      })
      const newUser = await (await adapter()).create<User>({
        model: 'user',
        data: {
          name: 'user',
          email: 'test-email2@email.com',
          emailVerified: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      })
      const res = await (await adapter()).findMany({
        model: 'user',
        where: [
          {
            field: 'id',
            operator: 'in',
            value: [user.id, newUser.id],
          },
        ],
      })
      expect(res.length).toBe(2)
    },
  )

  test.skipIf(disabledTests?.SHOULD_FIND_MANY_WITH_SORT_BY)(
    `${testPrefix ? `${testPrefix} - ` : ''}${
      adapterTests.SHOULD_FIND_MANY_WITH_SORT_BY
    }`,
    async ({ onTestFailed }) => {
      resetDebugLogs()
      onTestFailed(() => {
        printDebugLogs()
      })
      await (await adapter()).create({
        model: 'user',
        data: {
          name: 'a',
          email: 'a@email.com',
          emailVerified: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      })
      const res = await (await adapter()).findMany<User>({
        model: 'user',
        sortBy: {
          field: 'name',
          direction: 'asc',
        },
      })
      expect(res[0].name).toBe('a')

      const res2 = await (await adapter()).findMany<User>({
        model: 'user',
        sortBy: {
          field: 'name',
          direction: 'desc',
        },
      })

      expect(res2[res2.length - 1].name).toBe('a')
    },
  )

  test.skipIf(disabledTests?.SHOULD_FIND_MANY_WITH_LIMIT)(
    `${testPrefix ? `${testPrefix} - ` : ''}${
      adapterTests.SHOULD_FIND_MANY_WITH_LIMIT
    }`,
    async ({ onTestFailed }) => {
      resetDebugLogs()
      onTestFailed(() => {
        printDebugLogs()
      })
      const res = await (await adapter()).findMany({
        model: 'user',
        limit: 1,
      })
      expect(res.length).toBe(1)
    },
  )

  test.skipIf(disabledTests?.SHOULD_FIND_MANY_WITH_OFFSET)(
    `${testPrefix ? `${testPrefix} - ` : ''}${
      adapterTests.SHOULD_FIND_MANY_WITH_OFFSET
    }`,
    async ({ onTestFailed }) => {
      resetDebugLogs()
      onTestFailed(() => {
        printDebugLogs()
      })
      const res = await (await adapter()).findMany({
        model: 'user',
        offset: 2,
      })
      expect(res.length).toBe(4)
    },
  )

  test.skipIf(disabledTests?.SHOULD_UPDATE_WITH_MULTIPLE_WHERE)(
    `${testPrefix ? `${testPrefix} - ` : ''}${
      adapterTests.SHOULD_UPDATE_WITH_MULTIPLE_WHERE
    }`,
    async ({ onTestFailed }) => {
      resetDebugLogs()
      onTestFailed(() => {
        printDebugLogs()
      })
      await (await adapter()).updateMany({
        model: 'user',
        where: [
          {
            field: 'name',
            value: user.name,
          },
          {
            field: 'email',
            value: user.email,
          },
        ],
        update: {
          email: 'updated@email.com',
        },
      })
      const updatedUser = await (await adapter()).findOne<User>({
        model: 'user',
        where: [
          {
            field: 'email',
            value: 'updated@email.com',
          },
        ],
      })
      expect(updatedUser).toMatchObject({
        name: user.name,
        email: 'updated@email.com',
      })
    },
  )

  test.skipIf(disabledTests?.DELETE_MODEL)(
    `${testPrefix ? `${testPrefix} - ` : ''}${adapterTests.DELETE_MODEL}`,
    async ({ onTestFailed }) => {
      resetDebugLogs()
      onTestFailed(() => {
        printDebugLogs()
      })
      await (await adapter()).delete({
        model: 'user',
        where: [
          {
            field: 'id',
            value: user.id,
          },
        ],
      })
      const findRes = await (await adapter()).findOne({
        model: 'user',
        where: [
          {
            field: 'id',
            value: user.id,
          },
        ],
      })
      expect(findRes).toBeNull()
    },
  )

  test.skipIf(disabledTests?.SHOULD_DELETE_MANY)(
    `${testPrefix ? `${testPrefix} - ` : ''}${adapterTests.SHOULD_DELETE_MANY}`,
    async ({ onTestFailed }) => {
      resetDebugLogs()
      onTestFailed(() => {
        printDebugLogs()
      })
      for (const i of ['to-be-delete-1', 'to-be-delete-2', 'to-be-delete-3']) {
        await (await adapter()).create({
          model: 'user',
          data: {
            name: 'to-be-deleted',
            email: `email@test-${i}.com`,
            emailVerified: true,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        })
      }
      const findResFirst = await (await adapter()).findMany({
        model: 'user',
        where: [
          {
            field: 'name',
            value: 'to-be-deleted',
          },
        ],
      })
      expect(findResFirst.length).toBe(3)
      await (await adapter()).deleteMany({
        model: 'user',
        where: [
          {
            field: 'name',
            value: 'to-be-deleted',
          },
        ],
      })
      const findRes = await (await adapter()).findMany({
        model: 'user',
        where: [
          {
            field: 'name',
            value: 'to-be-deleted',
          },
        ],
      })
      expect(findRes.length).toBe(0)
    },
  )

  test.skipIf(disabledTests?.SHOULD_NOT_THROW_ON_DELETE_RECORD_NOT_FOUND)(
    `${testPrefix ? `${testPrefix} - ` : ''}${
      adapterTests.SHOULD_NOT_THROW_ON_DELETE_RECORD_NOT_FOUND
    }`,
    async ({ onTestFailed }) => {
      resetDebugLogs()
      onTestFailed(() => {
        printDebugLogs()
      })
      await (await adapter()).delete({
        model: 'user',
        where: [
          {
            field: 'id',
            value: '100000',
          },
        ],
      })
    },
  )

  test.skipIf(disabledTests?.SHOULD_NOT_THROW_ON_RECORD_NOT_FOUND)(
    `${testPrefix ? `${testPrefix} - ` : ''}${
      adapterTests.SHOULD_NOT_THROW_ON_RECORD_NOT_FOUND
    }`,
    async ({ onTestFailed }) => {
      resetDebugLogs()
      onTestFailed(() => {
        printDebugLogs()
      })
      const res = await (await adapter()).findOne({
        model: 'user',
        where: [
          {
            field: 'id',
            value: '100000',
          },
        ],
      })
      expect(res).toBeNull()
    },
  )

  test.skipIf(disabledTests?.SHOULD_FIND_MANY_WITH_CONTAINS_OPERATOR)(
    `${testPrefix ? `${testPrefix} - ` : ''}${
      adapterTests.SHOULD_FIND_MANY_WITH_CONTAINS_OPERATOR
    }`,
    async ({ onTestFailed }) => {
      resetDebugLogs()
      onTestFailed(() => {
        printDebugLogs()
      })
      const res = await (await adapter()).findMany({
        model: 'user',
        where: [
          {
            field: 'name',
            operator: 'contains',
            value: 'user2',
          },
        ],
      })
      expect(res.length).toBe(1)
    },
  )

  test.skipIf(disabledTests?.SHOULD_SEARCH_USERS_WITH_STARTS_WITH)(
    `${testPrefix ? `${testPrefix} - ` : ''}${
      adapterTests.SHOULD_SEARCH_USERS_WITH_STARTS_WITH
    }`,
    async ({ onTestFailed }) => {
      resetDebugLogs()
      onTestFailed(() => {
        printDebugLogs()
      })
      const res = await (await adapter()).findMany({
        model: 'user',
        where: [
          {
            field: 'name',
            operator: 'starts_with',
            value: 'us',
          },
        ],
      })
      expect(res.length).toBe(2)
    },
  )

  test.skipIf(disabledTests?.SHOULD_SEARCH_USERS_WITH_ENDS_WITH)(
    `${testPrefix ? `${testPrefix} - ` : ''}${
      adapterTests.SHOULD_SEARCH_USERS_WITH_ENDS_WITH
    }`,
    async ({ onTestFailed }) => {
      resetDebugLogs()
      onTestFailed(() => {
        printDebugLogs()
      })
      const res = await (await adapter()).findMany({
        model: 'user',
        where: [
          {
            field: 'name',
            operator: 'ends_with',
            value: 'er2',
          },
        ],
      })
      expect(res.length).toBe(1)
    },
  )

  test.skipIf(disabledTests?.SHOULD_PREFER_GENERATE_ID_IF_PROVIDED)(
    `${testPrefix ? `${testPrefix} - ` : ''}${
      adapterTests.SHOULD_PREFER_GENERATE_ID_IF_PROVIDED
    }`,
    async ({ onTestFailed }) => {
      resetDebugLogs()
      onTestFailed(() => {
        printDebugLogs()
      })
      const customAdapter = await getAdapter(
        Object.assign({
          advanced: {
            database: {
              generateId: () => 'mocked-id',
            },
          },
        } satisfies AdapterOptions, internalOptions?.predefinedOptions),
      )

      const res = await customAdapter.create({
        model: 'user',
        data: {
          name: 'user4',
          email: 'user4@email.com',
          emailVerified: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      })

      expect(res.id).toBe('mocked-id')
    },
  )
}

export async function runAdapterTest<T extends Record<string, any>>(opts: AdapterTestOptions<T>) {
  return adapterTest<T>(opts)
}

export async function runNumberIdAdapterTest(opts: NumberIdAdapterTestOptions) {
  const cleanup: { modelName: string, id: string }[] = []
  const adapter = async () =>
    await opts.getAdapter({
      advanced: {
        database: {
          useNumberId: true,
        },
      },
    })
  describe('Should run number id specific tests', async () => {
    let idNumber = -1

    async function resetDebugLogs() {
      // @ts-expect-error - Adapter debug logs are only available in test mode
      (await adapter())?.adapterTestDebugLogs?.resetDebugLogs()
    }

    async function printDebugLogs() {
      // @ts-expect-error - Adapter debug logs are only available in test mode
      (await adapter())?.adapterTestDebugLogs?.printDebugLogs()
    }
    test.skipIf(opts.disableTests?.SHOULD_RETURN_A_NUMBER_ID_AS_A_RESULT)(
      `${opts.testPrefix ? `${opts.testPrefix} - ` : ''}${
        numberIdAdapterTests.SHOULD_RETURN_A_NUMBER_ID_AS_A_RESULT
      }`,
      async ({ onTestFailed }) => {
        resetDebugLogs()
        onTestFailed(() => {
          printDebugLogs()
        })
        const res = await (await adapter()).create({
          model: 'user',
          data: {
            name: 'user',
            email: 'user@email.com',
          },
        })
        cleanup.push({ modelName: 'user', id: res.id })
        expect(typeof res.id).toBe('string') // we forcefully return all `id`s as strings. this is intentional.
        expect(Number.parseInt(res.id)).toBeGreaterThan(0)
        idNumber = Number.parseInt(res.id)
      },
    )
    test.skipIf(opts.disableTests?.SHOULD_INCREMENT_THE_ID_BY_1)(
      `${opts.testPrefix ? `${opts.testPrefix} - ` : ''}${
        numberIdAdapterTests.SHOULD_INCREMENT_THE_ID_BY_1
      }`,
      async ({ onTestFailed }) => {
        resetDebugLogs()
        onTestFailed(() => {
          console.log(`ID number from last create: ${idNumber}`)
          printDebugLogs()
        })
        const res = await (await adapter()).create({
          model: 'user',
          data: {
            name: 'user2',
            email: 'user2@email.com',
          },
        })
        cleanup.push({ modelName: 'user', id: res.id })
        expect(Number.parseInt(res.id)).toBe(idNumber + 1)
      },
    )
  })

  describe('Should run normal adapter tests with number id enabled', async () => {
    beforeAll(async () => {
      for (const { modelName, id } of cleanup) {
        await (await adapter()).delete({
          model: modelName,
          where: [{ field: 'id', value: id }],
        })
      }
    })
    await adapterTest(
      {
        ...opts,
        disableTests: {
          ...opts.disableTests,
          SHOULD_PREFER_GENERATE_ID_IF_PROVIDED: true,
        },
      },
      {
        predefinedOptions: {
          advanced: {
            database: {
              useNumberId: true,
            },
          },
        },
      },
    )
  })
}
