import type { TradePickRef, State, TeamId } from '../types/state';

export type ValidationResult = {
  ok: boolean;
  error?: string;
};

// Helper to rebuild ownership map (same logic as OwnershipTable)
function rebuildOwnership(state: State): Map<string, TeamId> {
  const ownership = new Map<string, TeamId>();
  
  for (const pick of state.basePicks) {
    const key = `${pick.year}-${pick.round}-${pick.originalOwnerId}`;
    ownership.set(key, pick.currentOwnerId);
  }

  const sortedTrades = [...state.trades].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  );

  for (const trade of sortedTrades) {
    for (const pickRef of trade.picks) {
      const key = `${pickRef.year}-${pickRef.round}-${pickRef.originalOwnerId}`;
      if (ownership.has(key)) {
        const currentOwner = ownership.get(key);
        if (currentOwner === trade.fromTeamId) {
          ownership.set(key, trade.toTeamId);
        }
      }
    }
  }

  return ownership;
}

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

/**
 * Checks if a pick is locked due to the Stepien rule.
 * The Stepien rule: You cannot trade consecutive 1st round picks.
 * If a team doesn't own their 1st round pick in year X, they can't trade their 1st round pick in year X+1.
 */
export function isPickLockedByStepienRule(
  state: State,
  teamId: TeamId,
  year: number,
  round: number
): boolean {
  // Only applies to 1st round picks
  if (round !== 1) {
    return false;
  }

  const ownership = rebuildOwnership(state);
  
  // Check if team owns their previous year's 1st round pick
  const previousYear = year - 1;
  const previousYearKey = `${previousYear}-1-${teamId}`;
  
  // Check if the previous year pick exists in basePicks
  const previousYearPickExists = state.basePicks.some(
    p => p.year === previousYear && p.round === 1 && p.originalOwnerId === teamId
  );
  
  // If there's no previous year pick, this pick can't be locked
  if (!previousYearPickExists) {
    return false;
  }
  
  const previousYearOwner = ownership.get(previousYearKey);
  
  // If they don't own their previous year's 1st round, this pick is locked
  return previousYearOwner !== teamId;
}

/**
 * Validates that a trade doesn't violate the Stepien rule.
 * The Stepien rule: You cannot trade consecutive 1st round picks.
 * 
 * This checks:
 * 1. That locked picks (where previous year's pick is not owned) cannot be traded
 * 2. That you cannot trade two consecutive 1st round picks in the same trade
 */
export function validateStepienRule(
  state: State,
  fromTeamId: TeamId,
  picks: TradePickRef[]
): ValidationResult {
  const violations: string[] = [];
  const firstRoundPicks = picks.filter(p => p.round === 1 && p.originalOwnerId === fromTeamId);
  
  // Check 1: Cannot trade locked picks
  for (const pick of picks) {
    // Only applies to 1st round picks from the trading team
    if (pick.round !== 1 || pick.originalOwnerId !== fromTeamId) {
      continue;
    }

    // Check if this pick is locked
    if (isPickLockedByStepienRule(state, fromTeamId, pick.year, pick.round)) {
      violations.push(`${pick.year} Round ${pick.round} (locked - previous year's pick not owned)`);
    }
  }

  // Check 2: Cannot trade two consecutive 1st round picks in the same trade
  const sortedFirstRoundPicks = firstRoundPicks
    .map(p => p.year)
    .sort((a, b) => a - b);

  for (let i = 0; i < sortedFirstRoundPicks.length - 1; i++) {
    const currentYear = sortedFirstRoundPicks[i];
    const nextYear = sortedFirstRoundPicks[i + 1];
    
    if (nextYear === currentYear + 1) {
      violations.push(`Cannot trade consecutive 1st round picks: ${currentYear} and ${nextYear} in the same trade`);
    }
  }

  if (violations.length > 0) {
    return {
      ok: false,
      error: `Stepien rule violation: ${violations.join('. ')}`,
    };
  }

  return { ok: true };
}

