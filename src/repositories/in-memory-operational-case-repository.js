import {
  CaseVersionConflictError,
  NotFoundError,
  ValidationError,
} from "../domain/shared/errors.js"
import { OperationalCaseRepository } from "./operational-case-repository.js"

const clone = (value) => structuredClone(value)

function assertAppendOnly(previous, next, collection, idField) {
  const previousById = new Map(
    (previous[collection] ?? []).map((record) => [
      record[idField],
      JSON.stringify(record),
    ]),
  )
  for (const record of next[collection] ?? []) {
    const serialized = previousById.get(record[idField])
    if (serialized !== undefined && serialized !== JSON.stringify(record)) {
      throw new ValidationError(`${collection} records are immutable`)
    }
  }
}

export class InMemoryOperationalCaseRepository extends OperationalCaseRepository {
  #cases = new Map()

  create(operationalCase) {
    if (this.#cases.has(operationalCase.id)) {
      throw new ValidationError(`OperationalCase already exists: ${operationalCase.id}`)
    }
    const stored = { ...clone(operationalCase), version: 1 }
    this.#cases.set(stored.id, stored)
    return clone(stored)
  }

  save(operationalCase, expectedVersion = operationalCase.version) {
    const current = this.#cases.get(operationalCase.id)
    if (!current) throw new NotFoundError("OperationalCase", operationalCase.id)
    if (current.version !== expectedVersion) {
      throw new CaseVersionConflictError(
        operationalCase.id,
        expectedVersion,
        current.version,
      )
    }
    assertAppendOnly(current, operationalCase, "evidences", "id")
    assertAppendOnly(current, operationalCase, "timeline", "eventId")
    const stored = { ...clone(operationalCase), version: expectedVersion + 1 }
    this.#cases.set(stored.id, stored)
    return clone(stored)
  }

  findById(id) {
    const operationalCase = this.#cases.get(id)
    if (!operationalCase) throw new NotFoundError("OperationalCase", id)
    return clone(operationalCase)
  }

  list({ limit = 50, offset = 0 } = {}) {
    return [...this.#cases.values()]
      .slice(offset, offset + limit)
      .map(clone)
  }

  transaction(work) {
    const snapshot = new Map(
      [...this.#cases.entries()].map(([id, value]) => [id, clone(value)]),
    )
    try {
      return work()
    } catch (error) {
      this.#cases = snapshot
      throw error
    }
  }
}
