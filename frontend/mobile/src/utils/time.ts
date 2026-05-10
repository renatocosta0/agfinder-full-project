export function computeCountdown(createdAtIso?: string, ttlMinutes: number = 30) {
  if (!createdAtIso) return { remainingMs: 0, countdownLabel: '', progressiveLabel: '' };
  const created = new Date(createdAtIso).getTime();
  const expires = created + ttlMinutes * 60 * 1000;
  const now = Date.now();
  const remaining = Math.max(0, expires - now);
  const mm = Math.floor(remaining / 60000);
  const ss = Math.floor((remaining % 60000) / 1000);
  const countdownLabel = `Updated in ${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}`;
  // Use real elapsed time since contribution creation (keeps increasing after TTL)
  const elapsed = Math.max(0, now - created);
  let progressiveLabel = '';
  if (elapsed < 60000) {
    const secs = Math.max(1, Math.ceil(elapsed / 1000));
    progressiveLabel = `Updated ${secs}s`;
  } else {
    const minsProgress = Math.max(1, Math.floor(elapsed / 60000));
    progressiveLabel = `Updated ${minsProgress} ${minsProgress === 1 ? 'minute' : 'minutes'}`;
  }
  return { remainingMs: remaining, countdownLabel, progressiveLabel };
}

export function formatSince(createdAtIso?: string) {
  if (!createdAtIso) return 'No updates today';
  const created = new Date(createdAtIso).getTime();
  const diffMs = Date.now() - created;
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 60) return `Updated ${diffMin} minutes`;
  const hours = Math.floor(diffMin / 60);
  return `Updated ${hours} hours`;
}
