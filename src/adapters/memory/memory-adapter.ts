import type {
  AdapterOptions,
  InferFieldsInput,
  UnDbSchema,
} from 'unadapter/types'
import type {
  AdapterDebugLogs,
  CleanedWhere,
} from '../create/index.ts'
import {
  createAdapter,
} from '../create/index.ts'

export interface MemoryDB {
  [key: string]: any[]
}

export interface MemoryAdapterConfig {
  debugLogs?: AdapterDebugLogs
}

export function memoryAdapter<
  T extends Record<string, any>,
  Schema extends UnDbSchema,
>(
  db: MemoryDB,
  getTables: (options: AdapterOptions<T>) => Schema,
  config?: MemoryAdapterConfig,
) {
  return createAdapter<T, Schema>({
    getTables: options => getTables(options as AdapterOptions<T>),
    config: {
      adapterId: 'memory',
      adapterName: 'Memory Adapter',
      usePlural: false,
      debugLogs: config?.debugLogs || false,
      customTransformInput(props) {
        if (
          props.options.advanced?.database?.useNumberId
          && props.field === 'id'
          && props.action === 'create'
        ) {
          return db[props.model].length + 1
        }
        return props.data
      },
    },
    adapter: ({ getFieldName, options }) => {
      function convertWhereClause(where: CleanedWhere[], table: any[]) {
        return table.filter((record) => {
          return where.every((clause) => {
            const { field, value, operator } = clause

            if (operator === 'in') {
              if (!Array.isArray(value)) {
                throw new TypeError('Value must be an array')
              }
              // @ts-ignore
              return value.includes(record[field])
            }
            else if (operator === 'contains') {
              return record[field].includes(value)
            }
            else if (operator === 'starts_with') {
              return record[field].startsWith(value)
            }
            else if (operator === 'ends_with') {
              return record[field].endsWith(value)
            }
            else {
              return record[field] === value
            }
          })
        })
      }
      return {
        create: async <M extends keyof Models>({
          model,
          data,
        }: {
          model: M & string
          data: Omit<Models[M], 'id'>
        }) => {
          if (options.advanced?.database?.useNumberId) {
            // @ts-ignore
            data.id = db[model].length + 1
          }
          db[model].push(data)
          return data
        },
        findOne: async <M extends keyof Models>({
          model,
          where,
        }: {
          model: M & string
          where: CleanedWhere[]
        }) => {
          const table = db[model]
          const res = convertWhereClause(where, table)
          const record = res[0] || null
          return record as (Models[M] | null)
        },
        findMany: async <M extends keyof Models>({
          model,
          where,
          sortBy,
          limit,
          offset,
        }: {
          model: M & string
          where?: CleanedWhere[]
          sortBy?: { field: string, direction: 'asc' | 'desc' }
          limit?: number
          offset?: number
        }) => {
          let table = db[model]
          if (where) {
            table = convertWhereClause(where, table)
          }
          if (sortBy) {
            table = table.sort((a, b) => {
              const field = getFieldName({ model, field: sortBy.field })
              if (sortBy.direction === 'asc') {
                return a[field] > b[field] ? 1 : -1
              }
              else {
                return a[field] < b[field] ? 1 : -1
              }
            })
          }
          if (offset !== undefined) {
            table = table.slice(offset)
          }
          if (limit !== undefined) {
            table = table.slice(0, limit)
          }
          return table as Models[M][]
        },
        count: async ({ model }) => {
          return db[model].length
        },
        update: async <M extends keyof Models>({
          model,
          where,
          update,
        }: {
          model: M & string
          where: CleanedWhere[]
          update: Partial<Models[M]>
        }) => {
          const table = db[model]
          const res = convertWhereClause(where, table)
          res.forEach((record) => {
            Object.assign(record, update)
          })
          return res[0] || null as (Models[M] | null)
        },
        delete: async ({ model, where }) => {
          const table = db[model]
          const res = convertWhereClause(where, table)
          db[model] = table.filter(record => !res.includes(record))
        },
        deleteMany: async ({ model, where }) => {
          const table = db[model]
          const res = convertWhereClause(where, table)
          let count = 0
          db[model] = table.filter((record) => {
            if (res.includes(record)) {
              count++
              return false
            }
            return !res.includes(record)
          })
          return count
        },
        updateMany<M extends keyof Models>({
          model,
          where,
          update,
        }: {
          model: M & string
          where: CleanedWhere[]
          update: Partial<Models[M]>
        }) {
          const table = db[model]
          const res = convertWhereClause(where, table)
          res.forEach((record) => {
            Object.assign(record, update)
          })
          return res[0] || null as (Models[M] | null)
        },
      }
    },
  })
}
