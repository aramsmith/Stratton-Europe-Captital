import type { CitationAssessment, ClaimAssessmentInput } from "./types.js";

export function evaluateCitationAssessment(claims: ClaimAssessmentInput[]): CitationAssessment {
  if (claims.length === 0) {
    return {
      allMaterialClaimsCited: false,
      unsupportedClaimCount: 0,
      criticalUnsupportedClaimCount: 0,
      materialClaimCount: 0,
      citedMaterialClaimCount: 0,
      totalClaimCount: 0,
      citedClaimCount: 0
    };
  }

  let unsupported = 0;
  let criticalUnsupported = 0;
  let cited = 0;

  for (const claim of claims) {
    if (claim.citations.length > 0) {
      cited += 1;
      continue;
    }
    unsupported += 1;
    if (claim.materiality === "HIGH" || claim.materiality === "CRITICAL") {
      criticalUnsupported += 1;
    }
  }

  const allMaterialClaimsCited = claims
    .filter((claim) => claim.materiality === "HIGH" || claim.materiality === "CRITICAL")
    .every((claim) => claim.citations.length > 0);

  return {
    allMaterialClaimsCited,
    unsupportedClaimCount: unsupported,
    criticalUnsupportedClaimCount: criticalUnsupported,
    materialClaimCount: claims.filter((claim) => claim.materiality === "HIGH" || claim.materiality === "CRITICAL")
      .length,
    citedMaterialClaimCount: claims.filter(
      (claim) =>
        (claim.materiality === "HIGH" || claim.materiality === "CRITICAL") &&
        claim.citations.length > 0
    ).length,
    totalClaimCount: claims.length,
    citedClaimCount: cited
  };
}
