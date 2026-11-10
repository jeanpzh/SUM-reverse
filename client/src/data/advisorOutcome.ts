import { academicSectionCoverage, type AcademicProposal } from './academicScheduling.ts'

export type AdvisorOutcome = ReturnType<typeof measureAdvisorOutcome>

// Actual proposal snapshots, independent of the advisor's estimated impact.
export function measureAdvisorOutcome(before: AcademicProposal, after: AcademicProposal, recommendationCount: number) {
  return {
    sourceProposalId: before.proposalId,
    proposalId: after.proposalId,
    editVersion: after.editVersion ?? 0,
    recommendationCount,
    before: { components: before.counts.scheduledSessions, completeSections: academicSectionCoverage(before).complete },
    after: { components: after.counts.scheduledSessions, completeSections: academicSectionCoverage(after).complete },
    requiredComponents: after.counts.requiredSessions,
    totalSections: after.counts.sections,
  }
}
