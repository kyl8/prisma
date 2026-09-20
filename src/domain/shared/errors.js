export class ValidationError extends Error {
  constructor(message, details = undefined) {
    super(message)
    this.name = "ValidationError"
    this.details = details
  }
}

export class NotFoundError extends Error {
  constructor(resource, id) {
    super(`${resource} not found: ${id}`)
    this.name = "NotFoundError"
    this.resource = resource
    this.id = id
  }
}

export class CaseVersionConflictError extends Error {
  constructor(caseId, expectedVersion, currentVersion) {
    super(`OperationalCase version conflict: ${caseId}`)
    this.name = "CaseVersionConflictError"
    this.code = "CASE_VERSION_CONFLICT"
    this.caseId = caseId
    this.expectedVersion = expectedVersion
    this.currentVersion = currentVersion
  }
}
