import type { Adapter, AdapterOptions, UnDbSchema } from 'unadapter/types'

export function createAdapter<
  O extends Record<string, any>,
  T extends Record<string, any> = object,
  Schema extends UnDbSchema = UnDbSchema,
>(
  table: (
    options: AdapterOptions<T, O>,
  ) => Schema,
  options: AdapterOptions<T, O>,
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
  O extends Record<string, any>,
  T extends Record<string, any> = object,
  Schema extends UnDbSchema = UnDbSchema,
>(table: (options: AdapterOptions<O, T>) => Schema) {
  return table
}
