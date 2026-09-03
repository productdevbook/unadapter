import type { Adapter, TablesSchema } from "../../types/index.ts"
import type { AdapterDebugLogs, CleanedWhere } from "../create/index.ts"
import { createAdapter } from "../create/index.ts"

export interface MemoryDB {
  [key: string]: any[]
}

export interface MemoryAdapterConfig {
  debugLogs?: AdapterDebugLogs
}

export function memoryAdapter<
  T extends Record<string, any> = object,
  Schema extends TablesSchema = TablesSchema,
>(
  db: MemoryDB,
  config?: MemoryAdapterConfig,
): (getTables: (options: any) => Schema, options: any) => Adapter<T, Schema> {
  return createAdapter<T, Schema>({
    config: {
      adapterId: "memory",
      adapterName: "Memory Adapter",
      usePlural: false,
      debugLogs: config?.debugLogs || false,
      customTransformInput(props) {
        if (
          props.options.advanced?.database?.useNumberId &&
          props.field === "id" &&
          props.action === "create"
        ) {
          return db[props.model].length + 1
        }
        return props.data
      },
    },
    adapter: ({ getFieldName, options }) => {
      function matchClause(record: any, clause: CleanedWhere) {
        const { field, value, operator } = clause

        if (operator === "in") {
          if (!Array.isArray(value)) {
            throw new TypeError("Value must be an array")
          }
          // @ts-expect-error - Record may have any structure
          return value.includes(record[field])
        }
        if (operator === "contains") {
          return typeof record[field] === "string" && record[field].includes(value)
        }
        if (operator === "starts_with") {
          return typeof record[field] === "string" && record[field].startsWith(value)
        }
        if (operator === "ends_with") {
          return typeof record[field] === "string" && record[field].endsWith(value)
        }
        if (operator === "ne") {
          return record[field] !== value
        }
        if (operator === "gt" || operator === "gte" || operator === "lt" || operator === "lte") {
          // Range comparisons against null never match (SQL NULL semantics)
          if (value === null || record[field] === null || record[field] === undefined) {
            return false
          }
          switch (operator) {
            case "gt":
              return record[field] > value
            case "gte":
              return record[field] >= value
            case "lt":
              return record[field] < value
            case "lte":
              return record[field] <= value
          }
        }
        return record[field] === value
      }

      function convertWhereClause(where: CleanedWhere[], table: any[]) {
        if (!where || where.length === 0) return table
        const ands = where.filter((c) => (c.connector ?? "AND") !== "OR")
        const ors = where.filter((c) => c.connector === "OR")

        return table.filter((record) => {
          const andMatches = ands.every((c) => matchClause(record, c))
          const orMatches = ors.length === 0 || ors.some((c) => matchClause(record, c))
          return andMatches && orMatches
        })
      }
      return {
        create: async ({ model, data }) => {
          if (options.advanced?.database?.useNumberId) {
            data.id = db[model].length + 1
          }
          db[model].push(data)
          return data
        },
        findOne: async ({ model, where }) => {
          const table = db[model]
          const res = convertWhereClause(where, table)
          const record = res[0] || null
          return record
        },
        findMany: async ({ model, where, sortBy, limit, offset }) => {
          let table = db[model]
          if (where) {
            table = convertWhereClause(where, table)
          }
          if (sortBy) {
            table = table.sort((a, b) => {
              const field = getFieldName({ model, field: sortBy.field })
              if (sortBy.direction === "asc") {
                return a[field] > b[field] ? 1 : -1
              } else {
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
          return table
        },
        count: async ({ model, where }) => {
          const table = db[model]
          if (where && where.length > 0) {
            return convertWhereClause(where, table).length
          }
          return table.length
        },
        update: async ({ model, where, update }) => {
          const table = db[model]
          const res = convertWhereClause(where, table)
          res.forEach((record) => {
            Object.assign(record, update)
          })
          return res[0] || null
        },
        delete: async ({ model, where }) => {
          const table = db[model]
          const res = convertWhereClause(where, table)
          db[model] = table.filter((record) => !res.includes(record))
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
        updateMany: async ({ model, where, update }) => {
          const table = db[model]
          const res = convertWhereClause(where, table)
          res.forEach((record) => {
            Object.assign(record, update)
          })
          return res.length
        },
      }
    },
  })
}
