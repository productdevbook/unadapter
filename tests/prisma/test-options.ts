import type { AdapterInstance, AdapterOptions } from '../../src/types/index.ts'
import type { BetterAuthOptions } from '../better-auth.schema.ts'

export function createTestOptions(
  adapter: AdapterInstance<BetterAuthOptions>,
  useNumberId = false,
) {
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
