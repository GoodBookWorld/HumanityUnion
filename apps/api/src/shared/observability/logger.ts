export type LogLevel = "debug" | "info" | "warn" | "error";

export interface LogFields {
  [key: string]: unknown;
}

const LOG_LEVEL_PRIORITY: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

function resolveLogLevel(): LogLevel {
  const configured = process.env.LOG_LEVEL?.trim().toLowerCase();

  if (
    configured === "debug" ||
    configured === "info" ||
    configured === "warn" ||
    configured === "error"
  ) {
    return configured;
  }

  return process.env.NODE_ENV === "production" ? "info" : "debug";
}

const activeLevel = resolveLogLevel();

function shouldLog(level: LogLevel): boolean {
  return LOG_LEVEL_PRIORITY[level] >= LOG_LEVEL_PRIORITY[activeLevel];
}

function writeLog(level: LogLevel, message: string, fields: LogFields = {}): void {
  if (!shouldLog(level)) {
    return;
  }

  const entry = {
    timestamp: new Date().toISOString(),
    level,
    service: "humanity-union-api",
    message,
    ...fields,
  };

  const line = JSON.stringify(entry);

  if (level === "error") {
    console.error(line);
    return;
  }

  if (level === "warn") {
    console.warn(line);
    return;
  }

  console.log(line);
}

export const logger = {
  debug(message: string, fields?: LogFields): void {
    writeLog("debug", message, fields);
  },
  info(message: string, fields?: LogFields): void {
    writeLog("info", message, fields);
  },
  warn(message: string, fields?: LogFields): void {
    writeLog("warn", message, fields);
  },
  error(message: string, fields?: LogFields): void {
    writeLog("error", message, fields);
  },
};

export function logDomainEvent(
  phase: "enqueued" | "dispatched" | "processed" | "failed" | "skipped_duplicate",
  fields: LogFields,
): void {
  logger.info(`domain_event.${phase}`, {
    component: "event-infrastructure",
    ...fields,
  });
}
