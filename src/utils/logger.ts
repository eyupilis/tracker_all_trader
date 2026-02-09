/**
 * Standalone pino logger for services that run outside Fastify request context.
 * Uses the same pino instance that Fastify uses internally.
 */

import { config } from '../config.js';

// Lightweight structured logger — no extra dependencies needed.
// Fastify already bundles pino, but we only need console-based logging here.

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogFn {
  (obj: Record<string, unknown>, msg?: string): void;
  (msg: string): void;
}

function createLogFn(level: LogLevel): LogFn {
  const prefix = {
    debug: '🔍',
    info: 'ℹ️ ',
    warn: '⚠️ ',
    error: '❌',
  }[level];

  const consoleFn = level === 'error' ? console.error : level === 'warn' ? console.warn : console.log;

  return function log(objOrMsg: Record<string, unknown> | string, msg?: string) {
    const ts = new Date().toISOString().slice(11, 23);
    if (typeof objOrMsg === 'string') {
      consoleFn(`[${ts}] ${prefix} [scraper] ${objOrMsg}`);
    } else {
      const ctx = Object.entries(objOrMsg)
        .map(([k, v]) => `${k}=${JSON.stringify(v)}`)
        .join(' ');
      consoleFn(`[${ts}] ${prefix} [scraper] ${msg || ''} ${ctx}`);
    }
  } as LogFn;
}

export const logger = {
  debug: createLogFn('debug'),
  info: createLogFn('info'),
  warn: createLogFn('warn'),
  error: createLogFn('error'),
  isDebug: config.isDevelopment,
};
