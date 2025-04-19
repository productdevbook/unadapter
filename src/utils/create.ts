import type { AdapterOptions, UnDbSchema } from 'unadapter/types'

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
  let adapter
  if (typeof options.database === 'function') {
    // If it's an AdapterInstance (function)
    adapter = options.database(
      table,
      options,
    )
  }
  else {
    throw new TypeError('Invalid adapter provided')
  }
  return adapter
}

export function createTable<
  T extends Record<string, any>,
  Schema extends UnDbSchema = UnDbSchema,
>(
  table: (options: AdapterOptions<T>) => Schema,
) {
  return table
}
