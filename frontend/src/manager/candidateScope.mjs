export const getExamCandidateScope = ({ candidates, assignedCandidateIds }) => {
  const assignedIds = new Set(assignedCandidateIds);
  const scopedCandidates = candidates.filter((candidate) => assignedIds.has(candidate.id));
  return { candidates: scopedCandidates, count: scopedCandidates.length };
};
