// Structured JSON logger for K8s log aggregation. Server-side code MUST use
// createLogger; browser-side code keeps console.*.

import { getEnv } from '@/lib/runtime/env';

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

function getMinLevel(): number {
  const envLevel = (getEnv('LOG_LEVEL') || 'info').toLowerCase() as LogLevel;
  return LOG_LEVELS[envLevel] ?? LOG_LEVELS.info;
}

let minLevel = getMinLevel();

function safeSerialize(value: unknown): unknown {
  if (value instanceof Error) {
    const errorObj: Record<string, unknown> = {
      message: value.message,
      name: value.name,
      stack: value.stack,
    };
    for (const key of Object.getOwnPropertyNames(value)) {
      if (!(key in errorObj)) {
        errorObj[key] = (value as unknown as Record<string, unknown>)[key];
      }
    }
    return errorObj;
  }
  return value;
}

function safeStringify(obj: Record<string, unknown>): string {
  const seen = new WeakSet();
  return JSON.stringify(obj, (_key, value) => {
    if (typeof value === 'object' && value !== null) {
      if (seen.has(value)) return '[Circular]';
      seen.add(value);
    }
    if (typeof value === 'bigint') return value.toString();
    return value;
  });
}

export interface Logger {
  debug(message: string, meta?: Record<string, unknown>): void;
  info(message: string, meta?: Record<string, unknown>): void;
  warn(message: string, meta?: Record<string, unknown>): void;
  error(message: string, meta?: Record<string, unknown>): void;
  child(subModule: string): Logger;
}

function writeLog(
  level: LogLevel,
  module: string,
  message: string,
  meta?: Record<string, unknown>,
): void {
  if (LOG_LEVELS[level] < minLevel) return;

  const entry: Record<string, unknown> = {
    timestamp: new Date().toISOString(),
    level,
    module,
    message,
  };

  if (meta) {
    for (const [key, value] of Object.entries(meta)) {
      entry[key] = safeSerialize(value);
    }
  }

  const line = safeStringify(entry);
  // eslint-disable-next-line no-console -- the only sanctioned console use
  console.log(line);
}

export function createLogger(module: string): Logger {
  return {
    debug: (msg, meta?) => writeLog('debug', module, msg, meta),
    info: (msg, meta?) => writeLog('info', module, msg, meta),
    warn: (msg, meta?) => writeLog('warn', module, msg, meta),
    error: (msg, meta?) => writeLog('error', module, msg, meta),
    child: (sub) => createLogger(`${module}:${sub}`),
  };
}

export function setLogLevel(level: LogLevel): void {
  minLevel = LOG_LEVELS[level] ?? LOG_LEVELS.info;
}

export type { LogLevel };
