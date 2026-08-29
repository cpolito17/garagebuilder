/** Stable identities shared by approvals, exclusions and replacement checks. */

export function normaliseTitle(title: string): string {
  return title.replace(/_/g, ' ').trim().toLowerCase();
}

export function titleFromSourceUrl(sourceUrl: string): string | null {
  const marker = '/wiki/';
  const at = sourceUrl.indexOf(marker);
  if (at < 0) return null;
  const raw = sourceUrl.slice(at + marker.length);
  if (raw.length === 0) return null;
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}

/**
 * Commons titles are stable across thumbnail URLs. Other providers use their
 * canonical landing page, stripped of tracking fragments and query strings.
 */
export function sourceIdentity(sourceUrl: string): string {
  const commonsTitle = titleFromSourceUrl(sourceUrl);
  if (commonsTitle) return `commons:${normaliseTitle(commonsTitle)}`;

  try {
    const url = new URL(sourceUrl);
    url.hash = '';
    url.search = '';
    return `url:${url.toString().replace(/\/$/, '').toLowerCase()}`;
  } catch {
    return `url:${sourceUrl.trim().toLowerCase()}`;
  }
}

export function approvalKey(vehicleId: string, sourceUrl: string): string {
  return `${vehicleId}::${sourceIdentity(sourceUrl)}`;
}

/** Existing exclusions are Commons titles; new entries may be source IDs. */
export function exclusionMatches(
  exclusion: string,
  title: string,
  sourceUrl: string,
): boolean {
  const normal = exclusion.trim().toLowerCase();
  return normal === sourceIdentity(sourceUrl)
    || normaliseTitle(exclusion) === normaliseTitle(title);
}
