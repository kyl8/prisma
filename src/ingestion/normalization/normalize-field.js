function normalizeSpaces(value) {
  return value.trim().replace(/\s+/g, " ")
}

export function parseLocalizedNumber(rawValue) {
  if (typeof rawValue === "number") return rawValue
  if (typeof rawValue !== "string") return null

  const compact = rawValue.replace(/\s/g, "").replace(/[^0-9,.-]/g, "")
  if (!compact || compact === "-" || compact === "." || compact === ",") {
    return null
  }

  const comma = compact.lastIndexOf(",")
  const dot = compact.lastIndexOf(".")
  let normalized = compact

  if (comma >= 0 && dot >= 0) {
    const decimalSeparator = comma > dot ? "," : "."
    const thousandsSeparator = decimalSeparator === "," ? "." : ","
    normalized = compact.split(thousandsSeparator).join("")
    normalized = normalized.replace(decimalSeparator, ".")
  } else if (comma >= 0) {
    normalized = compact.replace(/\./g, "").replace(",", ".")
  } else {
    normalized = compact.replace(/,/g, "")
  }

  const result = Number(normalized)
  return Number.isFinite(result) ? result : null
}

function normalizeDate(rawValue) {
  if (rawValue instanceof Date && !Number.isNaN(rawValue.getTime())) {
    return rawValue.toISOString().slice(0, 10)
  }
  if (typeof rawValue !== "string") return null

  const match = normalizeSpaces(rawValue).match(/^(\d{2})\/(\d{2})\/(\d{4})$/)
  if (!match) return null
  const [, day, month, year] = match
  const date = new Date(`${year}-${month}-${day}T00:00:00.000Z`)
  if (
    date.getUTCFullYear() !== Number(year) ||
    date.getUTCMonth() + 1 !== Number(month) ||
    date.getUTCDate() !== Number(day)
  ) {
    return null
  }
  return `${year}-${month}-${day}`
}

function extractUnit(rawValue) {
  if (typeof rawValue !== "string") return null
  const match = rawValue.trim().match(/(?:^|\s)(KG|G|T|PCS|PC|UN|UNIT|UNITS)$/i)
  if (!match) return null
  const unit = match[1].toUpperCase()
  if (unit === "PC" || unit === "UNIT" || unit === "UNITS") return "PCS"
  return ["KG", "G", "T"].includes(unit) ? unit.toLowerCase() : unit
}

function extractCurrency(rawValue) {
  if (typeof rawValue !== "string") return null
  const match = rawValue.match(/\b(USD|BRL|EUR|GBP|JPY|CNY)\b/i)
  return match?.[1].toUpperCase() ?? null
}

export function normalizeFieldValue(field, rawValue) {
  const stringValue = typeof rawValue === "string" ? normalizeSpaces(rawValue) : rawValue

  if (typeof stringValue === "string" && stringValue.startsWith("=")) {
    return { value: stringValue, normalizedValue: stringValue }
  }

  if (["grossWeight", "netWeight", "quantity", "value"].includes(field)) {
    const numericValue = parseLocalizedNumber(rawValue)
    if (numericValue !== null) {
      return {
        value: numericValue,
        normalizedValue: numericValue,
        normalizedUnit: extractUnit(rawValue),
        currency: field === "value" ? extractCurrency(rawValue) : null,
      }
    }
  }

  if (field === "issueDate") {
    const date = normalizeDate(rawValue)
    if (date) return { value: date, normalizedValue: date }
  }

  if (field === "unit" && typeof stringValue === "string") {
    const unit = extractUnit(`0 ${stringValue}`) ?? stringValue.toUpperCase()
    return { value: unit, normalizedValue: unit }
  }

  return { value: stringValue, normalizedValue: stringValue }
}
