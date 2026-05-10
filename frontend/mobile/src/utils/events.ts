export type ContributionEvent = {
  poiId: string | number;
  createdAtIso: string;
};

const listeners = new Set<(e: ContributionEvent) => void>();

export function emitContribution(e: ContributionEvent) {
  listeners.forEach((fn) => {
    try { fn(e); } catch {}
  });
}

export function subscribeContributions(fn: (e: ContributionEvent) => void) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
