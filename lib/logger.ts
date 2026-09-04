// Structured logging. On Vercel, stdout is captured as JSON log lines, so a
// plain structured console logger is enough and avoids a heavy dependency in
// the serverless bundle. The shape matches pino's { level, msg, ...fields } so
// it can be swapped for pino later without changing call sites.
//
// NEVER log: raw licence keys, full HWIDs, session tokens, password hashes,
// the Discord webhook, or any server secret. Log masked prefixes and ids only.

type Fields = Record<string, unknown>;

function emit(level: "info" | "warn" | "error", fields: Fields, msg: string) {
  const line = JSON.stringify({
    level,
    time: new Date().toISOString(),
    msg,
    ...fields,
  });
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);
}

export const logger = {
  info: (fields: Fields, msg: string) => emit("info", fields, msg),
  warn: (fields: Fields, msg: string) => emit("warn", fields, msg),
  error: (fields: Fields, msg: string) => emit("error", fields, msg),
};
