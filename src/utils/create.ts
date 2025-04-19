import type { Adapter, AdapterInstance, AdapterOptions, TablesSchema } from 'unadapter/types'

export function createAdapter<
  T extends Record<string, any>,
  Schema extends TablesSchema = TablesSchema,
>(
  table: (
    options: AdapterOptions<T>,
  ) => Schema,
  options: AdapterOptions<T>,
) {
  if (!options.database) {
    throw new Error('Adapter not provided')
  }

  const adapter = (options.database as AdapterInstance<T>)(
    table,
    options,
  )

  return adapter as unknown as Adapter<T, Schema>
}

export function createTable<
  T extends Record<string, any>,
  Schema extends TablesSchema = TablesSchema,
>(
  table: (options: AdapterOptions<T>) => Schema,
) {
  return table
}
