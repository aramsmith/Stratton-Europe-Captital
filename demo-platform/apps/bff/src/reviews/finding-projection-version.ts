import { createHash } from "node:crypto";
import type { AnalysisFinding } from "@stratton/contracts";

export function createFindingProjectionVersion(
  finding: AnalysisFinding,
  authoritativeSubjectVersion: string
): string {
  return createHash("sha256")
    .update(
      JSON.stringify({
        authoritativeSubjectVersion,
        findingId: finding.findingId,
        summary: finding.summary,
        citations: finding.citations
          .map(({ citationId, evidenceId, locator }) => ({
            citationId,
            evidenceId,
            locator
          }))
          .sort((left, right) => left.citationId.localeCompare(right.citationId))
      })
    )
    .digest("hex");
}
