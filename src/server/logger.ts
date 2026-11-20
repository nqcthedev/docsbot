/**
 * Minimal structured logger: one JSON object per line in production (ready for
 * Vercel / Docker log drains), compact human-readable lines in development.
 */
type Level = 'debug' | 'info' | 'warn' | 'error';
const order: Record<Level, number> = { debug: 10, info: 20, warn: 30, error: 40 };

export type LogFields = Record<string, unknown>;

function serializeError(err: unknown) {
  if (err instanceof Error)
    return {
      name: err.name,
      message: err.message,
      stack: err.stack?.split('\n').slice(0, 6).join('\n'),
    };
  return err;
}

function threshold(): number {
  const lvl =
    (process.env.LOG_LEVEL as Level | undefined) ??
    (process.env.NODE_ENV === 'test' ? 'warn' : 'info');
  return order[lvl] ?? order.info;
}

function write(level: Level, msg: string, fields: LogFields = {}) {
  if (order[level] < threshold()) return;
  const data: LogFields = {};
  for (const [k, v] of Object.entries(fields))
    data[k] = k === 'err' || v instanceof Error ? serializeError(v) : v;
  const out = level === 'error' || level === 'warn' ? process.stderr : process.stdout;
  if (process.env.NODE_ENV === 'production' || process.env.LOG_FORMAT === 'json') {
    out.write(JSON.stringify({ level, time: new Date().toISOString(), msg, ...data }) + '\n');
  } else {
    const extra = Object.keys(data).length ? ' ' + JSON.stringify(data) : '';
    out.write(
      `${new Date().toISOString().slice(11, 23)} ${level.toUpperCase().padEnd(5)} ${msg}${extra}\n`
    );
  }
}

export interface Logger {
  debug(msg: string, fields?: LogFields): void;
  info(msg: string, fields?: LogFields): void;
  warn(msg: string, fields?: LogFields): void;
  error(msg: string, fields?: LogFields): void;
  child(bindings: LogFields): Logger;
}

function make(bindings: LogFields): Logger {
  return {
    debug: (m, f) => write('debug', m, { ...bindings, ...f }),
    info: (m, f) => write('info', m, { ...bindings, ...f }),
    warn: (m, f) => write('warn', m, { ...bindings, ...f }),
    error: (m, f) => write('error', m, { ...bindings, ...f }),
    child: (b) => make({ ...bindings, ...b }),
  };
}

export const logger = make({});
