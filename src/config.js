import { resolve } from "node:path"

function positiveInteger(value, fallback, name) {
  if (value === undefined || value === "") return fallback
  const parsed = Number(value)
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new RangeError(`${name} must be a positive integer`)
  }
  return parsed
}

export function loadConfig(environment = process.env, cwd = process.cwd()) {
  const dataDirectory = resolve(cwd, ".prisma-data")
  const configuredDatabase = environment.DATABASE_PATH ?? `${dataDirectory}/prisma.db`
  return {
    databasePath:
      configuredDatabase === ":memory:"
        ? configuredDatabase
        : resolve(configuredDatabase),
    uploadDirectory: resolve(environment.UPLOAD_DIR ?? `${dataDirectory}/uploads`),
    maxUploadSize: positiveInteger(
      environment.MAX_UPLOAD_SIZE,
      5_000_000,
      "MAX_UPLOAD_SIZE",
    ),
  }
}
