import type { Adapter, AdapterOptions, UnDbSchema } from 'unadapter/types'

export function createAdapter<
  T extends Record<string, any>,
  Schema extends UnDbSchema = UnDbSchema,
>(
  table: (
    options: AdapterOptions<T>,
  ) => Schema,
  options: AdapterOptions<T>,
) {
  if (!options.database) {
    throw new Error('Adapter not provided')
  }
  let adapter: Adapter<Schema>
  if (typeof options.database === 'function') {
    // If it's an AdapterInstance (function)
    adapter = options.database(
      options,
      table,
    ) as Adapter<Schema>
  }
  else {
    throw new TypeError('Invalid adapter provided')
  }
  return adapter as Adapter<Schema>
}

export function createTable<
  T extends Record<string, any>,
  Schema extends UnDbSchema = UnDbSchema,
>(table: (options: AdapterOptions<T>) => Schema) {
  return table
}
