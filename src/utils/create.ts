import type { Adapter, AdapterInstance, AdapterOptions, TablesSchema } from "../types/index.ts"

export function createAdapter<
  T extends Record<string, any>,
  Schema extends TablesSchema = TablesSchema,
>(table: (options: AdapterOptions<T>) => Schema, options: AdapterOptions<T>): Adapter<T, Schema> {
  if (!options.database) {
    throw new Error("Adapter not provided")
  }

  const adapter = (options.database as AdapterInstance<T>)(table, options)

  return adapter as unknown as Adapter<T, Schema>
}

export function createTable<
  T extends Record<string, any>,
  Schema extends TablesSchema = TablesSchema,
>(table: (options: AdapterOptions<T>) => Schema): (options: AdapterOptions<T>) => Schema {
  return table
}
