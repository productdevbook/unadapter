import type {
  Adapter,
  AdapterOptions,
  FieldAttribute,
  TablesSchema,
  Where,
} from 'unadapter/types'
import type {
  AdapterConfig,
  AdapterTestDebugLogs,
  CleanedWhere,
  CreateCustomAdapter,
} from './types.ts'
import { generateId as defaultGenerateId, logger } from '../../utils/index.ts'
import { safeJSONParse } from '../../utils/json.ts'
import { withApplyDefault } from '../utils.ts'

export * from './types.ts'

let debugLogs: any[] = []
let transactionId = -1

const colors = {
  reset: '\x1B[0m',
  bright: '\x1B[1m',
  dim: '\x1B[2m',
  underscore: '\x1B[4m',
  blink: '\x1B[5m',
  reverse: '\x1B[7m',
  hidden: '\x1B[8m',
  fg: {
    black: '\x1B[30m',
    red: '\x1B[31m',
    green: '\x1B[32m',
    yellow: '\x1B[33m',
    blue: '\x1B[34m',
    magenta: '\x1B[35m',
    cyan: '\x1B[36m',
    white: '\x1B[37m',
  },
  bg: {
    black: '\x1B[40m',
    red: '\x1B[41m',
    green: '\x1B[42m',
    yellow: '\x1B[43m',
    blue: '\x1B[44m',
    magenta: '\x1B[45m',
    cyan: '\x1B[46m',
    white: '\x1B[47m',
  },
}

export function createAdapter<
  T extends Record<string, any>,
  Schema extends TablesSchema = TablesSchema,
>({
  adapter,
  config: cfg,
}: {
  config: AdapterConfig<T, Schema>
  adapter: CreateCustomAdapter<Schema>
}) {
  return (
    getTables: (options: AdapterOptions<T, Schema>) => Schema,
    options: AdapterOptions<T, Schema>,
  ): Adapter<T, Schema> => {
    const config = {
      ...cfg,
      supportsBooleans: cfg.supportsBooleans ?? true,
      supportsDates: cfg.supportsDates ?? true,
      supportsJSON: cfg.supportsJSON ?? false,
      adapterName: cfg.adapterName ?? cfg.adapterId,
      supportsNumericIds: cfg.supportsNumericIds ?? true,
    }

    const debugLog = (...args: any[]) => {
      if (config.debugLogs === true || typeof config.debugLogs === 'object') {
        // If we're running adapter tests, we'll keep debug logs in memory, then print them out if a test fails.
        if (
          typeof config.debugLogs === 'object'
          && 'isRunningAdapterTests' in config.debugLogs
        ) {
          if (config.debugLogs.isRunningAdapterTests) {
            args.shift() // Removes the {method: "..."} object from the args array.
            debugLogs.push(args)
          }
          return
        }

        if (
          typeof config.debugLogs === 'object'
          && config.debugLogs.logCondition
          && !config.debugLogs.logCondition?.()
        ) {
          return
        }

        if (typeof args[0] === 'object' && 'method' in args[0]) {
          const method = args.shift().method
          // Make sure the method is enabled in the config.
          if (typeof config.debugLogs === 'object') {
            if (method === 'create' && !config.debugLogs.create) {
              return
            }
            else if (method === 'update' && !config.debugLogs.update) {
              return
            }
            else if (
              method === 'updateMany'
              && !config.debugLogs.updateMany
            ) {
              return
            }
            else if (method === 'findOne' && !config.debugLogs.findOne) {
              return
            }
            else if (method === 'findMany' && !config.debugLogs.findMany) {
              return
            }
            else if (method === 'delete' && !config.debugLogs.delete) {
              return
            }
            else if (
              method === 'deleteMany'
              && !config.debugLogs.deleteMany
            ) {
              return
            }
            else if (method === 'count' && !config.debugLogs.count) {
              return
            }
          }
          logger.info(`[${config.adapterName}]`, ...args)
        }
        else {
          logger.info(`[${config.adapterName}]`, ...args)
        }
      }
    }

    if (
      options.advanced?.database?.useNumberId === true
      && config.supportsNumericIds === false
    ) {
      throw new Error(
        `[${config.adapterName}] Your database or database adapter does not support numeric ids. Please disable "useNumberId" in your config.`,
      )
    }

    const schema = getTables(options)

    /**
     * This function helps us get the default model name from the schema defined by devs.
     * Often times, the user will be using the `modelName` which could had been customized by the users.
     * This function helps us get the actual model name useful to match against the schema. (eg: schema[model])
     *
     * If it's still unclear what this does:
     *
     * 1. User can define a custom modelName.
     * 2. When using a custom modelName, doing something like `schema[model]` will not work.
     * 3. Using this function helps us get the actual model name based on the user's defined custom modelName.
     */
    const getDefaultModelName = (model: string) => {
      // It's possible this `model` could had applied `usePlural`.
      // Thus we'll try the search but without the trailing `s`.
      if (config.usePlural && model.charAt(model.length - 1) === 's') {
        const pluralessModel = model.slice(0, -1)
        let m = schema[pluralessModel] ? pluralessModel : undefined
        if (!m) {
          m = Object.entries(schema).find(
            ([_, f]) => f.modelName === pluralessModel,
          )?.[0]
        }

        if (m) {
          return m
        }
      }

      let m = schema[model] ? model : undefined
      if (!m) {
        m = Object.entries(schema).find(([_, f]) => f.modelName === model)?.[0]
      }

      if (!m) {
        debugLog(`Model "${model}" not found in schema`)
        debugLog(`Schema:`, schema)
        throw new Error(`Model "${model}" not found in schema`)
      }
      return m
    }

    /**
     * This function helps us get the default field name from the schema defined by devs.
     * Often times, the user will be using the `fieldName` which could had been customized by the users.
     * This function helps us get the actual field name useful to match against the schema. (eg: schema[model].fields[field])
     *
     * If it's still unclear what this does:
     *
     * 1. User can define a custom fieldName.
     * 2. When using a custom fieldName, doing something like `schema[model].fields[field]` will not work.
     */
    const getDefaultFieldName = ({
      field,
      model: unsafe_model,
    }: { model: string, field: string }) => {
      // Plugin `schema`s can't define their own `id`. Better-auth auto provides `id` to every schema model.
      // Given this, we can't just check if the `field` (that being `id`) is within the schema's fields, since it is never defined.
      // So we check if the `field` is `id` and if so, we return `id` itself. Otherwise, we return the `field` from the schema.
      if (field === 'id') {
        return field
      }
      const model = getDefaultModelName(unsafe_model) // Just to make sure the model name is correct.

      let f = schema[model]?.fields[field]
      if (!f) {
        // @ts-expect-error - Field name might be a custom property not in the type definition
        f = Object.values(schema[model]?.fields).find(
          f => f.fieldName === field,
        )
      }
      if (!f) {
        debugLog(`Field ${field} not found in model ${model}`)
        debugLog(`Schema:`, schema)
        throw new Error(`Field ${field} not found in model ${model}`)
      }
      return field
    }

    /**
     * Users can overwrite the default model of some tables. This function helps find the correct model name.
     * Furthermore, if the user passes `usePlural` as true in their adapter config,
     * then we should return the model name ending with an `s`.
     */
    const getModelName = (model: string) => {
      return schema[model]?.modelName !== model
        ? schema[model]?.modelName
        : config.usePlural
          ? `${model}s`
          : model
    }
    /**
     * Get the field name which is expected to be saved in the database based on the user's schema.
     *
     * This function is useful if you need to save the field name to the database.
     *
     * For example, if the user has defined a custom field name for the `user` model, then you can use this function to get the actual field name from the schema.
     */
    function getFieldName({
      model: model_name,
      field: field_name,
    }: { model: string, field: string }) {
      const model = getDefaultModelName(model_name)
      const field = getDefaultFieldName({ model, field: field_name })

      return schema[model]?.fields[field]?.fieldName || field
    }

    const idField = ({ customModelName }: { customModelName?: string }) => {
      const shouldGenerateId = !config.disableIdGeneration
        && !options.advanced?.database?.useNumberId

      const model = getDefaultModelName(customModelName ?? 'id')
      return {
        type: options.advanced?.database?.useNumberId ? 'number' : 'string',
        required: !!shouldGenerateId,
        ...(shouldGenerateId
          ? {
              defaultValue() {
                if (config.disableIdGeneration)
                  return undefined
                const useNumberId = options.advanced?.database?.useNumberId
                let generateId = options.advanced?.database?.generateId
                if (options.advanced?.generateId) {
                  logger.warn(
                    'Your Better Auth config includes advanced.generateId which is deprecated. Please use advanced.database.generateId instead. This will be removed in future releases.',
                  )
                  generateId = options.advanced?.generateId
                }
                if (generateId === false || useNumberId)
                  return undefined
                if (generateId) {
                  return generateId({
                    model,
                  })
                }
                if (config.customIdGenerator) {
                  return config.customIdGenerator({ model })
                }
                return defaultGenerateId()
              },
            }
          : {}),
      } satisfies FieldAttribute
    }

    const getFieldAttributes = ({
      model,
      field,
    }: { model: string, field: string }) => {
      const defaultModelName = getDefaultModelName(model)
      const defaultFieldName = getDefaultFieldName({
        field,
        model,
      })

      const fields = schema[defaultModelName].fields
      fields.id = idField({ customModelName: defaultModelName })
      return fields[defaultFieldName]
    }

    const adapterInstance = adapter({
      options: options as any,
      schema,
      debugLog,
      getFieldName,
      getModelName,
      getDefaultModelName,
      getDefaultFieldName,
      getFieldAttributes,
    })

    const transformInput = async (
      data: Record<string, any>,
      unsafe_model: string,
      action: 'create' | 'update',
    ) => {
      const transformedData: Record<string, any> = {}
      const fields = schema[unsafe_model]?.fields
      const newMappedKeys = config.mapKeysTransformInput ?? {}
      if (
        !config.disableIdGeneration
        && !options.advanced?.database?.useNumberId
      ) {
        fields.id = idField({ customModelName: unsafe_model })
      }
      for (const field in fields) {
        const value = data[field]
        const fieldAttributes = fields[field]

        const newFieldName: string = newMappedKeys[field] || fields[field].fieldName || field
        if (
          value === undefined
          && ((!fieldAttributes.defaultValue
            && !fieldAttributes.transform?.input)
          || action === 'update')
        ) {
          continue
        }
        // If the value is undefined, but the fieldAttr provides a `defaultValue`, then we'll use that.
        let newValue = withApplyDefault(value, fieldAttributes, action)

        // If the field attr provides a custom transform input, then we'll let it handle the value transformation.
        // Afterwards, we'll continue to apply the default transformations just to make sure it saves in the correct format.
        if (fieldAttributes.transform?.input) {
          newValue = await fieldAttributes.transform.input(newValue)
        }

        if (
          fieldAttributes.references?.field === 'id'
          && options.advanced?.database?.useNumberId
        ) {
          if (Array.isArray(newValue)) {
            newValue = newValue.map(Number)
          }
          else {
            newValue = Number(newValue)
          }
        }
        else if (
          config.supportsJSON === false
          && typeof newValue === 'object'
          // @ts-expect-error -Future proofing
          && fieldAttributes.type === 'json'
        ) {
          newValue = JSON.stringify(newValue)
        }
        else if (
          config.supportsDates === false
          && newValue instanceof Date
          && fieldAttributes.type === 'date'
        ) {
          newValue = newValue.toISOString()
        }
        else if (
          config.supportsBooleans === false
          && typeof newValue === 'boolean'
        ) {
          newValue = newValue ? 1 : 0
        }

        if (config.customTransformInput) {
          newValue = config.customTransformInput({
            data: newValue,
            action,
            field: newFieldName,
            fieldAttributes,
            model: unsafe_model,
            schema,
            options,
          })
        }

        transformedData[newFieldName] = newValue
      }
      return transformedData
    }

    const transformOutput = async (
      data: Record<string, any> | null,
      unsafe_model: string,
      select: string[] = [],
    ) => {
      if (!data)
        return null
      const newMappedKeys = config.mapKeysTransformOutput ?? {}
      const transformedData: Record<string, any> = {}
      const tableSchema = schema[unsafe_model].fields
      const idKey = Object.entries(newMappedKeys).find(
        ([_, v]) => v === 'id',
      )?.[0]
      tableSchema[idKey ?? 'id'] = {
        type: options.advanced?.database?.useNumberId ? 'number' : 'string',
      }
      for (const key in tableSchema) {
        if (select.length && !select.includes(key)) {
          continue
        }
        const field = tableSchema[key]
        if (field) {
          const originalKey = field.fieldName || key
          // If the field is mapped, we'll use the mapped key. Otherwise, we'll use the original key.
          let newValue = data[
            Object.entries(newMappedKeys).find(
              ([_, v]) => v === originalKey,
            )?.[0] || originalKey
          ]

          if (field.transform?.output) {
            newValue = await field.transform.output(newValue)
          }

          const newFieldName: string = newMappedKeys[key] || key

          if (originalKey === 'id' || field.references?.field === 'id') {
            // Even if `useNumberId` is true, we must always return a string `id` output.
            if (typeof newValue !== 'undefined')
              newValue = String(newValue)
          }
          else if (
            config.supportsJSON === false
            && typeof newValue === 'string'
            // @ts-expect-error - Future proofing
            && field.type === 'json'
          ) {
            newValue = safeJSONParse(newValue)
          }
          else if (
            config.supportsDates === false
            && typeof newValue === 'string'
            && field.type === 'date'
          ) {
            newValue = new Date(newValue)
          }
          else if (
            config.supportsBooleans === false
            && typeof newValue === 'number'
            && field.type === 'boolean'
          ) {
            newValue = newValue === 1
          }

          if (config.customTransformOutput) {
            newValue = config.customTransformOutput({
              data: newValue,
              field: newFieldName,
              fieldAttributes: field,
              select,
              model: unsafe_model,
              schema,
              options: options as any,
            })
          }

          transformedData[newFieldName] = newValue
        }
      }
      return transformedData as any
    }

    const transformWhereClause = <W extends Where[] | undefined>({
      model,
      where,
    }: { where: W, model: string }): W extends undefined
      ? undefined
      : CleanedWhere[] => {
      if (!where)
        return undefined as any
      return where.map((w) => {
        const {
          field: unsafe_field,
          value,
          operator = 'eq',
          connector = 'AND',
        } = w
        if (operator === 'in') {
          if (!Array.isArray(value)) {
            throw new TypeError('Value must be an array')
          }
        }

        const defaultModelName = getDefaultModelName(model)
        const defaultFieldName = getDefaultFieldName({
          field: unsafe_field,
          model,
        })

        const fieldName = getFieldName({
          field: defaultFieldName,
          model: defaultModelName,
        })
        const fieldAttr = getFieldAttributes({
          field: defaultFieldName,
          model: defaultModelName,
        })

        if (defaultFieldName === 'id' || fieldAttr.references?.field === 'id') {
          if (options.advanced?.database?.useNumberId) {
            if (Array.isArray(value)) {
              return {
                operator,
                connector,
                field: fieldName,
                value: value.map(Number),
              } satisfies CleanedWhere
            }
            return {
              operator,
              connector,
              field: fieldName,
              value: Number(value),
            } satisfies CleanedWhere
          }
        }

        return {
          operator,
          connector,
          field: fieldName,
          value,
        } satisfies CleanedWhere
      }) as any
    }

    return {
      create: async ({
        data: unsafeData,
        model: unsafeModel,
        select,
      }) => {
        transactionId++
        const thisTransactionId = transactionId
        const model = getModelName(unsafeModel)

        if ('id' in unsafeData) {
          logger.warn(
            `[${config.adapterName}] - You are trying to create a record with an id. This is not allowed as we handle id generation for you. The id will be ignored.`,
          )
          // eslint-disable-next-line unicorn/error-message
          const err = new Error()
          const stack = err.stack
            ?.split('\n')
            .filter((_, i) => i !== 1)
            .join('\n')
            .replace('Error:', 'Create method with `id` being called at:')
          console.log(stack)
          // @ts-expect-error - Intentionally modifying input data before processing
          unsafeData.id = undefined
        }
        debugLog(
          { method: 'create' },
          `${formatTransactionId(thisTransactionId)} ${formatStep(1, 4)}`,
          `${formatMethod('create')} ${formatAction('Unsafe Input')}:`,
          { model, data: unsafeData },
        )
        const data = (await transformInput(
          unsafeData,
          unsafeModel,
          'create',
        )) as T
        debugLog(
          { method: 'create' },
          `${formatTransactionId(thisTransactionId)} ${formatStep(2, 4)}`,
          `${formatMethod('create')} ${formatAction('Parsed Input')}:`,
          { model, data },
        )
        const res = await adapterInstance.create({ data: data as any, model })
        debugLog(
          { method: 'create' },
          `${formatTransactionId(thisTransactionId)} ${formatStep(3, 4)}`,
          `${formatMethod('create')} ${formatAction('DB Result')}:`,
          { model, res },
        )
        const transformed = await transformOutput(res, unsafeModel, select)
        debugLog(
          { method: 'create' },
          `${formatTransactionId(thisTransactionId)} ${formatStep(4, 4)}`,
          `${formatMethod('create')} ${formatAction('Parsed Result')}:`,
          { model, data: transformed },
        )
        return transformed
      },
      update: async ({
        model: unsafeModel,
        where: unsafeWhere,
        update: unsafeData,
      }) => {
        transactionId++
        const thisTransactionId = transactionId
        const model = getModelName(unsafeModel)
        const where = transformWhereClause({
          model: unsafeModel,
          where: unsafeWhere,
        })
        debugLog(
          { method: 'update' },
          `${formatTransactionId(thisTransactionId)} ${formatStep(1, 4)}`,
          `${formatMethod('update')} ${formatAction('Unsafe Input')}:`,
          { model, data: unsafeData },
        )
        const data = (await transformInput(
          unsafeData,
          unsafeModel,
          'update',
        )) as T
        debugLog(
          { method: 'update' },
          `${formatTransactionId(thisTransactionId)} ${formatStep(2, 4)}`,
          `${formatMethod('update')} ${formatAction('Parsed Input')}:`,
          { model, data },
        )
        const res = await adapterInstance.update({
          model,
          where,
          update: data as any,
        })
        debugLog(
          { method: 'update' },
          `${formatTransactionId(thisTransactionId)} ${formatStep(3, 4)}`,
          `${formatMethod('update')} ${formatAction('DB Result')}:`,
          { model, data: res },
        )
        const transformed = await transformOutput(res as any, unsafeModel)
        debugLog(
          { method: 'update' },
          `${formatTransactionId(thisTransactionId)} ${formatStep(4, 4)}`,
          `${formatMethod('update')} ${formatAction('Parsed Result')}:`,
          { model, data: transformed },
        )
        return transformed
      },
      updateMany: async ({
        model: unsafeModel,
        where: unsafeWhere,
        update: unsafeData,
      }) => {
        transactionId++
        const thisTransactionId = transactionId
        const model = getModelName(unsafeModel)
        const where = transformWhereClause({
          model: unsafeModel,
          where: unsafeWhere,
        })
        debugLog(
          { method: 'updateMany' },
          `${formatTransactionId(thisTransactionId)} ${formatStep(1, 4)}`,
          `${formatMethod('updateMany')} ${formatAction('Unsafe Input')}:`,
          { model, data: unsafeData },
        )
        const data = await transformInput(unsafeData, unsafeModel, 'update')
        debugLog(
          { method: 'updateMany' },
          `${formatTransactionId(thisTransactionId)} ${formatStep(2, 4)}`,
          `${formatMethod('updateMany')} ${formatAction('Parsed Input')}:`,
          { model, data },
        )

        const updatedCount = await adapterInstance.updateMany({
          model,
          where,
          update: data as any,
        })
        debugLog(
          { method: 'updateMany' },
          `${formatTransactionId(thisTransactionId)} ${formatStep(3, 4)}`,
          `${formatMethod('updateMany')} ${formatAction('DB Result')}:`,
          { model, data: updatedCount },
        )
        debugLog(
          { method: 'updateMany' },
          `${formatTransactionId(thisTransactionId)} ${formatStep(4, 4)}`,
          `${formatMethod('updateMany')} ${formatAction('Parsed Result')}:`,
          { model, data: updatedCount },
        )
        return updatedCount
      },
      findOne: async ({
        model: unsafeModel,
        where: unsafeWhere,
        select,
      }) => {
        transactionId++
        const thisTransactionId = transactionId
        const model = getModelName(unsafeModel)
        const where = transformWhereClause({
          model: unsafeModel,
          where: unsafeWhere,
        })
        debugLog(
          { method: 'findOne' },
          `${formatTransactionId(thisTransactionId)} ${formatStep(1, 3)}`,
          `${formatMethod('findOne')}:`,
          { model, where, select },
        )
        const res = await adapterInstance.findOne({
          model,
          where,
          select,
        })
        debugLog(
          { method: 'findOne' },
          `${formatTransactionId(thisTransactionId)} ${formatStep(2, 3)}`,
          `${formatMethod('findOne')} ${formatAction('DB Result')}:`,
          { model, data: res },
        )
        const transformed = await transformOutput(
          res as any,
          unsafeModel,
          select,
        )
        debugLog(
          { method: 'findOne' },
          `${formatTransactionId(thisTransactionId)} ${formatStep(3, 3)}`,
          `${formatMethod('findOne')} ${formatAction('Parsed Result')}:`,
          { model, data: transformed },
        )
        return transformed
      },
      findMany: async ({
        model: unsafeModel,
        where: unsafeWhere,
        limit: unsafeLimit,
        sortBy,
        offset,
      }) => {
        transactionId++
        const thisTransactionId = transactionId
        const limit = unsafeLimit
          ?? options.advanced?.database?.defaultFindManyLimit
          ?? 100

        const model = getModelName(unsafeModel)
        const where = transformWhereClause({
          model: unsafeModel,
          where: unsafeWhere,
        })
        debugLog(
          { method: 'findMany' },
          `${formatTransactionId(thisTransactionId)} ${formatStep(1, 3)}`,
          `${formatMethod('findMany')}:`,
          { model, where, limit, sortBy, offset },
        )
        const res = await adapterInstance.findMany({
          model,
          where,
          limit,
          sortBy,
          offset,
        })
        debugLog(
          { method: 'findMany' },
          `${formatTransactionId(thisTransactionId)} ${formatStep(2, 3)}`,
          `${formatMethod('findMany')} ${formatAction('DB Result')}:`,
          { model, data: res },
        )
        const transformed = await Promise.all(
          res.map(async r => await transformOutput(r as any, unsafeModel)),
        )
        debugLog(
          { method: 'findMany' },
          `${formatTransactionId(thisTransactionId)} ${formatStep(3, 3)}`,
          `${formatMethod('findMany')} ${formatAction('Parsed Result')}:`,
          { model, data: transformed },
        )
        return transformed
      },
      delete: async ({
        model: unsafeModel,
        where: unsafeWhere,
      }) => {
        transactionId++
        const thisTransactionId = transactionId
        const model = getModelName(unsafeModel)
        const where = transformWhereClause({
          model: unsafeModel,
          where: unsafeWhere,
        })
        debugLog(
          { method: 'delete' },
          `${formatTransactionId(thisTransactionId)} ${formatStep(1, 2)}`,
          `${formatMethod('delete')}:`,
          { model, where },
        )
        await adapterInstance.delete({
          model,
          where,
        })
        debugLog(
          { method: 'delete' },
          `${formatTransactionId(thisTransactionId)} ${formatStep(2, 2)}`,
          `${formatMethod('delete')} ${formatAction('DB Result')}:`,
          { model },
        )
      },
      deleteMany: async ({
        model: unsafeModel,
        where: unsafeWhere,
      }) => {
        transactionId++
        const thisTransactionId = transactionId
        const model = getModelName(unsafeModel)
        const where = transformWhereClause({
          model: unsafeModel,
          where: unsafeWhere,
        })
        debugLog(
          { method: 'deleteMany' },
          `${formatTransactionId(thisTransactionId)} ${formatStep(1, 2)}`,
          `${formatMethod('deleteMany')} ${formatAction('DeleteMany')}:`,
          { model, where },
        )
        const res = await adapterInstance.deleteMany({
          model,
          where,
        })
        debugLog(
          { method: 'deleteMany' },
          `${formatTransactionId(thisTransactionId)} ${formatStep(2, 2)}`,
          `${formatMethod('deleteMany')} ${formatAction('DB Result')}:`,
          { model, data: res },
        )
        return res
      },
      count: async ({
        model: unsafeModel,
        where: unsafeWhere,
      }) => {
        transactionId++
        const thisTransactionId = transactionId
        const model = getModelName(unsafeModel)
        const where = transformWhereClause({
          model: unsafeModel,
          where: unsafeWhere,
        })
        debugLog(
          { method: 'count' },
          `${formatTransactionId(thisTransactionId)} ${formatStep(1, 2)}`,
          `${formatMethod('count')}:`,
          {
            model,
            where,
          },
        )
        const res = await adapterInstance.count({
          model,
          where,
        })
        debugLog(
          { method: 'count' },
          `${formatTransactionId(thisTransactionId)} ${formatStep(2, 2)}`,
          `${formatMethod('count')}:`,
          {
            model,
            data: res,
          },
        )
        return res
      },
      createSchema: adapterInstance.createSchema
        ? async (_, file) => {
          const tables = getTables(options)

          // TODO: better-auth options.secondaryStorage callback support

          // TODO: better-auth options.rateLimit callback support

          return adapterInstance.createSchema!({ file, tables })
        }
        : undefined,
      options: {
        adapterConfig: config,
        ...(adapterInstance.options ?? {}),
      },
      id: config.adapterId,

      // Secretly export values ONLY if this adapter has enabled adapter-test-debug-logs.
      // This would then be used during our adapter-tests to help print debug logs if a test fails.
      // @ts-expect-error - ^^
      ...(config.debugLogs?.isRunningAdapterTests
        ? {
            adapterTestDebugLogs: {
              resetDebugLogs() {
                debugLogs = []
              },
              printDebugLogs() {
                const separator = `─`.repeat(80)

                // `${colors.fg.blue}|${colors.reset} `,
                const log: any[] = debugLogs
                  .reverse()
                  .map((log) => {
                    log[0] = `\n${log[0]}`
                    return [...log, '\n']
                  })
                  .reduce(
                    (prev, curr) => {
                      return [...curr, ...prev]
                    },
                    [`\n${separator}`],
                  )

                console.log(...log)
              },
            } satisfies AdapterTestDebugLogs,
          }
        : {}),
    }
  }
}

function formatTransactionId(transactionId: number) {
  return `${colors.fg.magenta}#${transactionId}${colors.reset}`
}

function formatStep(step: number, total: number) {
  return `${colors.bg.black}${colors.fg.yellow}[${step}/${total}]${colors.reset}`
}

function formatMethod(method: string) {
  return `${colors.bright}${method}${colors.reset}`
}

function formatAction(action: string) {
  return `${colors.dim}(${action})${colors.reset}`
}
