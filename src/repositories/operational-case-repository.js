export class OperationalCaseRepository {
  create() {
    throw new Error("OperationalCaseRepository.create must be implemented")
  }

  findById() {
    throw new Error("OperationalCaseRepository.findById must be implemented")
  }

  save() {
    throw new Error("OperationalCaseRepository.save must be implemented")
  }

  list() {
    throw new Error("OperationalCaseRepository.list must be implemented")
  }

  transaction() {
    throw new Error("OperationalCaseRepository.transaction must be implemented")
  }

  saveSiscomexSnapshot() {
    throw new Error("OperationalCaseRepository.saveSiscomexSnapshot must be implemented")
  }

  listSiscomexSnapshots() {
    throw new Error("OperationalCaseRepository.listSiscomexSnapshots must be implemented")
  }

  findLatestSiscomexSnapshot(criteria) {
    return this.listSiscomexSnapshots(criteria)[0] ?? null
  }

  saveSiscomexSyncRun() {
    throw new Error("OperationalCaseRepository.saveSiscomexSyncRun must be implemented")
  }

  listSiscomexSyncRuns() {
    throw new Error("OperationalCaseRepository.listSiscomexSyncRuns must be implemented")
  }
}
