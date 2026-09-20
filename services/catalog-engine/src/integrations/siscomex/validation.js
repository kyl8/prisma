import { ValidationError } from "../../domain/shared/errors.js"

export function digits(value, name, lengths) {
  const normalized = String(value ?? "").replace(/\D/g, "")
  if (!lengths.includes(normalized.length)) {
    throw new ValidationError(`${name} must contain ${lengths.join(" or ")} digits`)
  }
  return normalized
}

export function ncmCode(value) {
  return digits(value, "NCM", [8])
}

export function productVersion(value) {
  const normalized = String(value ?? "")
  if (!/^[0-9]+(?:\.[0-9]+)*$/.test(normalized) || normalized.length > 8) {
    throw new ValidationError("Siscomex version must be a version string")
  }
  return normalized
}

export function boundedText(value, name, maximum, pattern = null) {
  const normalized = String(value ?? "").trim()
  if (!normalized || normalized.length > maximum || (pattern && !pattern.test(normalized))) {
    throw new ValidationError(`Invalid ${name}`)
  }
  return normalized
}
