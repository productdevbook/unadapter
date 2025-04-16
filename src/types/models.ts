import type { z } from 'zod'
import type {
  accountSchema,
  userSchema,
  verificationSchema,
} from '../db/schema.ts'

export type Models =
  | 'user'
  | 'account'
  | 'verification'
  | 'organization'
  | 'member'
  | 'invitation'
  | 'jwks'
  | 'passkey'
  | 'two-factor'

interface RateLimit {
  /**
   * The key to use for rate limiting
   */
  key: string
  /**
   * The number of requests made
   */
  count: number
  /**
   * The last request time in milliseconds
   */
  lastRequest: number
}

export type User = z.infer<typeof userSchema>
export type Account = z.infer<typeof accountSchema>
export type Verification = z.infer<typeof verificationSchema>
export type { RateLimit }
