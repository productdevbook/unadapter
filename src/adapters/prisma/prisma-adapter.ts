import type {
  AdapterOptions,
  InferModelTypes,
  UnDbSchema,
  Where,
} from 'unadapter/types'
import type { AdapterDebugLogs } from '../create/index.ts'
import { BetterAuthError } from '../../error/index.ts'
import { createAdapter } from '../create/index.ts'

export interface PrismaConfig {
  /**
   * Database provider.
   */
  provider:
    | 'sqlite'
    | 'cockroachdb'
    | 'mysql'
    | 'postgresql'
    | 'sqlserver'
    | 'mongodb'

  /**
   * Enable debug logs for the adapter
   *
   * @default false
   */
  debugLogs?: AdapterDebugLogs

  /**
   * Use plural table names
   *
   * @default false
   */
  usePlural?: boolean
}

interface PrismaClient {}

interface PrismaClientInternal {
  [model: string]: {
    create: (data: any) => Promise<any>
    findFirst: (data: any) => Promise<any>
    findMany: (data: any) => Promise<any>
    update: (data: any) => Promise<any>
    delete: (data: any) => Promise<any>
    [key: string]: any
  }
}

export function prismaAdapter<
  T extends Record<string, any>,
  Schema extends UnDbSchema = UnDbSchema,
  Models extends Record<string, any> = InferModelTypes<Schema>,
>(
  prisma: PrismaClient,
  getTables: (options: AdapterOptions<T>) => Schema,
  config: PrismaConfig,
) {
  return createAdapter<T, Schema, Models>({
    getTables,
    config: {
      adapterId: 'prisma',
      adapterName: 'Prisma Adapter',
      usePlural: config.usePlural ?? false,
      debugLogs: config.debugLogs ?? false,
    },
    adapter: ({ getFieldName }) => {
      const db = prisma as PrismaClientInternal

      const convertSelect = (select?: string[], model?: string) => {
        if (!select || !model)
          return undefined
        return select.reduce((prev, cur) => {
          return {
            ...prev,
            [getFieldName({ model, field: cur })]: true,
          }
        }, {})
      }
      function operatorToPrismaOperator(operator: string) {
        switch (operator) {
          case 'starts_with':
            return 'startsWith'
          case 'ends_with':
            return 'endsWith'
          default:
            return operator
        }
      }
      const convertWhereClause = (model: string, where?: Where[]) => {
        if (!where)
          return {}
        if (where.length === 1) {
          const w = where[0]
          if (!w) {
            return
          }
          return {
            [getFieldName({ model, field: w.field })]:
            w.operator === 'eq' || !w.operator
              ? w.value
              : {
                  [operatorToPrismaOperator(w.operator)]: w.value,
                },
          }
        }
        const and = where.filter(w => w.connector === 'AND' || !w.connector)
        const or = where.filter(w => w.connector === 'OR')
        const andClause = and.map((w) => {
          return {
            [getFieldName({ model, field: w.field })]:
            w.operator === 'eq' || !w.operator
              ? w.value
              : {
                  [operatorToPrismaOperator(w.operator)]: w.value,
                },
          }
        })
        const orClause = or.map((w) => {
          return {
            [getFieldName({ model, field: w.field })]: {
              [w.operator || 'eq']: w.value,
            },
          }
        })

        return {
          ...(andClause.length ? { AND: andClause } : {}),
          ...(orClause.length ? { OR: orClause } : {}),
        }
      }

      return {
        async create<M extends keyof Models>({
          model,
          data: values,
          select,
        }: {
          model: M & string
          data: Omit<Models[M], 'id'>
          select?: string[]
        }) {
          if (!db[model]) {
            throw new BetterAuthError(
              `Model ${model} does not exist in the database. If you haven't generated the Prisma client, you need to run 'npx prisma generate'`,
            )
          }
          return await db[model].create({
            data: values,
            select: convertSelect(select, model),
          })
        },
        async findOne<M extends keyof Models>({
          model,
          where,
          select,
        }: {
          model: M & string
          where: Where[]
          select?: string[]
        }) {
          const whereClause = convertWhereClause(model, where)
          if (!db[model]) {
            throw new BetterAuthError(
              `Model ${model} does not exist in the database. If you haven't generated the Prisma client, you need to run 'npx prisma generate'`,
            )
          }
          return await db[model].findFirst({
            where: whereClause,
            select: convertSelect(select, model),
          })
        },
        async findMany<M extends keyof Models>({
          model,
          where,
          limit,
          offset,
          sortBy,
          select,
        }: {
          model: M & string
          where?: Where[]
          limit?: number
          offset?: number
          sortBy?: { field: string, direction: 'asc' | 'desc' }
          select?: string[]
        }) {
          const whereClause = convertWhereClause(model, where)
          if (!db[model]) {
            throw new BetterAuthError(
              `Model ${model} does not exist in the database. If you haven't generated the Prisma client, you need to run 'npx prisma generate'`,
            )
          }

          return (await db[model].findMany({
            where: whereClause,
            take: limit || 100,
            skip: offset || 0,
            ...(sortBy?.field
              ? {
                  orderBy: {
                    [getFieldName({ model, field: sortBy.field })]:
                    sortBy.direction === 'desc' ? 'desc' : 'asc',
                  },
                }
              : {}),
            select: convertSelect(select, model),
          })) as Models[M][]
        },
        async count({ model, where }) {
          const whereClause = convertWhereClause(model, where)
          if (!db[model]) {
            throw new BetterAuthError(
              `Model ${model} does not exist in the database. If you haven't generated the Prisma client, you need to run 'npx prisma generate'`,
            )
          }
          return await db[model].count({
            where: whereClause,
          })
        },
        async update<M extends keyof Models>({
          model,
          where,
          update,
        }: {
          model: M & string
          where: Where[]
          update: Partial<Models[M]>
        }) {
          if (!db[model]) {
            throw new BetterAuthError(
              `Model ${model} does not exist in the database. If you haven't generated the Prisma client, you need to run 'npx prisma generate'`,
            )
          }
          const whereClause = convertWhereClause(model, where)
          return await db[model].update({
            where: whereClause,
            data: update,
          })
        },
        async updateMany<M extends keyof Models>({
          model,
          where,
          update,
        }: {
          model: M & string
          where: Where[]
          update: Partial<Models[M]>
        }) {
          const whereClause = convertWhereClause(model, where)
          const result = await db[model].updateMany({
            where: whereClause,
            data: update,
          })
          return result ? (result.count as number) : 0
        },
        async delete({ model, where }) {
          const whereClause = convertWhereClause(model, where)
          try {
            await db[model].delete({
              where: whereClause,
            })
          }
          catch {
            // If the record doesn't exist, we don't want to throw an error
          }
        },
        async deleteMany({ model, where }) {
          const whereClause = convertWhereClause(model, where)
          const result = await db[model].deleteMany({
            where: whereClause,
          })
          return result ? (result.count as number) : 0
        },
        options: config,
      }
    },
  })
}
