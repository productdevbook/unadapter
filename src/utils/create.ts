import type { AdapterOptions, CreateAdapter, InferModelTypes, UnDbSchema } from 'unadapter/types'

export function createAdapter<
  T extends Record<string, any>,
  Schema extends UnDbSchema = UnDbSchema,
  Models extends Record<string, any> = InferModelTypes<Schema>,
>(
  options: CreateAdapter<T, Schema, Models>,
) {
  const adapter = options.adapter(
    options.options as AdapterOptions<T> || {} as AdapterOptions<T>,
    options.tables,
  )
  return adapter
}
