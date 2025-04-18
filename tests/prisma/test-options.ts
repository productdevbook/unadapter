import type { Adapter, AdapterOptions } from '../../src/types/index.ts'
import type { BetterAuthOptions } from '../better-auth.schema.ts'

export function createTestOptions(adapter: (options: AdapterOptions<BetterAuthOptions>) => Adapter, useNumberId = false) {
  return ({
    database: adapter,
    user: {
      fields: { email: 'email_address' },
      additionalFields: {
        test: {
          type: 'string',
          defaultValue: 'test',
        },
      },
    },
    advanced: {
      database: {
        useNumberId,
      },
    },
  }) satisfies AdapterOptions<BetterAuthOptions>
}
