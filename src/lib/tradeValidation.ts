import type { TradePickRef } from '../types/state';

export type ValidationResult = {
  ok: boolean;
  error?: string;
};

/**
 * Validates that a trade doesn't contain duplicate picks.
 * A pick is considered duplicate if it has the same year, round, and originalOwnerId.
 */
export function validateNoDuplicatePicks(picks: TradePickRef[]): ValidationResult {
  if (picks.length === 0) {
    return { ok: false, error: 'Trade must contain at least one pick' };
  }

  // Create a set of pick keys to detect duplicates
  const pickKeys = new Set<string>();
  const duplicates: string[] = [];

  for (const pick of picks) {
    const key = `${pick.year}-${pick.round}-${pick.originalOwnerId}`;
    
    if (pickKeys.has(key)) {
      duplicates.push(`${pick.year} Round ${pick.round} (originally owned by ${pick.originalOwnerId})`);
    } else {
      pickKeys.add(key);
    }
  }

  if (duplicates.length > 0) {
    return {
      ok: false,
      error: `Duplicate picks found in trade: ${duplicates.join(', ')}`,
    };
  }

  return { ok: true };
}

