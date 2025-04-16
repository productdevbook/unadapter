export type LogLevel = 'info' | 'success' | 'warn' | 'error' | 'debug'

export const levels = ['info', 'success', 'warn', 'error', 'debug'] as const

export function shouldPublishLog(
  currentLogLevel: LogLevel,
  logLevel: LogLevel,
): boolean {
  return levels.indexOf(logLevel) <= levels.indexOf(currentLogLevel)
}

export interface Logger {
  disabled?: boolean
  level?: Exclude<LogLevel, 'success'>
  log?: (
    level: Exclude<LogLevel, 'success'>,
    message: string,
    ...args: any[]
  ) => void
}

export type LogHandlerParams = Parameters<NonNullable<Logger['log']>> extends [
  LogLevel,
  ...infer Rest,
]
  ? Rest
  : never

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

const levelColors: Record<LogLevel, string> = {
  info: colors.fg.blue,
  success: colors.fg.green,
  warn: colors.fg.yellow,
  error: colors.fg.red,
  debug: colors.fg.magenta,
}

function formatMessage(level: LogLevel, message: string): string {
  const timestamp = new Date().toISOString()
  return `${colors.dim}${timestamp}${colors.reset} ${
    levelColors[level]
  }${level.toUpperCase()}${colors.reset} ${colors.bright}[Better Auth]:${
    colors.reset
  } ${message}`
}

export function createLogger(options?: Logger): Record<LogLevel, (...params: LogHandlerParams) => void> {
  const enabled = options?.disabled !== true
  const logLevel = options?.level ?? 'error'

  const LogFunc = (
    level: LogLevel,
    message: string,
    args: any[] = [],
  ): void => {
    if (!enabled || !shouldPublishLog(logLevel, level)) {
      return
    }

    const formattedMessage = formatMessage(level, message)

    if (!options || typeof options.log !== 'function') {
      if (level === 'error') {
        console.error(formattedMessage, ...args)
      }
      else if (level === 'warn') {
        console.warn(formattedMessage, ...args)
      }
      else {
        console.log(formattedMessage, ...args)
      }
      return
    }

    options.log(level === 'success' ? 'info' : level, message, ...args)
  }

  return Object.fromEntries(
    levels.map(level => [
      level,
      (...[message, ...args]: LogHandlerParams) =>
        LogFunc(level, message, args),
    ]),
  ) as Record<LogLevel, (...params: LogHandlerParams) => void>
}

export const logger = createLogger()
