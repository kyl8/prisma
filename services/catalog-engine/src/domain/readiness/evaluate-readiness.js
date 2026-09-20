export function evaluateReadiness(findings, actions = []) {
  const activeFindings = findings.filter((finding) => finding.status === "OPEN")
  const blockingFindings = activeFindings.filter((finding) => finding.blocking)
  const status =
    blockingFindings.length > 0
      ? "BLOCKED"
      : activeFindings.length > 0
        ? "CONDITIONAL"
        : "READY"
  const relevantFindings =
    status === "BLOCKED" ? blockingFindings : activeFindings

  return {
    status,
    reasons: [...new Set(relevantFindings.map((finding) => finding.reason))],
    blockingFields: [
      ...new Set(
        blockingFindings.map((finding) => finding.field).filter(Boolean),
      ),
    ],
    conditions: activeFindings.flatMap(
      (finding) => finding.resolutionCriteria,
    ),
    evidenceIds: [
      ...new Set(relevantFindings.flatMap((finding) => finding.evidenceIds)),
    ],
    activeFindingIds: activeFindings.map((finding) => finding.id),
    requiredActionIds: actions
      .filter(
        (action) =>
          activeFindings.some((finding) => finding.id === action.findingId) &&
          ["OPEN", "IN_PROGRESS"].includes(action.status),
      )
      .map((action) => action.id),
    releaseCriteria: blockingFindings.flatMap(
      (finding) => finding.resolutionCriteria,
    ),
  }
}
