
/**
 * Deterministic hash from a string. Used to pick stable random-ish
 * values (gradient colour) from a fixed set.
 */
export function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  return Math.abs(hash);
}


/** Gradient classes used for theory card hero sections. */
export const CARD_GRADIENTS = [
  'from-blue-600 to-indigo-500',
  'from-purple-600 to-pink-500',
  'from-emerald-600 to-teal-500',
  'from-orange-500 to-amber-500',
] as const;

/**
 * Pick a stable gradient class string for a seed (usually a UUID).
 */
export function pickGradient(seed: string): string {
  return CARD_GRADIENTS[hashString(seed) % CARD_GRADIENTS.length];
}

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
