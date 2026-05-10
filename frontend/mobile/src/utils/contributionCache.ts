type Hint = { createdAtIso: string; type?: string };
const map = new Map<string | number, Hint>();

export function setContributionHint(poiId: string | number, hint: Hint) {
  if (!hint.createdAtIso) return;
  map.set(poiId, hint);
}

export function getContributionHint(poiId: string | number): Hint | undefined {
  return map.get(poiId);
}

export function clearContributionHint(poiId: string | number) {
  map.delete(poiId);
}
