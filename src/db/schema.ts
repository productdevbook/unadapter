import type { FieldAttribute } from 'unadapter/types'
import type { Account, User } from '../types/index.ts'
import type { AnyOptions } from '../types/options.ts'
import type { AuthPluginSchema } from '../types/plugins.ts'
import { z } from 'zod'

export const accountSchema = z.object({
  id: z.string(),
  providerId: z.string(),
  accountId: z.string(),
  userId: z.coerce.string(),
  accessToken: z.string().nullish(),
  refreshToken: z.string().nullish(),
  idToken: z.string().nullish(),
  /**
   * Access token expires at
   */
  accessTokenExpiresAt: z.date().nullish(),
  /**
   * Refresh token expires at
   */
  refreshTokenExpiresAt: z.date().nullish(),
  /**
   * The scopes that the user has authorized
   */
  scope: z.string().nullish(),
  /**
   * Password is only stored in the credential provider
   */
  password: z.string().nullish(),
  createdAt: z.date().default(() => new Date()),
  updatedAt: z.date().default(() => new Date()),
})

export const userSchema = z.object({
  id: z.string(),
  email: z.string().transform(val => val.toLowerCase()),
  emailVerified: z.boolean().default(false),
  name: z.string(),
  image: z.string().nullish(),
  createdAt: z.date().default(() => new Date()),
  updatedAt: z.date().default(() => new Date()),
})

export const verificationSchema = z.object({
  id: z.string(),
  value: z.string(),
  createdAt: z.date().default(() => new Date()),
  updatedAt: z.date().default(() => new Date()),
  expiresAt: z.date(),
  identifier: z.string(),
})

export function parseOutputData<T extends Record<string, any>>(
  data: T,
  schema: {
    fields: Record<string, FieldAttribute>
  },
) {
  const fields = schema.fields
  const parsedData: Record<string, any> = {}
  for (const key in data) {
    const field = fields[key]
    if (!field) {
      parsedData[key] = data[key]
      continue
    }
    if (field.returned === false) {
      continue
    }
    parsedData[key] = data[key]
  }
  return parsedData as T
}

export function getAllFields(options: AnyOptions, table: string) {
  let schema: Record<string, FieldAttribute> = {
    ...(table === 'user' ? options.user?.additionalFields : {}),
  }
  for (const plugin of options.plugins || []) {
    if (plugin.schema && plugin.schema[table]) {
      schema = {
        ...schema,
        ...plugin.schema[table].fields,
      }
    }
  }
  return schema
}

export function parseUserOutput(options: AnyOptions, user: User) {
  const schema = getAllFields(options, 'user')
  return parseOutputData(user, { fields: schema })
}

export function parseAccountOutput(
  options: AnyOptions,
  account: Account,
) {
  const schema = getAllFields(options, 'account')
  return parseOutputData(account, { fields: schema })
}

export function parseInputData<T extends Record<string, any>>(
  data: T,
  schema: {
    fields: Record<string, FieldAttribute>
    action?: 'create' | 'update'
  },
) {
  const action = schema.action || 'create'
  const fields = schema.fields
  const parsedData: Record<string, any> = {}
  for (const key in fields) {
    if (key in data) {
      if (fields[key].input === false) {
        if (fields[key].defaultValue) {
          parsedData[key] = fields[key].defaultValue
          continue
        }
        continue
      }
      if (fields[key].validator?.input && data[key] !== undefined) {
        parsedData[key] = fields[key].validator.input.parse(data[key])
        continue
      }
      if (fields[key].transform?.input && data[key] !== undefined) {
        parsedData[key] = fields[key].transform?.input(data[key])
        continue
      }
      parsedData[key] = data[key]
      continue
    }

    if (fields[key].defaultValue && action === 'create') {
      parsedData[key] = fields[key].defaultValue
      continue
    }

    if (fields[key].required && action === 'create') {
      // throw new APIError('BAD_REQUEST', {
      //   message: `${key} is required`,
      // })
      throw new Error(
        `Field "${key}" is required but not provided in the input data.`,
      )
    }
  }
  return parsedData as Partial<T>
}

export function parseUserInput(
  options: AnyOptions,
  user?: Record<string, any>,
  action?: 'create' | 'update',
) {
  const schema = getAllFields(options, 'user')
  return parseInputData(user || {}, { fields: schema, action })
}

export function parseAdditionalUserInput(
  options: AnyOptions,
  user?: Record<string, any>,
) {
  const schema = getAllFields(options, 'user')
  return parseInputData(user || {}, { fields: schema })
}

export function parseAccountInput(
  options: AnyOptions,
  account: Partial<Account>,
) {
  const schema = getAllFields(options, 'account')
  return parseInputData(account, { fields: schema })
}

export function mergeSchema<S extends AuthPluginSchema>(
  schema: S,
  newSchema?: {
    [K in keyof S]?: {
      modelName?: string
      fields?: {
        [P: string]: string
      }
    };
  },
) {
  if (!newSchema) {
    return schema
  }
  for (const table in newSchema) {
    const newModelName = newSchema[table]?.modelName
    if (newModelName) {
      schema[table].modelName = newModelName
    }
    for (const field in schema[table].fields) {
      const newField = newSchema[table]?.fields?.[field]
      if (!newField) {
        continue
      }
      schema[table].fields[field].fieldName = newField
    }
  }
  return schema
}
