/* eslint-disable @typescript-eslint/ban-types */
import { join } from 'path'

import { formatLevelPretty } from './formatLevelPretty'
import { formatParametersPretty } from './formatParametersPretty'
import { formatServicePretty } from './formatServicePretty'
import { formatTimePretty } from './formatTimePretty'
import { LEVEL, LogLevel } from './LogLevel'
import { resolveLog } from './resolveLog'

export interface LoggerOptions {
  logLevel: LogLevel
  service: string
  format: 'pretty' | 'json'
  utc: boolean
  colors: boolean
  cwd: string
  getTime: () => Date
  reportError: (error: unknown) => void
}

export class Logger {
  private readonly options: LoggerOptions
  private readonly logLevel: number
  private readonly cwd: string

  constructor(options: Partial<LoggerOptions>) {
    this.options = {
      logLevel: options.logLevel ?? 'INFO',
      service: options.service ?? '',
      format: options.format ?? 'json',
      utc: options.utc ?? false,
      colors: options.colors ?? false,
      cwd: options.cwd ?? process.cwd(),
      getTime: options.getTime ?? (() => new Date()),
      reportError: options.reportError ?? (() => {}),
    }
    this.cwd = join(this.options.cwd, '/')
    this.logLevel = LEVEL[this.options.logLevel]
  }

  static SILENT = new Logger({ logLevel: 'NONE', format: 'pretty' })
  static DEBUG = new Logger({ logLevel: 'NONE', format: 'pretty' })

  configure(options: Partial<LoggerOptions>): Logger {
    return new Logger({ ...this.options, ...options })
  }

  for(object: {}): Logger {
    return this.configure({
      service: this.options.service
        ? `${this.options.service}.${object.constructor.name}`
        : object.constructor.name,
    })
  }

  critical(message: string, parameters?: unknown): void
  critical(parameters: unknown): void
  critical(message: unknown, parameters?: unknown): void {
    if (this.logLevel < LEVEL.CRITICAL) {
      return
    }
    this.print('CRITICAL', resolveLog(message, parameters, this.cwd))
    this.options.reportError(parameters ?? message)
  }

  error(message: string, parameters?: unknown): void
  error(parameters: unknown): void
  error(message: unknown, parameters?: unknown): void {
    if (this.logLevel < LEVEL.ERROR) {
      return
    }
    this.print('ERROR', resolveLog(message, parameters, this.cwd))
    this.options.reportError(parameters ?? message)
  }

  warn(message: string, parameters?: unknown): void
  warn(parameters: unknown): void
  warn(message: unknown, parameters?: unknown): void {
    if (this.logLevel < LEVEL.WARN) {
      return
    }
    this.print('WARN', resolveLog(message, parameters, this.cwd))
  }

  info(message: string, parameters?: unknown): void
  info(parameters: unknown): void
  info(message: unknown, parameters?: unknown): void {
    if (this.logLevel < LEVEL.INFO) {
      return
    }
    this.print('INFO', resolveLog(message, parameters, this.cwd))
  }

  debug(message: string, parameters?: unknown): void
  debug(parameters: unknown): void
  debug(message: unknown, parameters?: unknown): void {
    if (this.logLevel < LEVEL.DEBUG) {
      return
    }
    this.print('DEBUG', resolveLog(message, parameters, this.cwd))
  }

  trace(message: string, parameters?: unknown): void
  trace(parameters: unknown): void
  trace(message: unknown, parameters?: unknown): void {
    if (this.logLevel < LEVEL.TRACE) {
      return
    }
    this.print('TRACE', resolveLog(message, parameters, this.cwd))
  }

  private print(level: LogLevel, parameters: {}): void {
    const output =
      this.options.format === 'json'
        ? this.formatJson(level, parameters)
        : this.formatPretty(level, parameters)

    if (level === 'CRITICAL' || level === 'ERROR') {
      console.error(output)
    } else if (level === 'WARN') {
      console.warn(output)
    } else if (level === 'INFO') {
      console.log(output)
    } else if (level === 'DEBUG' || level === 'TRACE') {
      console.debug(output)
    }
  }

  private formatJson(level: LogLevel, parameters: {}): string {
    const time = new Date().toISOString()
    const message =
      'message' in parameters && typeof parameters.message === 'string'
        ? parameters.message
        : undefined

    const core = {
      time,
      level,
      service: this.options.service ? this.options.service : undefined,
      message,
    }
    const data = {
      ...core,
      ...parameters,
    }
    try {
      return JSON.stringify(data, (k, v: unknown) =>
        typeof v === 'bigint' ? v.toString() : v,
      )
    } catch (e) {
      this.error('Unable to log', e)
      return JSON.stringify(core)
    }
  }

  private formatPretty(level: LogLevel, parameters: {}): string {
    const time = formatTimePretty(
      this.options.getTime(),
      this.options.utc,
      this.options.colors,
    )

    const levelOut = formatLevelPretty(level, this.options.colors)
    const service = formatServicePretty(
      this.options.service,
      this.options.colors,
    )

    let messageOut = ''
    if ('message' in parameters && typeof parameters.message === 'string') {
      messageOut = ` ${parameters.message}`
      delete parameters.message
    }

    const params = formatParametersPretty(parameters, this.options.colors)
    return `${time} ${levelOut}${service}${messageOut}${params}\n`
  }
}