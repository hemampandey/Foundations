/**
 * Format a date string for display.
 * Returns a human-friendly relative or absolute string.
 */
export function formatDate(iso: string): string {
  const date = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60_000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d ago`;

  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
  });
}

/**
 * Calculate level from XP.
 * Each level requires progressively more XP.
 */
export function xpToLevel(xp: number): { level: number; currentXp: number; requiredXp: number } {
  // Simple level curve: level N requires N * 100 XP
  let level = 1;
  let remaining = xp;
  while (remaining >= level * 100) {
    remaining -= level * 100;
    level++;
  }
  return {
    level,
    currentXp: remaining,
    requiredXp: level * 100,
  };
}

/** True when the env flag NEXT_PUBLIC_DEV_MODE is explicitly "true". */
export function isDevMode(): boolean {
  return process.env.NEXT_PUBLIC_DEV_MODE === 'true';
}

/**
 * Page numbers for pagination controls, collapsing long ranges with ellipses:
 * e.g. [1, '...', 4, 5, 6, '...', 10].
 */
export function getPageNumbers(currentPage: number, totalPages: number): (number | '...')[] {
  if (totalPages <= 5) return Array.from({ length: totalPages }, (_, i) => i + 1);

  const pages: (number | '...')[] = [1];
  if (currentPage > 3) pages.push('...');
  for (let i = Math.max(2, currentPage - 1); i <= Math.min(totalPages - 1, currentPage + 1); i++) {
    pages.push(i);
  }
  if (currentPage < totalPages - 2) pages.push('...');
  pages.push(totalPages);
  return pages;
}
