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
  let adapter
  if (options.database instanceof createAdapter && typeof options.database === 'function') {
    adapter = options.database(
      table,
      options,
    )
  }
  else {
    throw new TypeError('Invalid adapter provided')
  }
  return adapter as unknown as Adapter<T, Schema>
}

export function createTable<
  T extends Record<string, any>,
  Schema extends UnDbSchema = UnDbSchema,
>(
  table: (options: AdapterOptions<T>) => Schema,
) {
  return table
}
