import type { AdapterOptions, FieldAttribute } from 'unadapter/types'

export function mergePluginSchemas<
  T extends Record<string, any>,
  K extends keyof AdapterOptions<T> = 'plugins',
>(options: AdapterOptions<T>, where: K = 'plugins' as K) {
  const schema = (options[where] as any[])?.reduce(
    (acc, plugin) => {
      const schema = plugin.schema
      if (!schema)
        return acc
      for (const [key, value] of Object.entries(schema)) {
        acc[key] = {
          fields: {
            ...acc[key]?.fields,
            ...(typeof value === 'object' && value !== null && 'fields' in value ? value.fields as unknown as Record<string, FieldAttribute> : {}),
          },
          modelName: (typeof value === 'object' && value !== null && 'modelName' in value ? String(value.modelName) : key) || key,
        }
      }
      return acc
    },
    {} as Record<
      string,
      { fields: Record<string, FieldAttribute>, modelName: string }
    >,
  )

  return schema
}
